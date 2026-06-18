import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { z } from 'zod'
import { CriarMovimentacaoSchema } from '@erp/shared'
import { requirePerfil } from '../../plugins/auth.plugin.js'

const QueryMovimentacoesSchema = z.object({
  produtoId: z.string().uuid().optional(),
  tipo: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(50),
})

export async function estoqueRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'ESTOQUE', 'PRODUCAO'))

  app.get('/movimentacoes', async (request) => {
    const { produtoId, tipo, pagina, limite } = QueryMovimentacoesSchema.parse(request.query)
    return prisma.movimentacaoEstoque.findMany({
      where: {
        ...(produtoId && { produtoId }),
        ...(tipo && { tipo }),
      },
      include: { produto: { select: { nome: true, codigo: true, unidadeMedida: true } } },
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite,
    })
  })

  app.post('/movimentacoes', async (request, reply) => {
    const data = CriarMovimentacaoSchema.parse(request.body)

    const result = await prisma.$transaction(async (tx) => {
      const mov = await tx.movimentacaoEstoque.create({ data: data as never })

      const delta = data.tipo === 'ENTRADA' ? data.quantidade : -data.quantidade
      await tx.produto.update({
        where: { id: data.produtoId },
        data: { estoqueAtual: { increment: delta } },
      })

      return mov
    })

    return reply.code(201).send(result)
  })

  app.get('/alertas', async () => {
    return prisma.$queryRaw`
      SELECT * FROM produtos
      WHERE ativo = true
      AND tipo IN ('INSUMO', 'INSUMO_PRODUTO')
      AND "estoqueAtual" <= "estoqueMinimo"
    `
  })
}
