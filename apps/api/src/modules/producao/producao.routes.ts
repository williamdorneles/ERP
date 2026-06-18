import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { requirePerfil } from '../../plugins/auth.plugin.js'

export async function producaoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'PRODUCAO'))

  // Fichas Técnicas
  app.get('/fichas', async (request) => {
    const { categoria, mostrarInativos } = request.query as { categoria?: string; mostrarInativos?: string }
    return prisma.fichaTecnica.findMany({
      where: {
        ...(mostrarInativos !== 'true' && { ativo: true }),
        ...(categoria && { categoria: categoria as never }),
      },
      include: {
        produto: { select: { id: true, nome: true, codigo: true } },
        ingredientes: {
          include: { produto: { select: { nome: true, codigo: true, unidadeMedida: true, custoUnitario: true } } },
        },
      },
      orderBy: { codigo: 'asc' },
    })
  })

  app.get('/fichas/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const ficha = await prisma.fichaTecnica.findUnique({
      where: { id },
      include: {
        ingredientes: {
          include: { produto: true },
        },
      },
    })
    if (!ficha) return reply.code(404).send({ error: 'Ficha técnica não encontrada' })
    return ficha
  })

  app.post('/fichas', async (request, reply) => {
    const { ingredientes, ...fichaData } = request.body as {
      produtoId: string; categoria: string
      rendimento: number; unidadeRendimento: string
      tempoPreparo?: number; tempoFermentacao?: number; temperaturaForno?: number
      instrucoes?: string
      ingredientes: Array<{ produtoId: string; quantidade: number; unidadeMedida: string; observacao?: string }>
    }

    const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('ficha_tecnica_codigo_seq')`
    const codigo = String(Number(nextval)).padStart(6, '0')

    const ficha = await prisma.fichaTecnica.create({
      data: {
        ...(fichaData as never),
        codigo,
        ingredientes: { create: ingredientes },
      },
      include: { ingredientes: { include: { produto: true } } },
    })

    return reply.code(201).send(ficha)
  })

  app.put('/fichas/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { ingredientes, ...fichaData } = request.body as {
      produtoId: string; categoria: string
      rendimento: number; unidadeRendimento: string
      tempoPreparo?: number; tempoFermentacao?: number; temperaturaForno?: number
      instrucoes?: string
      ingredientes: Array<{ produtoId: string; quantidade: number; unidadeMedida: string; observacao?: string }>
    }

    const ficha = await prisma.$transaction(async (tx) => {
      await tx.ingredienteFicha.deleteMany({ where: { fichaTecnicaId: id } })
      return tx.fichaTecnica.update({
        where: { id },
        data: {
          ...(fichaData as never),
          ingredientes: { create: ingredientes },
        },
        include: { ingredientes: { include: { produto: true } } },
      })
    })

    return ficha
  })

  app.patch('/fichas/:id/toggle-ativo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const atual = await prisma.fichaTecnica.findUnique({ where: { id }, select: { ativo: true } })
    if (!atual) return reply.code(404).send({ error: 'Ficha não encontrada' })
    return prisma.fichaTecnica.update({ where: { id }, data: { ativo: !atual.ativo } })
  })

  // Explosão de receita: calcula a necessidade de MP para N unidades
  app.get('/fichas/:id/explosao', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { quantidade } = request.query as { quantidade?: string }
    const qtd = Number(quantidade ?? 1)

    const ficha = await prisma.fichaTecnica.findUnique({
      where: { id },
      include: {
        produto: { select: { nome: true } },
        ingredientes: {
          include: { produto: { select: { nome: true, estoqueAtual: true, unidadeMedida: true } } },
        },
      },
    })

    if (!ficha) return reply.code(404).send({ error: 'Ficha não encontrada' })

    const fator = qtd / Number(ficha.rendimento)
    const explosao = ficha.ingredientes.map(ing => ({
      insumo: ing.produto.nome,
      necessario: Number(ing.quantidade) * fator,
      unidade: ing.unidadeMedida,
      disponivel: Number(ing.produto.estoqueAtual),
      suficiente: Number(ing.produto.estoqueAtual) >= Number(ing.quantidade) * fator,
    }))

    return { ficha: ficha.produto?.nome ?? ficha.codigo, quantidade: qtd, explosao }
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
        fichaTecnica: { select: { codigo: true, produto: { select: { nome: true } } } },
        responsavel: { select: { nome: true } },
      },
      orderBy: { dataProducao: 'asc' },
    })
  })

  app.post('/ordens', async (request, reply) => {
    const data = request.body as {
      fichaTecnicaId: string; quantidade: number; turno: string
      dataProducao: string; responsavelId?: string; observacao?: string
    }

    const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('ordem_producao_numero_seq')`
    const numero = String(Number(nextval)).padStart(6, '0')
    const { dataProducao, ...rest } = data

    const ordem = await prisma.ordemProducao.create({
      data: { ...rest as never, dataProducao: new Date(dataProducao), numero, status: 'PLANEJADA' },
      include: { fichaTecnica: true },
    })

    return reply.code(201).send(ordem)
  })

  app.put('/ordens/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = request.body as {
      fichaTecnicaId: string; quantidade: number; turno: string
      dataProducao: string; observacao?: string
    }

    const atual = await prisma.ordemProducao.findUnique({ where: { id }, select: { status: true } })
    if (!atual || atual.status !== 'PLANEJADA') {
      return reply.code(400).send({ error: 'Apenas ordens com status PLANEJADA podem ser editadas.' })
    }

    const { dataProducao, ...rest } = data
    const ordem = await prisma.ordemProducao.update({
      where: { id },
      data: { ...rest as never, dataProducao: new Date(dataProducao) },
      include: { fichaTecnica: { include: { produto: { select: { nome: true } } } } },
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
    const { quantidade, observacao } = request.body as { quantidade: number; observacao?: string }

    const ordem = await prisma.ordemProducao.findUnique({
      where: { id },
      include: {
        fichaTecnica: {
          include: {
            produto: true,
            ingredientes: true,
          },
        },
      },
    })

    if (!ordem) return reply.code(404).send({ error: 'Ordem não encontrada.' })
    if (ordem.status !== 'EM_PRODUCAO') {
      return reply.code(400).send({ error: 'O apontamento só pode ser feito em ordens com status EM PRODUÇÃO.' })
    }

    const restante = Number(ordem.quantidade) - Number(ordem.quantidadeProduzida)
    if (quantidade > restante + 0.001) {
      return reply.code(400).send({ error: `Quantidade excede o restante a produzir (${restante.toFixed(3)}).` })
    }

    const ficha = ordem.fichaTecnica
    const fator = quantidade / Number(ficha.rendimento)
    const novoTotal = Number(ordem.quantidadeProduzida) + quantidade
    const concluida = novoTotal >= Number(ordem.quantidade) - 0.001
    const obs = `Apontamento OP ${ordem.numero}${observacao ? ' — ' + observacao : ''}`

    const apontamento = await prisma.$transaction(async (tx) => {
      // Cria o registro do apontamento
      const apt = await tx.apontamentoProducao.create({
        data: { ordemProducaoId: id, quantidade, observacao },
      })

      // Entrada do produto acabado vinculada ao apontamento
      await tx.movimentacaoEstoque.create({
        data: { produtoId: ficha.produtoId, apontamentoId: apt.id, tipo: 'ENTRADA', quantidade, observacao: obs },
      })
      await tx.produto.update({
        where: { id: ficha.produtoId },
        data: { estoqueAtual: { increment: quantidade } },
      })

      // Saída proporcional de cada insumo
      for (const ing of ficha.ingredientes) {
        const consumo = Number(ing.quantidade) * fator
        await tx.movimentacaoEstoque.create({
          data: { produtoId: ing.produtoId, apontamentoId: apt.id, tipo: 'SAIDA', quantidade: consumo, observacao: obs },
        })
        await tx.produto.update({
          where: { id: ing.produtoId },
          data: { estoqueAtual: { decrement: consumo } },
        })
      }

      // Atualiza OP
      await tx.ordemProducao.update({
        where: { id },
        data: { quantidadeProduzida: novoTotal, status: concluida ? 'CONCLUIDA' : 'EM_PRODUCAO' },
      })

      return apt
    })

    return reply.code(201).send({ apontamentoId: apontamento.id, concluida, quantidadeProduzida: novoTotal })
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
      await tx.ordemProducao.update({
        where: { id: ordemId },
        data: {
          quantidadeProduzida: novoTotal,
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
      data: { quantidadeProduzida: 0 },
    })
  })
}

