import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { z } from 'zod'
import { CriarProdutoSchema, AtualizarProdutoSchema } from '@erp/shared'
import { requirePerfil } from '../../plugins/auth.plugin.js'

const QueryProdutosSchema = z.object({
  busca: z.string().max(100).optional(),
  tipo: z.enum(['INSUMO', 'PRODUTO_ACABADO', 'INSUMO_PRODUTO']).optional(),
  categoria: z.enum([
    'FARINHA', 'GORDURA', 'ACUCAR', 'FERMENTO', 'LATICINIOS', 'OVOS', 'EMBALAGEM',
    'PAO', 'BOLO', 'DOCE', 'SALGADO', 'MASSA', 'RECHEIO', 'OUTROS',
  ]).optional(),
  mostrarInativos: z.enum(['true', 'false']).optional(),
})

export async function produtosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'VENDAS', 'ESTOQUE', 'PRODUCAO', 'FINANCEIRO'))

  app.get('/', async (request) => {
    const { busca, tipo, categoria, mostrarInativos } = QueryProdutosSchema.parse(request.query)

    return prisma.produto.findMany({
      where: {
        ...(mostrarInativos !== 'true' && { ativo: true }),
        ...(busca && { nome: { contains: busca, mode: 'insensitive' } }),
        ...(tipo && { tipo }),
        ...(categoria && { categoria }),
      },
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
      include: { fichaTecnica: { select: { nome: true } } },
    })
    if (!produto) return reply.code(404).send({ error: 'Produto não encontrado' })
    return produto
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
    return prisma.produto.update({ where: { id }, data: data as never })
  })

  app.patch('/:id/toggle-ativo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const atual = await prisma.produto.findUnique({ where: { id }, select: { ativo: true } })
    if (!atual) return reply.code(404).send({ error: 'Produto não encontrado' })
    return prisma.produto.update({ where: { id }, data: { ativo: !atual.ativo } })
  })
}
