import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { z } from 'zod'
import { requirePerfil } from '../../plugins/auth.plugin.js'
import { permiteEstoqueNegativo } from '../estoque/config-estoque.js'

const TurnoEnum = z.enum(['MANHA', 'TARDE', 'NOITE'])

const CriarOrdemSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.number().positive(),
  turno: TurnoEnum,
  dataProducao: z.string().min(1),
  responsavelId: z.string().uuid().optional(),
  observacao: z.string().max(500).optional(),
})

const AtualizarOrdemSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.number().positive(),
  turno: TurnoEnum,
  dataProducao: z.string().min(1),
  observacao: z.string().max(500).optional(),
})

const ApontarSchema = z.object({
  quantidade: z.number().positive(),
  observacao: z.string().max(500).optional(),
  // Consumo real por componente (sobrescreve o teórico do BOM) — variância de produção
  consumos: z.array(z.object({
    componenteId: z.string().uuid(),
    quantidade: z.number().min(0),
  })).optional(),
})

export async function producaoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'PRODUCAO'))

  // Explosão via BOM do produto
  app.get('/bom/:produtoId/explosao', async (request, reply) => {
    const { produtoId } = request.params as { produtoId: string }
    const { quantidade } = request.query as { quantidade?: string }
    const qtd = Number(quantidade ?? 1)

    const bom = await prisma.produtoBom.findUnique({
      where: { produtoId },
      include: {
        produto: { select: { nome: true } },
        itens: {
          include: { componente: { select: { nome: true, estoqueAtual: true, unidadeMedida: true } } },
          orderBy: { ordem: 'asc' },
        },
      },
    })

    if (!bom) return reply.code(404).send({ error: 'BOM não cadastrada para este produto' })

    const fator = qtd / Number(bom.qtdeProduzida)
    const explosao = bom.itens.map(item => {
      const necessario = Number(item.quantidade) * fator * (1 + Number(item.percPerda) / 100)
      return {
        componenteId: item.componenteId,
        insumo: item.componente.nome,
        necessario,
        unidade: item.unidade,
        disponivel: Number(item.componente.estoqueAtual),
        suficiente: Number(item.componente.estoqueAtual) >= necessario,
      }
    })

    return { produto: bom.produto.nome, loteBom: Number(bom.qtdeProduzida), quantidade: qtd, explosao }
  })

  // Info do BOM de um produto
  app.get('/bom/:produtoId', async (request, reply) => {
    const { produtoId } = request.params as { produtoId: string }
    const bom = await prisma.produtoBom.findUnique({
      where: { produtoId },
      select: { id: true, qtdeProduzida: true, unidadeProduzida: true },
    })
    if (!bom) return reply.code(404).send({ error: 'BOM não cadastrada' })
    return bom
  })

  // Ordens de Produção
  app.get('/ordens', async (request) => {
    const { status, data } = request.query as { status?: string; data?: string }
    return prisma.ordemProducao.findMany({
      where: {
        ...(status && { status: status as never }),
        ...(data && { dataProducao: { gte: new Date(data) } }),
      },
      include: {
        produto: { select: { nome: true } },
        responsavel: { select: { nome: true } },
      },
      orderBy: { dataProducao: 'asc' },
    })
  })

  app.post('/ordens', async (request, reply) => {
    const data = CriarOrdemSchema.parse(request.body)

    const bom = await prisma.produtoBom.findUnique({ where: { produtoId: data.produtoId } })
    if (!bom) return reply.code(400).send({ error: 'Produto não possui composição BOM cadastrada.' })

    const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('ordem_producao_numero_seq')`
    const numero = String(Number(nextval)).padStart(6, '0')
    const { dataProducao, ...rest } = data

    const ordem = await prisma.ordemProducao.create({
      data: { ...rest, dataProducao: new Date(dataProducao), numero, status: 'PLANEJADA' } as never,
      include: { produto: { select: { nome: true } } },
    })

    return reply.code(201).send(ordem)
  })

  app.put('/ordens/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = AtualizarOrdemSchema.parse(request.body)

    const atual = await prisma.ordemProducao.findUnique({ where: { id }, select: { status: true } })
    if (!atual || atual.status !== 'PLANEJADA') {
      return reply.code(400).send({ error: 'Apenas ordens com status PLANEJADA podem ser editadas.' })
    }

    const bom = await prisma.produtoBom.findUnique({ where: { produtoId: data.produtoId } })
    if (!bom) return reply.code(400).send({ error: 'Produto não possui composição BOM cadastrada.' })

    const { dataProducao, ...rest } = data
    const ordem = await prisma.ordemProducao.update({
      where: { id },
      data: { ...rest, dataProducao: new Date(dataProducao) } as never,
      include: { produto: { select: { nome: true } } },
    })

    return reply.send(ordem)
  })

  app.patch('/ordens/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: string }

    // Iniciar produção: apenas muda status
    if (status === 'EM_PRODUCAO') {
      const ordem = await prisma.ordemProducao.update({
        where: { id },
        data: { status: 'EM_PRODUCAO' },
      })
      return ordem
    }

    // Cancelar: estorna todos os apontamentos abertos antes de cancelar
    if (status === 'CANCELADA') {
      await estornarTodosApontamentos(id, 'Estorno automático — cancelamento da OP')
      const ordem = await prisma.ordemProducao.update({
        where: { id },
        data: { status: 'CANCELADA' },
      })
      return ordem
    }

    return reply.code(400).send({ error: 'Transição de status inválida.' })
  })

  // Registrar apontamento de produção
  app.post('/ordens/:id/apontar', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { quantidade, observacao, consumos } = ApontarSchema.parse(request.body)

    const ordem = await prisma.ordemProducao.findUnique({
      where: { id },
      select: { id: true, numero: true, produtoId: true, quantidade: true, quantidadeProduzida: true, status: true },
    })

    if (!ordem) return reply.code(404).send({ error: 'Ordem não encontrada.' })
    if (ordem.status !== 'EM_PRODUCAO') {
      return reply.code(400).send({ error: 'O apontamento só pode ser feito em ordens com status EM PRODUÇÃO.' })
    }

    const restante = Number(ordem.quantidade) - Number(ordem.quantidadeProduzida)
    if (quantidade > restante + 0.001) {
      return reply.code(400).send({ error: `Quantidade excede o restante a produzir (${restante.toFixed(3)}).` })
    }

    const bom = await prisma.produtoBom.findUnique({
      where: { produtoId: ordem.produtoId },
      include: { itens: true },
    })
    if (!bom) return reply.code(400).send({ error: 'Produto não possui composição BOM — apontamento não pode gerar movimentações.' })

    const fator = quantidade / Number(bom.qtdeProduzida)
    const novoTotal = Number(ordem.quantidadeProduzida) + quantidade
    const concluida = novoTotal >= Number(ordem.quantidade) - 0.001
    const obs = `Apontamento OP ${ordem.numero}${observacao ? ' — ' + observacao : ''}`

    // Custos e saldos atuais. O custo vai como snapshot na movimentação (rastreio);
    // o saldo é usado para validar estoque negativo dos componentes.
    const idsCusto = [ordem.produtoId, ...bom.itens.map(i => i.componenteId)]
    const custosProd = await prisma.produto.findMany({
      where: { id: { in: idsCusto } },
      select: { id: true, nome: true, custoUnitario: true, estoqueAtual: true },
    })
    const custoDe = (pid: string) => +Number(custosProd.find(c => c.id === pid)?.custoUnitario ?? 0).toFixed(4)

    // Plano de consumo: teórico (BOM × fator × perda) ou consumo real informado (#4)
    const overrideDe = new Map((consumos ?? []).map(c => [c.componenteId, c.quantidade]))
    const plano = bom.itens.map(item => {
      const teorico = +(Number(item.quantidade) * fator * (1 + Number(item.percPerda) / 100)).toFixed(4)
      const consumo = overrideDe.has(item.componenteId) ? +Number(overrideDe.get(item.componenteId)).toFixed(4) : teorico
      const comp = custosProd.find(c => c.id === item.componenteId)
      return {
        componenteId: item.componenteId,
        nome: comp?.nome ?? item.componenteId,
        consumo,
        custo: custoDe(item.componenteId),
        saldo: Number(comp?.estoqueAtual ?? 0),
      }
    })

    // Bloqueia o apontamento se faltar estoque de algum componente (config NAO permite negativo)
    if (!(await permiteEstoqueNegativo())) {
      const faltantes = plano
        .filter(p => p.saldo - p.consumo < -0.0001)
        .map(p => `${p.nome} (precisa ${p.consumo.toFixed(3)}, tem ${p.saldo.toFixed(3)})`)
      if (faltantes.length > 0) {
        return reply.code(400).send({
          error: `Estoque insuficiente para: ${faltantes.join('; ')}. Habilite "estoque negativo" em Configurações > Estoque para permitir.`,
        })
      }
    }

    // Custo real do lote (#2-A): soma do custo dos componentes efetivamente consumidos.
    // Gravado como snapshot na entrada do acabado; NÃO altera o custoUnitario (padrão do BOM).
    const custoRealLote = +plano.reduce((s, p) => s + p.consumo * p.custo, 0).toFixed(4)
    const custoRealUnit = quantidade > 0 ? +(custoRealLote / quantidade).toFixed(4) : custoDe(ordem.produtoId)
    const custoPadraoUnit = custoDe(ordem.produtoId)

    const apontamento = await prisma.$transaction(async (tx) => {
      // Cria o registro do apontamento (com o custo real do lote)
      const apt = await tx.apontamentoProducao.create({
        data: { ordemProducaoId: id, quantidade, custoReal: custoRealLote, observacao },
      })

      // Entrada do produto acabado (custo = custo real do lote consumido)
      await tx.movimentacaoEstoque.create({
        data: { produtoId: ordem.produtoId, apontamentoId: apt.id, tipo: 'ENTRADA', quantidade, custoUnitario: custoRealUnit, observacao: obs },
      })
      await tx.produto.update({
        where: { id: ordem.produtoId },
        data: { estoqueAtual: { increment: quantidade } },
      })

      // Saída de cada componente (consumo real ou teórico), com custo snapshot
      for (const p of plano) {
        if (p.consumo <= 0) continue
        await tx.movimentacaoEstoque.create({
          data: { produtoId: p.componenteId, apontamentoId: apt.id, tipo: 'SAIDA', quantidade: p.consumo, custoUnitario: p.custo, observacao: obs },
        })
        await tx.produto.update({
          where: { id: p.componenteId },
          data: { estoqueAtual: { decrement: p.consumo } },
        })
      }

      // Atualiza OP (quantidade + custo real acumulado do lote)
      await tx.ordemProducao.update({
        where: { id },
        data: {
          quantidadeProduzida: novoTotal,
          status: concluida ? 'CONCLUIDA' : 'EM_PRODUCAO',
          custoRealTotal: { increment: custoRealLote },
        },
      })

      return apt
    })

    return reply.code(201).send({
      apontamentoId: apontamento.id,
      concluida,
      quantidadeProduzida: novoTotal,
      // Custo real do lote vs padrão do BOM (variância de produção)
      custoRealLote,
      custoRealUnit,
      custoPadraoUnit,
      custoPadraoLote: +(custoPadraoUnit * quantidade).toFixed(4),
      variancia: +(custoRealLote - custoPadraoUnit * quantidade).toFixed(4),
    })
  })

  // Listar apontamentos de uma ordem
  app.get('/ordens/:id/apontamentos', async (request, reply) => {
    const { id } = request.params as { id: string }
    const apontamentos = await prisma.apontamentoProducao.findMany({
      where: { ordemProducaoId: id },
      include: { movimentacoes: { select: { id: true, tipo: true, quantidade: true, produto: { select: { nome: true } } } } },
      orderBy: { criadoEm: 'asc' },
    })
    return apontamentos
  })

  // Estornar um apontamento específico
  app.post('/ordens/:ordemId/apontamentos/:apontamentoId/estornar', async (request, reply) => {
    const { ordemId, apontamentoId } = request.params as { ordemId: string; apontamentoId: string }
    const { observacao } = request.body as { observacao?: string }

    const apontamento = await prisma.apontamentoProducao.findUnique({
      where: { id: apontamentoId },
      include: { movimentacoes: { include: { produto: true } } },
    })

    if (!apontamento || apontamento.ordemProducaoId !== ordemId) {
      return reply.code(404).send({ error: 'Apontamento não encontrado.' })
    }
    if (apontamento.estornado) {
      return reply.code(400).send({ error: 'Este apontamento já foi estornado.' })
    }

    const obs = `Estorno — ${observacao ?? 'Correção de lançamento'} (Apontamento ${apontamentoId.slice(0, 8)})`

    await prisma.$transaction(async (tx) => {
      // Cria movimentações inversas para cada movimentação original
      for (const mov of apontamento.movimentacoes) {
        const tipoInverso = mov.tipo === 'ENTRADA' ? 'SAIDA' : 'ENTRADA'
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: mov.produtoId,
            apontamentoId: apontamentoId, // vincula ao mesmo apontamento para rastreabilidade
            tipo: tipoInverso as never,
            quantidade: mov.quantidade,
            custoUnitario: mov.custoUnitario,
            observacao: obs,
          },
        })
        const delta = tipoInverso === 'ENTRADA' ? Number(mov.quantidade) : -Number(mov.quantidade)
        await tx.produto.update({
          where: { id: mov.produtoId },
          data: { estoqueAtual: { increment: delta } },
        })
      }

      // Marca o apontamento como estornado
      await tx.apontamentoProducao.update({
        where: { id: apontamentoId },
        data: { estornado: true, estornadoEm: new Date(), observacaoEstorno: observacao },
      })

      // Recalcula quantidadeProduzida e reverte status se necessário
      const ordem = await tx.ordemProducao.findUniqueOrThrow({
        where: { id: ordemId },
        include: { apontamentos: { where: { estornado: false } } },
      })
      const novoTotal = ordem.apontamentos.reduce((acc, a) => acc + Number(a.quantidade), 0)
      const novoCustoReal = ordem.apontamentos.reduce((acc, a) => acc + Number(a.custoReal), 0)
      await tx.ordemProducao.update({
        where: { id: ordemId },
        data: {
          quantidadeProduzida: novoTotal,
          custoRealTotal: +novoCustoReal.toFixed(4),
          status: ordem.status === 'CONCLUIDA' ? 'EM_PRODUCAO' : undefined,
        },
      })
    })

    return reply.send({ ok: true })
  })
}

async function estornarTodosApontamentos(ordemId: string, motivoCancelamento: string) {
  const apontamentos = await prisma.apontamentoProducao.findMany({
    where: { ordemProducaoId: ordemId, estornado: false },
    include: { movimentacoes: true },
  })

  if (apontamentos.length === 0) return

  await prisma.$transaction(async (tx) => {
    for (const apt of apontamentos) {
      for (const mov of apt.movimentacoes) {
        // Só estorna movimentações originais (não as que já são estornos)
        if (mov.observacao?.startsWith('Estorno')) continue
        const tipoInverso = mov.tipo === 'ENTRADA' ? 'SAIDA' : 'ENTRADA'
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: mov.produtoId,
            apontamentoId: apt.id,
            tipo: tipoInverso as never,
            quantidade: mov.quantidade,
            custoUnitario: mov.custoUnitario,
            observacao: `${motivoCancelamento} (Apt. ${apt.id.slice(0, 8)})`,
          },
        })
        const delta = tipoInverso === 'ENTRADA' ? Number(mov.quantidade) : -Number(mov.quantidade)
        await tx.produto.update({
          where: { id: mov.produtoId },
          data: { estoqueAtual: { increment: delta } },
        })
      }
      await tx.apontamentoProducao.update({
        where: { id: apt.id },
        data: { estornado: true, estornadoEm: new Date(), observacaoEstorno: motivoCancelamento },
      })
    }
    await tx.ordemProducao.update({
      where: { id: ordemId },
      data: { quantidadeProduzida: 0, custoRealTotal: 0 },
    })
  })
}

