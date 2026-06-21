import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { requirePerfil } from '../../plugins/auth.plugin.js'

export async function categoriasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'PRODUCAO', 'ESTOQUE'))

  app.get('/', async () => {
    return prisma.categoria.findMany({
      orderBy: { nome: 'asc' },
      include: { _count: { select: { produtos: true, fichasTecnicas: true } } },
    })
  })

  app.post('/', async (request, reply) => {
    const { nome } = request.body as { nome: string }
    if (!nome?.trim()) return reply.code(400).send({ error: 'Nome é obrigatório.' })
    const categoria = await prisma.categoria.create({
      data: { nome: nome.trim() },
    })
    return reply.code(201).send(categoria)
  })

  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { nome, ativo } = request.body as { nome?: string; ativo?: boolean }
    if (nome !== undefined && !nome.trim()) return reply.code(400).send({ error: 'Nome é obrigatório.' })
    return prisma.categoria.update({
      where: { id },
      data: {
        ...(nome !== undefined && { nome: nome.trim() }),
        ...(ativo !== undefined && { ativo }),
      },
    })
  })

  app.patch('/:id/toggle-ativo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const atual = await prisma.categoria.findUnique({ where: { id }, select: { ativo: true } })
    if (!atual) return reply.code(404).send({ error: 'Categoria não encontrada.' })
    return prisma.categoria.update({ where: { id }, data: { ativo: !atual.ativo } })
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existe = await prisma.categoria.findUnique({ where: { id }, select: { id: true } })
    if (!existe) return reply.code(404).send({ error: 'Categoria não encontrada.' })
    // A FK tem ON DELETE SET NULL — produtos e fichas ficam com categoriaId = null automaticamente
    await prisma.categoria.delete({ where: { id } })
    return reply.code(204).send()
  })
}
