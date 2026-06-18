import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { z } from 'zod'
import { CriarPedidoVendaSchema, AtualizarStatusPedidoSchema } from '@erp/shared'
import { requirePerfil } from '../../plugins/auth.plugin.js'

const QueryPedidosSchema = z.object({
  status: z.enum(['ABERTO', 'CONFIRMADO', 'EM_PREPARO', 'ENTREGUE', 'CANCELADO']).optional(),
  canal: z.enum(['BALCAO', 'ATACADO', 'DELIVERY', 'ONLINE']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(50),
})

export async function vendasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'VENDAS'))

  // Pedidos de Venda
  app.get('/pedidos', async (request) => {
    const { status, canal, pagina, limite } = QueryPedidosSchema.parse(request.query)
    return prisma.pedidoVenda.findMany({
      where: {
        ...(status && { status }),
        ...(canal && { canal }),
      },
      include: {
        pessoa: { select: { nome: true } },
        itens: { include: { produto: { select: { nome: true } } } },
      },
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite,
    })
  })

  app.get('/pedidos/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const pedido = await prisma.pedidoVenda.findUnique({
      where: { id },
      include: {
        pessoa: true,
        itens: { include: { produto: true } },
        vendedor: { select: { nome: true } },
      },
    })
    if (!pedido) return reply.code(404).send({ error: 'Pedido não encontrado' })
    return pedido
  })

  app.post('/pedidos', async (request, reply) => {
    const { itens, ...pedidoData } = CriarPedidoVendaSchema.parse(request.body)

    const subtotal = itens.reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0)
    const desconto = pedidoData.desconto ?? 0
    const total = subtotal - desconto

    const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('pedido_venda_numero_seq')
    `
    const numero = `PV${String(Number(nextval)).padStart(7, '0')}`

    const pedido = await prisma.pedidoVenda.create({
      data: {
        ...pedidoData as never,
        numero,
        subtotal,
        desconto,
        total,
        status: 'ABERTO',
        itens: {
          create: itens.map(i => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            precoUnitario: i.precoUnitario,
            desconto: i.desconto ?? 0,
            subtotal: i.quantidade * i.precoUnitario - (i.desconto ?? 0),
          })),
        },
      },
      include: { itens: true },
    })

    return reply.code(201).send(pedido)
  })

  app.patch('/pedidos/:id/status', async (request) => {
    const { id } = request.params as { id: string }
    const { status } = AtualizarStatusPedidoSchema.parse(request.body)
    return prisma.pedidoVenda.update({ where: { id }, data: { status } })
  })

  // Dashboard de vendas
  app.get('/dashboard', async () => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const [totalHoje, pedidosHoje, topProdutos] = await Promise.all([
      prisma.pedidoVenda.aggregate({
        where: { criadoEm: { gte: hoje }, status: { not: 'CANCELADO' } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.pedidoVenda.count({ where: { criadoEm: { gte: hoje } } }),
      prisma.itemPedidoVenda.groupBy({
        by: ['produtoId'],
        where: { pedidoVenda: { criadoEm: { gte: hoje } } },
        _sum: { quantidade: true },
        orderBy: { _sum: { quantidade: 'desc' } },
        take: 5,
      }),
    ])

    return {
      vendasHoje: {
        total: totalHoje._sum.total ?? 0,
        pedidos: totalHoje._count,
      },
      pedidosHoje,
      topProdutos,
    }
  })
}
