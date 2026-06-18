import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { requirePerfil } from '../../plugins/auth.plugin.js'

export async function pessoasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'VENDAS', 'FINANCEIRO', 'ESTOQUE'))

  app.get('/', async (request) => {
    const { busca, tipo, mostrarInativos } = request.query as {
      busca?: string; tipo?: string; mostrarInativos?: string
    }

    return prisma.pessoa.findMany({
      where: {
        ...(mostrarInativos !== 'true' && { ativo: true }),
        ...(busca && {
          OR: [
            { nome: { contains: busca, mode: 'insensitive' } },
            { nomeFantasia: { contains: busca, mode: 'insensitive' } },
            { documento: { contains: busca } },
          ],
        }),
        ...(tipo && { tipo: tipo as never }),
      },
      orderBy: { nome: 'asc' },
    })
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const pessoa = await prisma.pessoa.findUnique({ where: { id } })
    if (!pessoa) return reply.code(404).send({ error: 'Pessoa não encontrada' })
    return pessoa
  })

  app.post('/', async (request, reply) => {
    const data = request.body as Record<string, unknown>
    const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('pessoa_codigo_seq')`
    const codigo = String(Number(nextval)).padStart(6, '0')
    const pessoa = await prisma.pessoa.create({ data: { ...data as never, codigo } })
    return reply.code(201).send(pessoa)
  })

  app.put('/:id', async (request) => {
    const { id } = request.params as { id: string }
    const data = request.body as Record<string, unknown>
    return prisma.pessoa.update({ where: { id }, data: data as never })
  })

  app.patch('/:id/toggle-ativo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const atual = await prisma.pessoa.findUnique({ where: { id }, select: { ativo: true } })
    if (!atual) return reply.code(404).send({ error: 'Pessoa não encontrada' })
    return prisma.pessoa.update({ where: { id }, data: { ativo: !atual.ativo } })
  })
}
