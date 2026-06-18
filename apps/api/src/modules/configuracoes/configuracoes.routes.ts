import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { AtualizarConfiguracaoSchema } from '@erp/shared'
import { requirePerfil } from '../../plugins/auth.plugin.js'

export async function configuracoesRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return prisma.configuracao.findMany({ orderBy: { chave: 'asc' } })
  })

  app.get('/:chave', async (request, reply) => {
    const { chave } = request.params as { chave: string }
    const config = await prisma.configuracao.findUnique({ where: { chave } })
    if (!config) return reply.code(404).send({ error: 'Configuração não encontrada' })
    return config
  })

  app.put('/:chave', { preHandler: requirePerfil('ADMIN') }, async (request, reply) => {
    const { chave } = request.params as { chave: string }
    const { valor } = AtualizarConfiguracaoSchema.parse(request.body)
    const existing = await prisma.configuracao.findUnique({ where: { chave } })
    if (!existing) return reply.code(404).send({ error: 'Configuração não encontrada' })
    return prisma.configuracao.update({ where: { chave }, data: { valor } })
  })
}
