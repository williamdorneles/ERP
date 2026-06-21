import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { CriarTituloSchema, AtualizarTituloSchema, BaixarParcelaSchema } from '@erp/shared'
import { requirePerfil } from '../../plugins/auth.plugin.js'

export async function titulosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'FINANCEIRO'))

  // ── Listagem ──────────────────────────────────────────────────

  app.get('/', async (request) => {
    const { tipo, status, pessoaId, vencimentoInicio, vencimentoFim, pagina, limite, vencidos } = request.query as {
      tipo?: string; status?: string; pessoaId?: string
      vencimentoInicio?: string; vencimentoFim?: string
      pagina?: string; limite?: string; vencidos?: string
    }

    const page = Number(pagina ?? 1)
    const lim = Math.min(Number(limite ?? 50), 100)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const where: Record<string, unknown> = {}
    if (tipo) where.tipo = tipo
    if (status) where.status = status
    else where.status = { notIn: ['CANCELADO', 'QUITADO'] }
    if (pessoaId) where.pessoaId = pessoaId

    // Filtra títulos que têm ao menos uma parcela dentro do período
    // O status da parcela acompanha o status do título selecionado:
    // QUITADO → filtra parcelas quitadas; demais → filtra parcelas abertas
    if (vencimentoInicio || vencimentoFim || vencidos === 'true') {
      const parcelaStatus = status === 'QUITADO' ? 'QUITADO'
        : status === 'CANCELADO' ? 'CANCELADO'
        : 'ABERTO'
      const parcelasWhere: Record<string, unknown> = { status: parcelaStatus }
      if (vencidos === 'true') {
        parcelasWhere.vencimento = { lt: hoje }
      } else {
        parcelasWhere.vencimento = {
          ...(vencimentoInicio && { gte: new Date(vencimentoInicio) }),
          ...(vencimentoFim && { lte: new Date(vencimentoFim) }),
        }
      }
      where.parcelas = { some: parcelasWhere }
    }

    const [dados, total] = await Promise.all([
      prisma.tituloFinanceiro.findMany({
        where,
        include: {
          pessoa: { select: { id: true, nome: true, documento: true } },
          contaFinanceira: { select: { id: true, codigo: true, nome: true } },
          parcelas: { orderBy: { numero: 'asc' } },
        },
        orderBy: { criadoEm: 'desc' },
        skip: (page - 1) * lim,
        take: lim,
      }),
      prisma.tituloFinanceiro.count({ where }),
    ])

    return { dados, total, pagina: page, limite: lim, paginas: Math.ceil(total / lim) }
  })

  // ── Resumo (dashboard) ────────────────────────────────────────

  app.get('/resumo', async () => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const em7Dias = new Date(hoje); em7Dias.setDate(em7Dias.getDate() + 7)

    const [totalPagar, totalReceber, vencidosPagar, vencidosReceber, a7Dias] = await Promise.all([
      prisma.parcelaFinanceira.aggregate({
        where: { status: 'ABERTO', titulo: { tipo: 'PAGAR', status: { notIn: ['CANCELADO', 'QUITADO'] } } },
        _sum: { valor: true },
      }),
      prisma.parcelaFinanceira.aggregate({
        where: { status: 'ABERTO', titulo: { tipo: 'RECEBER', status: { notIn: ['CANCELADO', 'QUITADO'] } } },
        _sum: { valor: true },
      }),
      prisma.parcelaFinanceira.aggregate({
        where: { status: 'ABERTO', vencimento: { lt: hoje }, titulo: { tipo: 'PAGAR' } },
        _sum: { valor: true }, _count: true,
      }),
      prisma.parcelaFinanceira.aggregate({
        where: { status: 'ABERTO', vencimento: { lt: hoje }, titulo: { tipo: 'RECEBER' } },
        _sum: { valor: true }, _count: true,
      }),
      prisma.parcelaFinanceira.aggregate({
        where: { status: 'ABERTO', vencimento: { gte: hoje, lte: em7Dias } },
        _sum: { valor: true }, _count: true,
      }),
    ])

    return {
      totalPagar: Number(totalPagar._sum.valor ?? 0),
      totalReceber: Number(totalReceber._sum.valor ?? 0),
      vencidosPagar: { valor: Number(vencidosPagar._sum.valor ?? 0), quantidade: vencidosPagar._count },
      vencidosReceber: { valor: Number(vencidosReceber._sum.valor ?? 0), quantidade: vencidosReceber._count },
      vencendo7Dias: { valor: Number(a7Dias._sum.valor ?? 0), quantidade: a7Dias._count },
    }
  })

  // ── CRUD Títulos ──────────────────────────────────────────────

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const titulo = await prisma.tituloFinanceiro.findUnique({
      where: { id },
      include: {
        pessoa: { select: { id: true, nome: true, documento: true } },
        contaFinanceira: { select: { id: true, codigo: true, nome: true } },
        parcelas: {
          include: { contaBancaria: { select: { id: true, nome: true } } },
          orderBy: { numero: 'asc' },
        },
      },
    })
    if (!titulo) return reply.code(404).send({ error: 'Título não encontrado.' })
    return titulo
  })

  app.post('/', async (request, reply) => {
    const data = CriarTituloSchema.parse(request.body)
    const total = data.parcelas.reduce((acc, p) => acc + p.valor, 0)

    const titulo = await prisma.tituloFinanceiro.create({
      data: {
        tipo: data.tipo,
        descricao: data.descricao,
        documento: data.documento ?? null,
        total,
        pessoaId: data.pessoaId ?? null,
        pedidoVendaId: data.pedidoVendaId ?? null,
        contaFinanceiraId: data.contaFinanceiraId ?? null,
        observacao: data.observacao ?? null,
        parcelas: {
          create: data.parcelas.map(p => ({
            numero: p.numero,
            valor: p.valor,
            vencimento: new Date(p.vencimento),
            observacao: p.observacao ?? null,
          })),
        },
      },
      include: { parcelas: { orderBy: { numero: 'asc' } } },
    })
    return reply.code(201).send(titulo)
  })

  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = AtualizarTituloSchema.parse(request.body)
    const titulo = await prisma.tituloFinanceiro.findUnique({ where: { id }, select: { status: true } })
    if (!titulo) return reply.code(404).send({ error: 'Título não encontrado.' })
    if (titulo.status === 'CANCELADO') return reply.code(409).send({ error: 'Título cancelado não pode ser editado.' })
    return prisma.tituloFinanceiro.update({ where: { id }, data: data as never })
  })

  app.patch('/:id/cancelar', async (request, reply) => {
    const { id } = request.params as { id: string }
    const titulo = await prisma.tituloFinanceiro.findUnique({
      where: { id },
      include: { parcelas: { where: { status: 'QUITADO' } } },
    })
    if (!titulo) return reply.code(404).send({ error: 'Título não encontrado.' })
    if (titulo.parcelas.length > 0) return reply.code(409).send({ error: 'Título possui parcelas já quitadas e não pode ser cancelado.' })

    await prisma.$transaction([
      prisma.parcelaFinanceira.updateMany({ where: { tituloId: id, status: 'ABERTO' }, data: { status: 'CANCELADO' } }),
      prisma.tituloFinanceiro.update({ where: { id }, data: { status: 'CANCELADO' } }),
    ])
    return { ok: true }
  })

  // ── Baixa de Parcela ──────────────────────────────────────────

  app.post('/:id/parcelas/:parcelaId/baixar', async (request, reply) => {
    const { id, parcelaId } = request.params as { id: string; parcelaId: string }
    const data = BaixarParcelaSchema.parse(request.body)

    const parcela = await prisma.parcelaFinanceira.findUnique({
      where: { id: parcelaId },
      include: {
        titulo: {
          select: {
            id: true,
            tipo: true,
            descricao: true,
            documento: true,
            recorrenciaId: true,
            recorrenciaOrdem: true,
            pessoa: { select: { nome: true } },
            _count: { select: { parcelas: true } },
          },
        },
      },
    })
    if (!parcela) return reply.code(404).send({ error: 'Parcela não encontrada.' })
    if (parcela.tituloId !== id) return reply.code(400).send({ error: 'Parcela não pertence a este título.' })
    if (parcela.status !== 'ABERTO') return reply.code(409).send({ error: 'Parcela já foi quitada ou cancelada.' })

    const contaBancaria = await prisma.contaBancaria.findUnique({ where: { id: data.contaBancariaId } })
    if (!contaBancaria) return reply.code(404).send({ error: 'Conta bancária não encontrada.' })

    let statusFinalTitulo = 'ABERTO'

    await prisma.$transaction(async (tx) => {
      const encargos = (data.juros ?? 0) + (data.multa ?? 0) + (data.taxas ?? 0)
      const principalPago = data.valorPago - encargos
      const valorOriginal = Number(parcela.valor)
      const restante = Number((valorOriginal - principalPago).toFixed(2))
      const isParcial = restante > 0.005

      // Quita a parcela atual (total ou parcial)
      await tx.parcelaFinanceira.update({
        where: { id: parcelaId },
        data: {
          status: 'QUITADO',
          dataBaixa: new Date(data.dataBaixa),
          valorPago: data.valorPago,
          juros: data.juros ?? null,
          multa: data.multa ?? null,
          taxas: data.taxas ?? null,
          contaBancariaId: data.contaBancariaId,
          observacao: data.observacao ?? null,
        },
      })

      // Se parcial: cria nova parcela com o restante
      if (isParcial) {
        const { _max } = await tx.parcelaFinanceira.aggregate({
          where: { tituloId: id },
          _max: { numero: true },
        })
        const vencimentoRestante = data.vencimentoRestante
          ? new Date(data.vencimentoRestante)
          : parcela.vencimento

        await tx.parcelaFinanceira.create({
          data: {
            tituloId: id,
            numero: (_max.numero ?? 0) + 1,
            valor: restante,
            vencimento: vencimentoRestante,
            parcelaOrigemId: parcelaId,
          },
        })
      }

      // Monta descrição para o caixa/extrato
      const acao = parcela.titulo.tipo === 'PAGAR' ? 'Baixa' : 'Recebimento'
      const totalParcelas = parcela.titulo._count.parcelas
      const prefixo = isParcial ? `${acao} parcial` : acao
      const docLabel = parcela.titulo.documento ? ` (nº ${parcela.titulo.documento})` : ''
      const tituloLabel = `${prefixo} — ${parcela.titulo.descricao}${docLabel}`
      const parcelaLabel = `parcela ${parcela.numero}/${totalParcelas}`
      const pessoa = parcela.titulo.pessoa?.nome ?? null
      const partes = [tituloLabel, parcelaLabel, pessoa, data.observacao || null].filter(Boolean)
      const descricao = partes.join(', ')

      // Lança na conta bancária (transação financeira)
      await tx.transacaoFinanceira.create({
        data: {
          contaBancariaId: data.contaBancariaId,
          fitid: `TITULO-${parcelaId}`,
          data: new Date(data.dataBaixa),
          valor: data.valorPago,
          tipo: parcela.titulo.tipo === 'PAGAR' ? 'DEBITO' : 'CREDITO',
          descricao,
          nomeOriginal: descricao,
          fonteClassificacao: 'TITULO',
          confiancaClassificacao: 1,
          status: 'REVISADO',
        },
      })

      // Verifica e atualiza status do título
      const todasParcelas = await tx.parcelaFinanceira.findMany({
        where: { tituloId: id },
        select: { status: true },
      })
      const abertas = todasParcelas.filter(p => p.status === 'ABERTO').length
      const quitadas = todasParcelas.filter(p => p.status === 'QUITADO').length
      const novoStatus = abertas === 0 && quitadas > 0 ? 'QUITADO' : quitadas > 0 ? 'PARCIAL' : 'ABERTO'
      statusFinalTitulo = novoStatus
      await tx.tituloFinanceiro.update({ where: { id }, data: { status: novoStatus } })
    })

    // Auto-renovação: se o título recorrente foi quitado e é o último do lote
    if (statusFinalTitulo === 'QUITADO' && parcela.titulo.recorrenciaId && parcela.titulo.recorrenciaOrdem) {
      try {
        const { _max } = await prisma.tituloFinanceiro.aggregate({
          where: { recorrenciaId: parcela.titulo.recorrenciaId },
          _max: { recorrenciaOrdem: true },
        })
        if (parcela.titulo.recorrenciaOrdem === _max.recorrenciaOrdem) {
          const rec = await prisma.recorrenciaFinanceira.findUnique({ where: { id: parcela.titulo.recorrenciaId } })
          if (rec?.ativa) {
            const baseOrdem = _max.recorrenciaOrdem!
            const ultimaVenc = parcela.vencimento
            const datas: Date[] = []
            for (let i = 1; i <= 12; i++) {
              const d = new Date(ultimaVenc)
              d.setMonth(d.getMonth() + i)
              const dia = Math.min(rec.diaVencimento, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())
              datas.push(new Date(Date.UTC(d.getFullYear(), d.getMonth(), dia)))
            }
            await prisma.$transaction(
              datas.map((venc, i) =>
                prisma.tituloFinanceiro.create({
                  data: {
                    tipo: rec.tipo,
                    descricao: rec.descricao,
                    total: rec.valor,
                    pessoaId: rec.pessoaId,
                    contaFinanceiraId: rec.contaFinanceiraId,
                    observacao: rec.observacao,
                    recorrenciaId: rec.id,
                    recorrenciaOrdem: baseOrdem + i + 1,
                    parcelas: { create: [{ numero: 1, valor: rec.valor, vencimento: venc }] },
                  },
                })
              )
            )
          }
        }
      } catch (err) {
        // Auto-renovação não bloqueia a baixa
        console.error('Falha na auto-renovação da recorrência:', err)
      }
    }

    return { ok: true }
  })

  app.patch('/:id/parcelas/:parcelaId/estornar', async (request, reply) => {
    const { id, parcelaId } = request.params as { id: string; parcelaId: string }

    const parcela = await prisma.parcelaFinanceira.findUnique({ where: { id: parcelaId } })
    if (!parcela || parcela.tituloId !== id) return reply.code(404).send({ error: 'Parcela não encontrada.' })
    if (parcela.status !== 'QUITADO') return reply.code(409).send({ error: 'Apenas parcelas quitadas podem ser estornadas.' })

    await prisma.$transaction(async (tx) => {
      // Remove a transação financeira gerada pela baixa
      await tx.transacaoFinanceira.deleteMany({ where: { fitid: `TITULO-${parcelaId}` } })

      // Remove parcela de saldo criada em baixa parcial (se existir)
      await tx.parcelaFinanceira.deleteMany({ where: { tituloId: id, parcelaOrigemId: parcelaId } })

      // Restaura parcela para ABERTO limpando todos os campos de baixa
      await tx.parcelaFinanceira.update({
        where: { id: parcelaId },
        data: {
          status: 'ABERTO',
          dataBaixa: null,
          valorPago: null,
          juros: null,
          multa: null,
          taxas: null,
          contaBancariaId: null,
          observacao: null,
        },
      })

      // Recalcula status do título
      const todasParcelas = await tx.parcelaFinanceira.findMany({
        where: { tituloId: id }, select: { status: true },
      })
      const abertas = todasParcelas.filter(p => p.status === 'ABERTO').length
      const quitadas = todasParcelas.filter(p => p.status === 'QUITADO').length
      const novoStatus = abertas === 0 && quitadas === 0 ? 'CANCELADO' : abertas === 0 ? 'QUITADO' : quitadas > 0 ? 'PARCIAL' : 'ABERTO'
      await tx.tituloFinanceiro.update({ where: { id }, data: { status: novoStatus } })
    })

    return { ok: true }
  })

  app.patch('/:id/parcelas/:parcelaId/cancelar', async (request, reply) => {
    const { id, parcelaId } = request.params as { id: string; parcelaId: string }
    const parcela = await prisma.parcelaFinanceira.findUnique({ where: { id: parcelaId } })
    if (!parcela || parcela.tituloId !== id) return reply.code(404).send({ error: 'Parcela não encontrada.' })
    if (parcela.status === 'QUITADO') return reply.code(409).send({ error: 'Parcela quitada não pode ser cancelada.' })

    await prisma.parcelaFinanceira.update({ where: { id: parcelaId }, data: { status: 'CANCELADO' } })

    // Recalcula status do título
    const todasParcelas = await prisma.parcelaFinanceira.findMany({
      where: { tituloId: id }, select: { status: true },
    })
    const abertas = todasParcelas.filter(p => p.status === 'ABERTO').length
    const quitadas = todasParcelas.filter(p => p.status === 'QUITADO').length
    const novoStatus = abertas === 0 && quitadas === 0 ? 'CANCELADO' : abertas === 0 ? 'QUITADO' : quitadas > 0 ? 'PARCIAL' : 'ABERTO'
    await prisma.tituloFinanceiro.update({ where: { id }, data: { status: novoStatus } })

    return { ok: true }
  })
}
