import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { z } from 'zod'
import { CriarPedidoVendaSchema, AtualizarStatusPedidoSchema } from '@erp/shared'
import { requirePerfil } from '../../plugins/auth.plugin.js'
import { permiteEstoqueNegativo } from '../estoque/config-estoque.js'

const QueryPedidosSchema = z.object({
  status: z.enum(['ABERTO', 'CONFIRMADO', 'EM_PREPARO', 'ENTREGUE', 'CANCELADO']).optional(),
  canal: z.enum(['BALCAO', 'ATACADO', 'DELIVERY', 'ONLINE']).optional(),
  pessoaId: z.string().uuid().optional(),
  busca: z.string().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  estoqueElancado: z.enum(['true', 'false']).optional(),
  financeiroLancado: z.enum(['true', 'false']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(200).default(100),
})

export async function vendasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'VENDAS'))

  // Pedidos de Venda
  app.get('/pedidos', async (request) => {
    const { status, canal, pessoaId, pagina, limite } = QueryPedidosSchema.parse(request.query)
    return prisma.pedidoVenda.findMany({
      where: {
        ...(status && { status }),
        ...(canal && { canal }),
        ...(pessoaId && { pessoaId }),
      },
      include: {
        pessoa: { select: { nome: true } },
        itens: { include: { produto: { select: { nome: true } } } },
        notasFiscais: { select: { id: true, modelo: true, status: true, numero: true }, orderBy: { dataEmissao: 'desc' } },
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
    const { itens, parcelas, ...pedidoData } = CriarPedidoVendaSchema.parse(request.body)

    const r2 = (n: number) => Number(n.toFixed(2))
    // subtotal = soma bruta dos produtos (= vProd na NF-e); descontos (item + geral) e
    // frete/seguro/outros compõem o total da nota.
    const subtotal = r2(itens.reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0))
    const descontoItens = r2(itens.reduce((acc, i) => acc + (i.desconto ?? 0), 0))
    const descontoGeral = pedidoData.desconto ?? 0
    const total = r2(subtotal - descontoItens - descontoGeral
      + (pedidoData.vFrete ?? 0) + (pedidoData.vSeguro ?? 0) + (pedidoData.vOutros ?? 0))

    if (total < 0) {
      return reply.code(400).send({ error: 'O total do pedido não pode ser negativo. Revise os descontos.' })
    }

    // Snapshot do texto da natureza (natOp da NF-e) a partir do cadastro selecionado
    let naturezaOperacao = pedidoData.naturezaOperacao
    if (pedidoData.naturezaOperacaoId) {
      const nat = await prisma.naturezaOperacao.findUnique({
        where: { id: pedidoData.naturezaOperacaoId }, select: { descricao: true },
      })
      if (nat) naturezaOperacao = nat.descricao
    }

    const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('pedido_venda_numero_seq')
    `
    const numero = String(Number(nextval)).padStart(6, '0')

    // Parcelas (duplicatas) — guardadas como snapshot JSON no pedido; viram títulos/duplicatas na emissão
    const parcelasJson = parcelas && parcelas.length > 0 ? JSON.stringify(parcelas) : null

    const pedido = await prisma.pedidoVenda.create({
      data: {
        ...pedidoData as never,
        naturezaOperacao,
        numero,
        subtotal,
        desconto: descontoGeral,
        total,
        parcelasJson,
        status: 'ABERTO',
        itens: {
          create: itens.map(i => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            precoUnitario: i.precoUnitario,
            desconto: i.desconto ?? 0,
            subtotal: r2(i.quantidade * i.precoUnitario - (i.desconto ?? 0)),
          })),
        },
      },
      include: { itens: true },
    })

    return reply.code(201).send(pedido)
  })

  app.put('/pedidos/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existente = await prisma.pedidoVenda.findUnique({ where: { id }, select: { id: true, estoqueElancado: true, financeiroLancado: true } })
    if (!existente) return reply.code(404).send({ error: 'Pedido não encontrado' })
    if (existente.estoqueElancado || existente.financeiroLancado) {
      return reply.code(409).send({ error: 'Pedido com lançamentos não pode ser editado. Estorne os lançamentos primeiro.' })
    }

    const { itens, parcelas, ...pedidoData } = CriarPedidoVendaSchema.parse(request.body)

    const r2 = (n: number) => Number(n.toFixed(2))
    const subtotal = r2(itens.reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0))
    const descontoItens = r2(itens.reduce((acc, i) => acc + (i.desconto ?? 0), 0))
    const descontoGeral = pedidoData.desconto ?? 0
    const total = r2(subtotal - descontoItens - descontoGeral
      + (pedidoData.vFrete ?? 0) + (pedidoData.vSeguro ?? 0) + (pedidoData.vOutros ?? 0))
    if (total < 0) {
      return reply.code(400).send({ error: 'O total do pedido não pode ser negativo. Revise os descontos.' })
    }

    let naturezaOperacao = pedidoData.naturezaOperacao
    if (pedidoData.naturezaOperacaoId) {
      const nat = await prisma.naturezaOperacao.findUnique({
        where: { id: pedidoData.naturezaOperacaoId }, select: { descricao: true },
      })
      if (nat) naturezaOperacao = nat.descricao
    }
    const parcelasJson = parcelas && parcelas.length > 0 ? JSON.stringify(parcelas) : null

    // Substitui os itens (apaga os antigos e recria) e atualiza o cabeçalho
    const pedido = await prisma.$transaction(async (tx) => {
      await tx.itemPedidoVenda.deleteMany({ where: { pedidoVendaId: id } })
      return tx.pedidoVenda.update({
        where: { id },
        data: {
          ...pedidoData as never,
          naturezaOperacao,
          subtotal,
          desconto: descontoGeral,
          total,
          parcelasJson,
          itens: {
            create: itens.map(i => ({
              produtoId: i.produtoId,
              quantidade: i.quantidade,
              precoUnitario: i.precoUnitario,
              desconto: i.desconto ?? 0,
              subtotal: r2(i.quantidade * i.precoUnitario - (i.desconto ?? 0)),
            })),
          },
        },
        include: { itens: true },
      })
    })
    return pedido
  })

  app.delete('/pedidos/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const pedido = await prisma.pedidoVenda.findUnique({
      where: { id },
      include: { _count: { select: { notasFiscais: true } } },
    })
    if (!pedido) return reply.code(404).send({ error: 'Pedido não encontrado' })
    if (pedido._count.notasFiscais > 0) {
      return reply.code(409).send({ error: 'Pedido com NF-e vinculada — cancele a nota antes de excluir.' })
    }
    if (pedido.estoqueElancado) {
      return reply.code(409).send({ error: 'Pedido com estoque lançado — estorne o estoque antes de excluir.' })
    }
    if (pedido.financeiroLancado) {
      return reply.code(409).send({ error: 'Pedido com financeiro lançado — estorne o financeiro antes de excluir.' })
    }
    await prisma.$transaction([
      prisma.itemPedidoVenda.deleteMany({ where: { pedidoVendaId: id } }),
      prisma.pedidoVenda.delete({ where: { id } }),
    ])
    return reply.code(204).send()
  })

  // ── Lançar Estoque ──────────────────────────────────────────────────────────

  app.post('/pedidos/:id/lancar-estoque', async (request, reply) => {
    const { id } = request.params as { id: string }

    const pedido = await prisma.pedidoVenda.findUnique({
      where: { id },
      include: {
        itens: { include: { produto: { select: { id: true, nome: true, estoqueAtual: true, custoMedio: true } } } },
        natureza: { select: { movimentaEstoque: true } },
      },
    })
    if (!pedido) return reply.code(404).send({ error: 'Pedido não encontrado.' })
    if (pedido.estoqueElancado) return reply.code(409).send({ error: 'Estoque já foi lançado para este pedido.' })
    if (pedido.status === 'CANCELADO') return reply.code(400).send({ error: 'Pedido cancelado não pode lançar estoque.' })

    const movimentaEstoque = pedido.natureza?.movimentaEstoque ?? 'SAIDA'
    if (movimentaEstoque === 'NENHUM') {
      return reply.code(400).send({ error: 'A natureza de operação deste pedido não movimenta estoque.' })
    }
    const tipoMov = movimentaEstoque === 'ENTRADA' ? 'ENTRADA' : 'SAIDA'

    if (tipoMov === 'SAIDA' && !(await permiteEstoqueNegativo())) {
      for (const item of pedido.itens) {
        const novoSaldo = Number(item.produto.estoqueAtual) - Number(item.quantidade)
        if (novoSaldo < -0.001) {
          return reply.code(400).send({
            error: `Estoque insuficiente para "${item.produto.nome}": saldo ${Number(item.produto.estoqueAtual).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}, pedido ${Number(item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}. Habilite estoque negativo em Configurações para continuar.`,
          })
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const item of pedido.itens) {
        const qtde = +Number(item.quantidade).toFixed(3)
        const custo = +Number(item.produto.custoMedio).toFixed(4)

        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: item.produtoId,
            pedidoVendaId: id,
            tipo: tipoMov,
            quantidade: qtde,
            custoUnitario: custo,
            observacao: `Venda Pedido ${pedido.numero} — ${item.produto.nome}`,
          },
        })
        await tx.produto.update({
          where: { id: item.produtoId },
          data: { estoqueAtual: tipoMov === 'SAIDA' ? { decrement: qtde } : { increment: qtde } },
        })
      }
      await tx.pedidoVenda.update({ where: { id }, data: { estoqueElancado: true } })
    })

    return { ok: true }
  })

  // ── Estornar Estoque ─────────────────────────────────────────────────────────

  app.post('/pedidos/:id/estornar-estoque', async (request, reply) => {
    const { id } = request.params as { id: string }

    const pedido = await prisma.pedidoVenda.findUnique({
      where: { id },
      select: { id: true, numero: true, estoqueElancado: true },
    })
    if (!pedido) return reply.code(404).send({ error: 'Pedido não encontrado.' })
    if (!pedido.estoqueElancado) return reply.code(409).send({ error: 'Estoque não foi lançado para este pedido.' })

    // Busca apenas os movimentos originais (SAIDA/ENTRADA), não os estornos (AJUSTE) anteriores
    const movimentos = await prisma.movimentacaoEstoque.findMany({
      where: { pedidoVendaId: id, tipo: { in: ['SAIDA', 'ENTRADA'] } },
    })

    await prisma.$transaction(async (tx) => {
      for (const mov of movimentos) {
        const qtde = +Number(mov.quantidade).toFixed(3)
        const custo = +Number(mov.custoUnitario ?? 0).toFixed(4)

        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: mov.produtoId,
            pedidoVendaId: id,
            tipo: 'AJUSTE',
            // SAIDA reduziu → estorno aumenta (+); ENTRADA aumentou → estorno reduz (-)
            quantidade: mov.tipo === 'SAIDA' ? qtde : -qtde,
            custoUnitario: custo,
            observacao: `Estorno venda Pedido ${pedido.numero}`,
          },
        })
        await tx.produto.update({
          where: { id: mov.produtoId },
          data: { estoqueAtual: mov.tipo === 'SAIDA' ? { increment: qtde } : { decrement: qtde } },
        })
      }

      await tx.movimentacaoEstoque.deleteMany({
        where: { pedidoVendaId: id, tipo: { in: ['SAIDA', 'ENTRADA'] } },
      })
      await tx.pedidoVenda.update({ where: { id }, data: { estoqueElancado: false } })
    })

    return { ok: true }
  })

  // ── Lançar Financeiro ────────────────────────────────────────────────────────

  app.post('/pedidos/:id/lancar-financeiro', async (request, reply) => {
    const { id } = request.params as { id: string }

    const pedido = await prisma.pedidoVenda.findUnique({
      where: { id },
      select: {
        id: true, numero: true, pessoaId: true, total: true,
        financeiroLancado: true, parcelasJson: true, status: true,
        dataEmissao: true, naturezaOperacaoId: true,
        natureza: { select: { geraFinanceiro: true, contaFinanceiraId: true } },
      },
    })
    if (!pedido) return reply.code(404).send({ error: 'Pedido não encontrado.' })
    if (pedido.financeiroLancado) return reply.code(409).send({ error: 'Financeiro já lançado para este pedido.' })
    if (pedido.status === 'CANCELADO') return reply.code(400).send({ error: 'Pedido cancelado não pode lançar financeiro.' })

    if (pedido.natureza && !pedido.natureza.geraFinanceiro) {
      return reply.code(400).send({ error: 'A natureza de operação deste pedido não gera financeiro.' })
    }

    type ParcelaP = { numero: string; vencimento: string; valor: number; meioPagamento?: string }
    const totalNf = Number(pedido.total)
    const vencPadrao = pedido.dataEmissao
      ? new Date(pedido.dataEmissao).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)

    let parcelas: ParcelaP[] = pedido.parcelasJson
      ? JSON.parse(pedido.parcelasJson)
      : []

    // Filtra parcelas sem vencimento e descarta se todas tiverem valor zerado
    parcelas = parcelas.filter(p => p.vencimento && Number(p.valor) > 0)
    if (parcelas.length === 0) {
      parcelas = [{ numero: '001', vencimento: vencPadrao, valor: totalNf, meioPagamento: 'A VISTA' }]
    }

    const totalParcelas = parcelas.reduce((s, p) => s + Number(p.valor), 0)
    const contaFinanceiraId = pedido.natureza?.contaFinanceiraId ?? null

    await prisma.tituloFinanceiro.create({
      data: {
        tipo: 'RECEBER',
        descricao: `Venda Pedido ${pedido.numero}`,
        documento: String(pedido.numero),
        total: totalParcelas,
        pessoaId: pedido.pessoaId || null,
        pedidoVendaId: id,
        contaFinanceiraId,
        status: 'ABERTO',
        parcelas: {
          create: parcelas.map((p, idx) => ({
            numero: idx + 1,
            valor: p.valor,
            vencimento: new Date(p.vencimento),
            status: 'ABERTO',
            observacao: p.numero ? `Dup. ${p.numero}` : null,
          })),
        },
      },
    })

    await prisma.pedidoVenda.update({ where: { id }, data: { financeiroLancado: true } })
    return { ok: true }
  })

  // ── Estornar Financeiro ──────────────────────────────────────────────────────

  app.post('/pedidos/:id/estornar-financeiro', async (request, reply) => {
    const { id } = request.params as { id: string }

    const pedido = await prisma.pedidoVenda.findUnique({
      where: { id },
      include: { titulos: { include: { parcelas: true } } },
    })
    if (!pedido) return reply.code(404).send({ error: 'Pedido não encontrado.' })
    if (!pedido.financeiroLancado) return reply.code(409).send({ error: 'Financeiro não foi lançado para este pedido.' })

    const parcelasQuitadas = pedido.titulos.flatMap(t => t.parcelas).filter(p => p.status === 'QUITADO')
    if (parcelasQuitadas.length > 0) {
      return reply.code(409).send({ error: `Não é possível estornar: ${parcelasQuitadas.length} parcela(s) já estão quitadas.` })
    }

    await prisma.$transaction(async (tx) => {
      const tituloIds = pedido.titulos.map(t => t.id)
      await tx.parcelaFinanceira.deleteMany({ where: { tituloId: { in: tituloIds } } })
      await tx.tituloFinanceiro.deleteMany({ where: { pedidoVendaId: id } })
      await tx.pedidoVenda.update({ where: { id }, data: { financeiroLancado: false } })
    })

    return { ok: true }
  })

  // Resumo de crédito do cliente (limite + a receber em aberto) — para o painel do pedido
  app.get('/clientes/:id/credito', async (request, reply) => {
    const { id } = request.params as { id: string }
    const pessoa = await prisma.pessoa.findUnique({
      where: { id }, select: { id: true, limiteCredito: true },
    })
    if (!pessoa) return reply.code(404).send({ error: 'Cliente não encontrado.' })

    const aberto = await prisma.parcelaFinanceira.aggregate({
      where: { status: 'ABERTO', titulo: { tipo: 'RECEBER', pessoaId: id } },
      _sum: { valor: true },
    })
    const limite = Number(pessoa.limiteCredito ?? 0)
    const totalAberto = Number(aberto._sum.valor ?? 0)
    return { limiteCredito: limite, totalAberto, disponivel: limite - totalAberto }
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
