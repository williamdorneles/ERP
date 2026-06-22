import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { z } from 'zod'
import { CriarProdutoSchema, AtualizarProdutoSchema } from '@erp/shared'
import { requirePerfil } from '../../plugins/auth.plugin.js'
import { calcularCustoBom, propagarCustoComponente } from './custo-bom.service.js'

const UNIDADES = ['KG', 'G', 'L', 'ML', 'UN', 'CX', 'PCT'] as const

const BomSchema = z.object({
  qtdeProduzida:    z.number().positive(),
  unidadeProduzida: z.enum(UNIDADES),
  tempoPreparo:     z.number().int().positive().optional().nullable(),
  instrucoes:       z.string().optional().nullable(),
  itens: z.array(z.object({
    componenteId: z.string().uuid(),
    quantidade:   z.number().positive(),
    unidade:      z.enum(UNIDADES),
    percPerda:    z.number().min(0).max(100).default(0),
    ordem:        z.number().int().default(0),
  })).min(1),
})


const QueryProdutosSchema = z.object({
  busca: z.string().max(100).optional(),
  tipo: z.enum(['INSUMO', 'PRODUTO_ACABADO', 'INSUMO_PRODUTO']).optional(),
  categoriaId: z.string().uuid().optional(),
  mostrarInativos: z.enum(['true', 'false']).optional(),
})

export async function produtosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'VENDAS', 'ESTOQUE', 'PRODUCAO', 'FINANCEIRO'))

  app.get('/', async (request) => {
    const { busca, tipo, categoriaId, mostrarInativos } = QueryProdutosSchema.parse(request.query)

    return prisma.produto.findMany({
      where: {
        ...(mostrarInativos !== 'true' && { ativo: true }),
        ...(busca && { nome: { contains: busca, mode: 'insensitive' } }),
        ...(tipo && { tipo }),
        ...(categoriaId && { categoriaId }),
      },
      include: { categoria: { select: { id: true, nome: true } } },
      orderBy: { nome: 'asc' },
    })
  })

  app.get('/alertas', async () => {
    return prisma.$queryRaw`
      SELECT * FROM produtos
      WHERE ativo = true
      AND tipo IN ('INSUMO', 'INSUMO_PRODUTO')
      AND "estoqueAtual" <= "estoqueMinimo"
    `
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const produto = await prisma.produto.findUnique({
      where: { id },
      include: {
        categoria: { select: { id: true, nome: true } },
        fichaTecnica: { select: { id: true } },
        bom: {
          include: {
            itens: {
              include: { componente: { select: { id: true, codigo: true, nome: true, unidadeMedida: true, custoUnitario: true } } },
              orderBy: { ordem: 'asc' },
            },
          },
        },
      },
    })
    if (!produto) return reply.code(404).send({ error: 'Produto não encontrado' })
    return produto
  })

  // ── BOM ──────────────────────────────────────────────────────────────────────

  app.put('/:id/bom', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = BomSchema.parse(request.body)

    const produto = await prisma.produto.findUnique({ where: { id } })
    if (!produto) return reply.code(404).send({ error: 'Produto não encontrado' })

    const bom = await prisma.$transaction(async tx => {
      // Apaga BOM existente e recria (mais simples que diff)
      await tx.produtoBom.deleteMany({ where: { produtoId: id } })

      const nova = await tx.produtoBom.create({
        data: {
          produtoId:        id,
          qtdeProduzida:    data.qtdeProduzida,
          unidadeProduzida: data.unidadeProduzida,
          tempoPreparo:     data.tempoPreparo ?? null,
          instrucoes:       data.instrucoes ?? null,
          itens: {
            create: data.itens.map(i => ({
              componenteId: i.componenteId,
              quantidade:   i.quantidade,
              unidade:      i.unidade,
              percPerda:    i.percPerda,
              ordem:        i.ordem,
            })),
          },
        },
        include: {
          itens: { include: { componente: { select: { custoUnitario: true } } } },
        },
      })

      // Recalcula e atualiza custoUnitario do produto
      const custoUnitario = calcularCustoBom(
        nova.itens.map(i => ({ quantidade: Number(i.quantidade), percPerda: Number(i.percPerda), componente: i.componente })),
        data.qtdeProduzida,
      )
      await tx.produto.update({ where: { id }, data: { aprovisionamento: 'FABRICADO', custoUnitario } })

      await tx.produtoCusto.create({
        data: { produtoId: id, custo: custoUnitario, motivo: 'BOM', observacao: 'Recálculo por BOM' },
      })

      // Este produto pode ser componente de outros BOMs → propaga em cascata
      await propagarCustoComponente(tx, id)

      return nova
    })

    return bom
  })

  app.delete('/:id/bom', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existe = await prisma.produtoBom.findUnique({ where: { produtoId: id } })
    if (!existe) return reply.code(404).send({ error: 'BOM não encontrada' })
    await prisma.$transaction([
      prisma.produtoBom.delete({ where: { produtoId: id } }),
      prisma.produto.update({ where: { id }, data: { aprovisionamento: 'COMPRADO' } }),
    ])
    return { ok: true }
  })

  app.get('/:id/bom/preview-custo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const bom = await prisma.produtoBom.findUnique({
      where: { produtoId: id },
      include: {
        itens: {
          include: { componente: { select: { id: true, codigo: true, nome: true, custoUnitario: true } } },
          orderBy: { ordem: 'asc' },
        },
      },
    })
    if (!bom) return reply.code(404).send({ error: 'BOM não encontrada' })

    const qtd = Number(bom.qtdeProduzida)
    const itens = bom.itens.map(i => {
      const custo = Number(i.componente.custoUnitario)
      const qtdeItem = Number(i.quantidade)
      const fator = 1 + Number(i.percPerda) / 100
      const custoTotal = custo * qtdeItem * fator
      return {
        componenteId:   i.componenteId,
        codigo:         i.componente.codigo,
        nome:           i.componente.nome,
        quantidade:     qtdeItem,
        unidade:        i.unidade,
        percPerda:      Number(i.percPerda),
        custoUnitario:  custo,
        custoTotal:     +custoTotal.toFixed(4),
      }
    })

    const totalLote = itens.reduce((s, i) => s + i.custoTotal, 0)
    return {
      qtdeProduzida:  qtd,
      totalLote:      +totalLote.toFixed(4),
      custoUnitario:  +(totalLote / qtd).toFixed(4),
      itens,
    }
  })

  app.post('/', async (request, reply) => {
    const data = CriarProdutoSchema.parse(request.body)
    const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('produto_codigo_seq')
    `
    const codigo = String(Number(nextval)).padStart(6, '0')
    const produto = await prisma.produto.create({ data: { ...data as never, codigo } })
    return reply.code(201).send(produto)
  })

  app.put('/:id', async (request) => {
    const { id } = request.params as { id: string }
    const data = AtualizarProdutoSchema.parse(request.body)

    const produto = await prisma.$transaction(async (tx) => {
      const atual = await tx.produto.findUnique({ where: { id }, select: { custoUnitario: true } })
      const atualizado = await tx.produto.update({ where: { id }, data: data as never })

      // Só registra/propaga quando o custo realmente mudar (evita lixo a cada "Salvar")
      if (data.custoUnitario !== undefined && atual && Number(atual.custoUnitario) !== Number(data.custoUnitario)) {
        await tx.produtoCusto.create({
          data: { produtoId: id, custo: Number(data.custoUnitario), motivo: 'MANUAL', observacao: 'Edição manual no cadastro' },
        })
        // Propaga para os produtos com BOM que usam este como componente
        await propagarCustoComponente(tx, id)
      }
      return atualizado
    })

    return produto
  })

  app.get('/:id/custos', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existe = await prisma.produto.findUnique({ where: { id }, select: { id: true } })
    if (!existe) return reply.code(404).send({ error: 'Produto não encontrado' })
    return prisma.produtoCusto.findMany({
      where: { produtoId: id },
      orderBy: { criadoEm: 'desc' },
      take: 100,
      include: { nfEntrada: { select: { numero: true, dataEntrada: true } } },
    })
  })

  // Exclui um registro do histórico de custos e reverte o custo do produto
  // para o registro mais recente restante (permite controle manual do custo)
  app.delete('/:id/custos/:custoId', async (request, reply) => {
    const { id, custoId } = request.params as { id: string; custoId: string }

    const registro = await prisma.produtoCusto.findUnique({ where: { id: custoId } })
    if (!registro || registro.produtoId !== id) {
      return reply.code(404).send({ error: 'Registro de custo não encontrado.' })
    }

    const resultado = await prisma.$transaction(async (tx) => {
      await tx.produtoCusto.delete({ where: { id: custoId } })

      // Custo passa a ser o do registro mais recente que sobrou (ou 0 se não houver)
      const anterior = await tx.produtoCusto.findFirst({
        where: { produtoId: id },
        orderBy: { criadoEm: 'desc' },
      })
      const custo = +(anterior ? Number(anterior.custo) : 0).toFixed(4)

      await tx.produto.update({
        where: { id },
        data: { custoUnitario: custo, custoMedio: custo, ultimoCusto: custo },
      })

      // Propaga o novo custo para produtos com BOM que usam este como componente
      await propagarCustoComponente(tx, id)

      return { custoAtual: custo }
    })

    return resultado
  })

  app.patch('/:id/toggle-ativo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const atual = await prisma.produto.findUnique({ where: { id }, select: { ativo: true } })
    if (!atual) return reply.code(404).send({ error: 'Produto não encontrado' })
    return prisma.produto.update({ where: { id }, data: { ativo: !atual.ativo } })
  })
}
