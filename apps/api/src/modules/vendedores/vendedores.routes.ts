import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { z } from 'zod'
import { requirePerfil } from '../../plugins/auth.plugin.js'

const VendedorSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório').max(120),
  documento: z.string().max(20).nullish(),
  email: z.string().email('E-mail inválido').max(120).nullish().or(z.literal('')),
  telefone: z.string().max(20).nullish(),
  comissaoPadrao: z.coerce.number().min(0).max(100).nullish(),
  ativo: z.boolean().optional(),
})

// Gera o próximo código sequencial (numérico, sem prefixo) a partir do maior existente.
async function proximoCodigo(): Promise<string> {
  const vendedores = await prisma.vendedor.findMany({ select: { codigo: true } })
  const maior = vendedores.reduce((max, v) => {
    const n = parseInt(v.codigo, 10)
    return Number.isNaN(n) ? max : Math.max(max, n)
  }, 0)
  return String(maior + 1)
}

export async function vendedoresRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'VENDAS'))

  app.get('/', async (request) => {
    const { busca, ativo } = request.query as { busca?: string; ativo?: string }
    return prisma.vendedor.findMany({
      where: {
        ...(ativo !== undefined && { ativo: ativo === 'true' }),
        ...(busca && {
          OR: [
            { nome: { contains: busca, mode: 'insensitive' } },
            { documento: { contains: busca } },
          ],
        }),
      },
      orderBy: { nome: 'asc' },
    })
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const vendedor = await prisma.vendedor.findUnique({ where: { id } })
    if (!vendedor) return reply.code(404).send({ error: 'Vendedor não encontrado.' })
    return vendedor
  })

  app.post('/', async (request, reply) => {
    const data = VendedorSchema.parse(request.body)
    const codigo = await proximoCodigo()
    const vendedor = await prisma.vendedor.create({
      data: {
        codigo,
        nome: data.nome,
        documento: data.documento || null,
        email: data.email || null,
        telefone: data.telefone || null,
        comissaoPadrao: data.comissaoPadrao ?? null,
      },
    })
    return reply.code(201).send(vendedor)
  })

  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = VendedorSchema.partial().parse(request.body)
    const atual = await prisma.vendedor.findUnique({ where: { id }, select: { id: true } })
    if (!atual) return reply.code(404).send({ error: 'Vendedor não encontrado.' })
    return prisma.vendedor.update({
      where: { id },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.documento !== undefined && { documento: data.documento || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.telefone !== undefined && { telefone: data.telefone || null }),
        ...(data.comissaoPadrao !== undefined && { comissaoPadrao: data.comissaoPadrao ?? null }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
    })
  })

  app.patch('/:id/toggle-ativo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const atual = await prisma.vendedor.findUnique({ where: { id }, select: { ativo: true } })
    if (!atual) return reply.code(404).send({ error: 'Vendedor não encontrado.' })
    return prisma.vendedor.update({ where: { id }, data: { ativo: !atual.ativo } })
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const usados = await prisma.pedidoVenda.count({ where: { vendedorId: id } })
    if (usados > 0) {
      return reply.code(409).send({ error: 'Vendedor com pedidos vinculados — desative-o em vez de excluir.' })
    }
    const existe = await prisma.vendedor.findUnique({ where: { id }, select: { id: true } })
    if (!existe) return reply.code(404).send({ error: 'Vendedor não encontrado.' })
    await prisma.vendedor.delete({ where: { id } })
    return reply.code(204).send()
  })
}
