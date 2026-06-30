import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { z } from 'zod'
import { requirePerfil } from '../../plugins/auth.plugin.js'

const NaturezaSchema = z.object({
  codigo: z.string().max(20).optional(), // gerado automaticamente quando ausente
  descricao: z.string().min(2, 'Descrição obrigatória').max(120),
  ativo: z.boolean().optional(),
  tipoOperacao: z.enum(['SAIDA', 'ENTRADA']).default('SAIDA'),
  finalidadeNFe: z.enum(['NORMAL', 'COMPLEMENTAR', 'AJUSTE', 'DEVOLUCAO']).default('NORMAL'),
  modeloPadrao: z.enum(['NFE', 'NFCE']).nullish(),
  cfop: z.string().max(5).nullish(), // base, ex.: "x102" — 1º dígito resolvido no destino
  movimentaEstoque: z.enum(['NENHUM', 'SAIDA', 'ENTRADA']).default('SAIDA'),
  geraFinanceiro: z.boolean().default(true),
  geraReceitaDRE: z.boolean().default(true),
  contaFinanceiraId: z.string().uuid().nullish(),
  csosn: z.string().max(4).nullish(),
  cstIcms: z.string().max(3).nullish(),
  aliquotaIcms: z.number().min(0).max(100).nullish(),
  cstPis: z.string().max(2).nullish(),
  aliquotaPis: z.number().min(0).max(100).nullish(),
  cstCofins: z.string().max(2).nullish(),
  aliquotaCofins: z.number().min(0).max(100).nullish(),
  cstIpi: z.string().max(2).nullish(),
  aliquotaIpi: z.number().min(0).max(100).nullish(),
  textoComplementar: z.string().max(2000).nullish(),
})

// Gera um código único a partir da CFOP base (ou da descrição), com sufixo em caso de colisão.
async function gerarCodigo(base?: string | null): Promise<string> {
  const raiz = (base ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12) || 'NAT'
  let codigo = raiz
  let n = 1
  while (await prisma.naturezaOperacao.findUnique({ where: { codigo }, select: { id: true } })) {
    n++
    codigo = `${raiz}-${n}`
  }
  return codigo
}

export async function naturezasOperacaoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE'))

  app.get('/', async (request) => {
    const { tipo, ativo } = request.query as { tipo?: string; ativo?: string }
    return prisma.naturezaOperacao.findMany({
      where: {
        ...(tipo && { tipoOperacao: tipo as never }),
        ...(ativo !== undefined && { ativo: ativo === 'true' }),
      },
      include: {
        contaFinanceira: { select: { id: true, codigo: true, nome: true } },
        _count: { select: { pedidosVenda: true } },
      },
      orderBy: { codigo: 'asc' },
    })
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const natureza = await prisma.naturezaOperacao.findUnique({
      where: { id },
      include: { contaFinanceira: { select: { id: true, codigo: true, nome: true } } },
    })
    if (!natureza) return reply.code(404).send({ error: 'Natureza de operação não encontrada.' })
    return natureza
  })

  app.post('/', async (request, reply) => {
    const data = NaturezaSchema.parse(request.body)
    const codigo = data.codigo?.trim() || await gerarCodigo(data.cfop ?? data.descricao)
    const existe = await prisma.naturezaOperacao.findUnique({ where: { codigo }, select: { id: true } })
    if (existe) return reply.code(409).send({ error: `Já existe uma natureza com o código ${codigo}.` })
    const natureza = await prisma.naturezaOperacao.create({ data: { ...data, codigo } as never })
    return reply.code(201).send(natureza)
  })

  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = NaturezaSchema.partial().parse(request.body)
    const atual = await prisma.naturezaOperacao.findUnique({ where: { id }, select: { codigo: true } })
    if (!atual) return reply.code(404).send({ error: 'Natureza de operação não encontrada.' })
    if (data.codigo && data.codigo !== atual.codigo) {
      const existe = await prisma.naturezaOperacao.findUnique({ where: { codigo: data.codigo } })
      if (existe) return reply.code(409).send({ error: `Já existe uma natureza com o código ${data.codigo}.` })
    }
    return prisma.naturezaOperacao.update({ where: { id }, data: data as never })
  })

  // Define (ou remove) a natureza padrão para novos pedidos de venda. Só saída; só uma padrão.
  app.patch('/:id/definir-padrao', async (request, reply) => {
    const { id } = request.params as { id: string }
    const natureza = await prisma.naturezaOperacao.findUnique({
      where: { id }, select: { tipoOperacao: true, padraoVenda: true },
    })
    if (!natureza) return reply.code(404).send({ error: 'Natureza de operação não encontrada.' })
    if (natureza.tipoOperacao !== 'SAIDA') {
      return reply.code(400).send({ error: 'Apenas naturezas de saída podem ser padrão de venda.' })
    }
    const novoValor = !natureza.padraoVenda
    await prisma.$transaction([
      // Garante padrão único: zera as demais
      prisma.naturezaOperacao.updateMany({ where: { padraoVenda: true, NOT: { id } }, data: { padraoVenda: false } }),
      prisma.naturezaOperacao.update({ where: { id }, data: { padraoVenda: novoValor } }),
    ])
    return { ok: true, padraoVenda: novoValor }
  })

  app.patch('/:id/toggle-ativo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const atual = await prisma.naturezaOperacao.findUnique({ where: { id }, select: { ativo: true } })
    if (!atual) return reply.code(404).send({ error: 'Natureza de operação não encontrada.' })
    return prisma.naturezaOperacao.update({ where: { id }, data: { ativo: !atual.ativo } })
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const natureza = await prisma.naturezaOperacao.findUnique({
      where: { id },
      include: { _count: { select: { pedidosVenda: true } } },
    })
    if (!natureza) return reply.code(404).send({ error: 'Natureza de operação não encontrada.' })
    if (natureza._count.pedidosVenda > 0) {
      return reply.code(409).send({ error: 'Natureza usada em pedidos — desative-a em vez de excluir.' })
    }
    await prisma.naturezaOperacao.delete({ where: { id } })
    return reply.code(204).send()
  })
}
