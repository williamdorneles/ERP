import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { requirePerfil } from '../../plugins/auth.plugin.js'
import { calcularSaldoBaixa, statusTituloPorParcelas, montarLinhasEncargo, somaEncargos } from './baixa.js'
import { z } from 'zod'

const ConfirmarSchema = z.object({
  transacaoId: z.string().uuid(),
  parcelaId: z.string().uuid(),
  dataBaixa: z.string().optional(),
  valorPago: z.number().positive().optional(),
  // Encargos embutidos no valor do banco, rateados para contas de DRE configuradas
  tarifa: z.number().min(0).optional(),
  juros: z.number().min(0).optional(),
  multa: z.number().min(0).optional(),
})

const EstornarSchema = z.object({
  transacaoId: z.string().uuid(),
})

const ConfirmarLoteSchema = z.object({
  itens: z.array(z.object({
    transacaoId: z.string().uuid(),
    parcelaId: z.string().uuid(),
  })).min(1).max(500),
})

const LABEL_CONTA: Record<string, string> = {
  CONTA_TARIFA_BANCARIA: 'Tarifa bancária',
  CONTA_JUROS_PAGOS: 'Juros/multa pagos',
  CONTA_JUROS_RECEBIDOS: 'Juros/multa recebidos',
}

// ── Score: máx 200pts ─────────────────────────────────────────────────────────
// Valor  (0–100): coincidência exata → 100, ±2% → 70, ±10% → 30
// Data   (0–50):  ≤3 dias → 50, ≤7 → 30, ≤15 → 10
// Texto  (0–50):  nome pessoa → 30, palavra-chave do título → 20

function calcularScore(
  txValor: number, txData: Date, txTexto: string,
  parcelaValor: number, vencimento: Date, pessoaNome: string, tituloDesc: string,
): number {
  let score = 0

  // Valor
  const diffPct = parcelaValor > 0
    ? Math.abs(txValor - parcelaValor) / parcelaValor
    : 1
  if (diffPct < 0.001) score += 100
  else if (diffPct <= 0.02) score += 70
  else if (diffPct <= 0.10) score += 30

  // Data
  const dias = Math.abs((txData.getTime() - vencimento.getTime()) / 86_400_000)
  if (dias <= 3) score += 50
  else if (dias <= 7) score += 30
  else if (dias <= 15) score += 10

  // Nome da pessoa
  const txUp = txTexto.toUpperCase()
  if (pessoaNome) {
    const tokens = pessoaNome.toUpperCase().split(' ').filter(w => w.length >= 4)
    if (tokens.some(w => txUp.includes(w))) score += 30
  }

  // Palavras-chave do título
  if (tituloDesc) {
    const tokens = tituloDesc.toUpperCase().split(' ').filter(w => w.length >= 4)
    if (tokens.slice(0, 3).some(w => txUp.includes(w))) score += 20
  }

  return score
}

function nivelConfianca(score: number, hasSugestoes: boolean): 'ALTA' | 'MEDIA' | 'BAIXA' | null {
  if (!hasSugestoes) return null
  if (score >= 150) return 'ALTA'
  if (score >= 80) return 'MEDIA'
  return 'BAIXA'
}

interface ConciliarParams {
  transacaoId: string
  parcelaId: string
  dataBaixa?: string
  valorPago?: number
  tarifa?: number
  juros?: number
  multa?: number
}
type ConciliarResult =
  | { ok: true; parcial: boolean; saldoResidual: number; principal: number; encargos: number }
  | { ok: false; status: number; error: string }

// Núcleo da conciliação de uma transação com uma parcela. Reutilizado pelo
// endpoint individual e pelo lote (auto-conciliação). O lote não passa encargos.
async function executarConciliacao(p: ConciliarParams): Promise<ConciliarResult> {
  const { transacaoId, parcelaId, dataBaixa, valorPago, tarifa, juros, multa } = p

  const [tx, parcela] = await Promise.all([
    prisma.transacaoFinanceira.findUnique({ where: { id: transacaoId } }),
    prisma.parcelaFinanceira.findUnique({
      where: { id: parcelaId },
      include: { titulo: { select: { id: true, tipo: true } } },
    }),
  ])

  if (!tx) return { ok: false, status: 404, error: 'Transação não encontrada.' }
  if (!parcela) return { ok: false, status: 404, error: 'Parcela não encontrada.' }
  if (tx.parcelaFinanceiraId) return { ok: false, status: 409, error: 'Transação já conciliada com outra parcela.' }
  if (parcela.status !== 'ABERTO') return { ok: false, status: 409, error: 'Parcela já foi quitada ou cancelada.' }

  const tipoTitulo = parcela.titulo.tipo as 'PAGAR' | 'RECEBER'
  const tipoEsperado = tx.tipo === 'DEBITO' ? 'PAGAR' : 'RECEBER'
  if (tipoTitulo !== tipoEsperado) {
    return { ok: false, status: 400, error: 'Tipo incompatível: débito deve ser conciliado com título a Pagar, crédito com título a Receber.' }
  }

  // Encargos embutidos no valor do banco → rateados para contas de DRE
  const linhasEncargo = montarLinhasEncargo(tipoTitulo, { tarifa, juros, multa })
  const totalEncargos = somaEncargos(linhasEncargo)
  const bankTotal = Number(tx.valor)
  if (totalEncargos >= bankTotal) {
    return { ok: false, status: 400, error: 'Os encargos não podem ser maiores ou iguais ao valor da transação.' }
  }

  // Resolve as contas configuradas para os encargos informados
  const contasEncargo = new Map<string, string>()
  if (linhasEncargo.length > 0) {
    const chaves = [...new Set(linhasEncargo.map(l => l.chaveConta))]
    const cfgs = await prisma.configuracao.findMany({ where: { chave: { in: chaves } } })
    for (const c of cfgs) if (c.valor) contasEncargo.set(c.chave, c.valor)
    const faltando = chaves.filter(k => !contasEncargo.has(k))
    if (faltando.length > 0) {
      return { ok: false, status: 400, error: `Conta de DRE não configurada para: ${faltando.map(k => LABEL_CONTA[k] ?? k).join(', ')}. Defina em Configurações > Financeiro.` }
    }
  }

  const dataBaixaFinal = dataBaixa ? new Date(dataBaixa) : new Date(tx.data)
  // Principal aplicado ao título = valor do banco menos os encargos
  const principalBanco = Number((bankTotal - totalEncargos).toFixed(2))
  const valorPagoFinal = valorPago ?? principalBanco

  // Baixa parcial: se o principal é menor que a parcela, quita o pago e gera
  // uma nova parcela com o saldo restante (mesmo padrão da baixa de título).
  const { restante, isParcial } = calcularSaldoBaixa(Number(parcela.valor), valorPagoFinal)

  await prisma.$transaction(async (t) => {
    // Quita a parcela conciliada (total ou parcial)
    await t.parcelaFinanceira.update({
      where: { id: parcelaId },
      data: {
        status: 'QUITADO',
        dataBaixa: dataBaixaFinal,
        valorPago: valorPagoFinal,
        contaBancariaId: tx.contaBancariaId,
      },
    })

    // Gera a parcela do saldo restante quando a baixa foi parcial
    if (isParcial) {
      const { _max } = await t.parcelaFinanceira.aggregate({
        where: { tituloId: parcela.tituloId },
        _max: { numero: true },
      })
      await t.parcelaFinanceira.create({
        data: {
          tituloId: parcela.tituloId,
          numero: (_max.numero ?? 0) + 1,
          valor: restante,
          vencimento: parcela.vencimento,
          parcelaOrigemId: parcelaId,
        },
      })
    }

    // Atualiza a transação conciliada. Com encargos, ela vira o "principal"
    // (valor reduzido) e o restante é rateado nas linhas de encargo abaixo,
    // de forma que a soma continue igual ao valor original do banco.
    await t.transacaoFinanceira.update({
      where: { id: transacaoId },
      data: {
        parcelaFinanceiraId: parcelaId,
        status: 'REVISADO',
        fonteClassificacao: 'CONCILIACAO',
        confiancaClassificacao: 1.0,
        ...(totalEncargos > 0 ? { valor: principalBanco } : {}),
      },
    })

    // Cria as linhas de encargo (rateio) para o DRE
    for (const linha of linhasEncargo) {
      await t.transacaoFinanceira.create({
        data: {
          contaBancariaId: tx.contaBancariaId,
          fitid: `CONC-ENC-${transacaoId}-${linha.chaveConta}`,
          data: tx.data,
          valor: linha.valor,
          tipo: tx.tipo,
          descricao: `${LABEL_CONTA[linha.chaveConta] ?? 'Encargo'} — conciliação`,
          nomeOriginal: tx.nomeOriginal,
          contaFinanceiraId: contasEncargo.get(linha.chaveConta)!,
          // Fonte própria: entra no DRE (status REVISADO + conta), mas não é tratada
          // como transação conciliável nem oferece "estornar" isolado na listagem.
          fonteClassificacao: 'CONCILIACAO_ENCARGO',
          confiancaClassificacao: 1.0,
          status: 'REVISADO',
        },
      })
    }

    // Atualiza status do título
    const todasParcelas = await t.parcelaFinanceira.findMany({
      where: { tituloId: parcela.tituloId },
      select: { status: true },
    })
    const novoStatus = statusTituloPorParcelas(todasParcelas.map(p => p.status))
    await t.tituloFinanceiro.update({ where: { id: parcela.tituloId }, data: { status: novoStatus } })
  })

  return { ok: true, parcial: isParcial, saldoResidual: isParcial ? restante : 0, principal: principalBanco, encargos: totalEncargos }
}

export async function conciliacaoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'FINANCEIRO'))

  // ── Listar transações não conciliadas + sugestões ─────────────────────────

  app.get('/:contaBancariaId', async (request, reply) => {
    const { contaBancariaId } = request.params as { contaBancariaId: string }
    const { dataInicio, dataFim } = request.query as { dataInicio?: string; dataFim?: string }

    const conta = await prisma.contaBancaria.findUnique({ where: { id: contaBancariaId } })
    if (!conta) return reply.code(404).send({ error: 'Conta não encontrada.' })

    // Só transações OFX reais ainda não resolvidas: importadas do extrato com fonte
    // NULL (PENDENTE) ou sugestão automática (REGRA/HISTORICO). Exclui as criadas/
    // resolvidas pelo sistema (TITULO, TRANSFERENCIA, AJUSTE, MANUAL, CONCILIACAO).
    // O OR com `null` é necessário: NOT IN / notIn descartam linhas NULL em SQL.
    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: {
        contaBancariaId,
        parcelaFinanceiraId: null,
        OR: [
          { fonteClassificacao: null },
          { fonteClassificacao: { in: ['REGRA', 'HISTORICO'] } },
        ],
        ...(dataInicio || dataFim
          ? { data: { ...(dataInicio && { gte: new Date(dataInicio) }), ...(dataFim && { lte: new Date(dataFim) }) } }
          : {}),
      },
      include: { contaFinanceira: { select: { id: true, codigo: true, nome: true } } },
      orderBy: [{ data: 'desc' }],
    })

    if (transacoes.length === 0) {
      return { conta, transacoes: [], stats: { total: 0, debitos: 0, creditos: 0 } }
    }

    // Range de datas para buscar parcelas: ±30 dias em volta das transações
    const timestamps = transacoes.map(t => new Date(t.data).getTime())
    const minData = new Date(Math.min(...timestamps)); minData.setDate(minData.getDate() - 30)
    const maxData = new Date(Math.max(...timestamps)); maxData.setDate(maxData.getDate() + 30)

    const tiposTitulo = [...new Set(
      transacoes.map(t => t.tipo === 'DEBITO' ? 'PAGAR' : 'RECEBER'),
    )] as ('PAGAR' | 'RECEBER')[]

    // Uma única query busca todos os candidatos do período
    const parcelas = await prisma.parcelaFinanceira.findMany({
      where: {
        status: 'ABERTO',
        titulo: { tipo: { in: tiposTitulo }, status: { notIn: ['CANCELADO'] } },
        vencimento: { gte: minData, lte: maxData },
      },
      include: {
        titulo: {
          include: { pessoa: { select: { id: true, nome: true } } },
        },
      },
    })

    // Scorar em memória — O(n * m), tipicamente 100 txs × 50 parcelas = trivial
    const resultado = transacoes.map(tx => {
      const tipoParcela = tx.tipo === 'DEBITO' ? 'PAGAR' : 'RECEBER'
      const txTexto = `${tx.nomeOriginal ?? ''} ${tx.descricao ?? ''}`
      const txValor = Number(tx.valor)
      const txData = new Date(tx.data)

      const sugestoes = parcelas
        .filter(p => p.titulo.tipo === tipoParcela)
        .map(p => {
          const score = calcularScore(
            txValor, txData, txTexto,
            Number(p.valor), new Date(p.vencimento),
            p.titulo.pessoa?.nome ?? '',
            p.titulo.descricao,
          )
          return {
            parcelaId: p.id,
            numero: p.numero,
            tituloId: p.tituloId,
            tituloDescricao: p.titulo.descricao,
            pessoaId: p.titulo.pessoa?.id ?? null,
            pessoaNome: p.titulo.pessoa?.nome ?? null,
            valor: Number(p.valor),
            vencimento: p.vencimento,
            diffValor: txValor - Number(p.valor),
            diffDias: Math.round((txData.getTime() - new Date(p.vencimento).getTime()) / 86_400_000),
            score,
          }
        })
        .filter(s => s.score >= 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      const melhorScore = sugestoes[0]?.score ?? 0
      return {
        id: tx.id,
        data: tx.data,
        valor: txValor,
        tipo: tx.tipo,
        descricao: tx.descricao,
        nomeOriginal: tx.nomeOriginal,
        status: tx.status,
        fonteClassificacao: tx.fonteClassificacao,
        contaFinanceira: tx.contaFinanceira,
        sugestoes,
        melhorScore,
        confianca: nivelConfianca(melhorScore, sugestoes.length > 0),
      }
    })

    return {
      conta,
      transacoes: resultado,
      stats: {
        total: resultado.length,
        debitos: resultado.filter(t => t.tipo === 'DEBITO').length,
        creditos: resultado.filter(t => t.tipo === 'CREDITO').length,
        comSugestaoAlta: resultado.filter(t => t.confianca === 'ALTA').length,
      },
    }
  })

  // ── Confirmar conciliação ─────────────────────────────────────────────────

  app.post('/confirmar', async (request, reply) => {
    const params = ConfirmarSchema.parse(request.body)
    const r = await executarConciliacao(params)
    if (!r.ok) return reply.code(r.status).send({ error: r.error })
    return r
  })

  // ── Confirmar em lote (auto-conciliação) ──────────────────────────────────

  app.post('/confirmar-lote', async (request) => {
    const { itens } = ConfirmarLoteSchema.parse(request.body)

    let conciliadas = 0
    const falhas: { transacaoId: string; parcelaId: string; error: string }[] = []
    // Sequencial: cada item é sua própria transação; conflitos (ex.: parcela já
    // baixada por um item anterior do lote) falham de forma controlada.
    for (const item of itens) {
      const r = await executarConciliacao(item)
      if (r.ok) conciliadas++
      else falhas.push({ transacaoId: item.transacaoId, parcelaId: item.parcelaId, error: r.error })
    }

    return { total: itens.length, conciliadas, falhas }
  })

  // ── Estornar conciliação ──────────────────────────────────────────────────

  app.post('/estornar', async (request, reply) => {
    const { transacaoId } = EstornarSchema.parse(request.body)

    const tx = await prisma.transacaoFinanceira.findUnique({
      where: { id: transacaoId },
      select: { id: true, parcelaFinanceiraId: true, fonteClassificacao: true, valor: true, contaBancariaId: true },
    })
    if (!tx) return reply.code(404).send({ error: 'Transação não encontrada.' })
    if (!tx.parcelaFinanceiraId || tx.fonteClassificacao !== 'CONCILIACAO') {
      return reply.code(409).send({ error: 'Transação não está conciliada.' })
    }

    // Linhas de encargo geradas nesta conciliação (rateio)
    const encargos = await prisma.transacaoFinanceira.findMany({
      where: { contaBancariaId: tx.contaBancariaId, fitid: { startsWith: `CONC-ENC-${transacaoId}-` } },
      select: { id: true, valor: true },
    })
    const totalEncargos = encargos.reduce((s, e) => s + Number(e.valor), 0)

    const parcelaId = tx.parcelaFinanceiraId
    const parcela = await prisma.parcelaFinanceira.findUnique({
      where: { id: parcelaId },
      select: { id: true, tituloId: true },
    })
    if (!parcela) return reply.code(404).send({ error: 'Parcela conciliada não encontrada.' })

    // Saldo residual gerado nesta conciliação parcial (se houve)
    const residuais = await prisma.parcelaFinanceira.findMany({
      where: { parcelaOrigemId: parcelaId },
      select: { id: true, status: true },
    })
    if (residuais.some(r => r.status !== 'ABERTO')) {
      return reply.code(409).send({
        error: 'O saldo restante desta conciliação já foi baixado ou conciliado. Estorne-o antes.',
      })
    }

    await prisma.$transaction(async (t) => {
      // Remove a(s) parcela(s) de saldo geradas na baixa parcial
      if (residuais.length > 0) {
        await t.parcelaFinanceira.deleteMany({ where: { parcelaOrigemId: parcelaId } })
      }

      // Remove as linhas de encargo e devolve seus valores ao principal
      if (encargos.length > 0) {
        await t.transacaoFinanceira.deleteMany({ where: { id: { in: encargos.map(e => e.id) } } })
      }

      // Restaura a parcela conciliada para ABERTO
      await t.parcelaFinanceira.update({
        where: { id: parcelaId },
        data: {
          status: 'ABERTO',
          dataBaixa: null,
          valorPago: null,
          juros: null,
          multa: null,
          taxas: null,
          contaBancariaId: null,
        },
      })

      // Desvincula a transação, restaura o valor original (principal + encargos)
      // e devolve ao estado pendente para nova conciliação
      await t.transacaoFinanceira.update({
        where: { id: transacaoId },
        data: {
          parcelaFinanceiraId: null,
          fonteClassificacao: null,
          confiancaClassificacao: null,
          status: 'PENDENTE',
          valor: Number((Number(tx.valor) + totalEncargos).toFixed(2)),
        },
      })

      // Recalcula status do título
      const todasParcelas = await t.parcelaFinanceira.findMany({
        where: { tituloId: parcela.tituloId },
        select: { status: true },
      })
      const novoStatus = statusTituloPorParcelas(todasParcelas.map(p => p.status))
      await t.tituloFinanceiro.update({ where: { id: parcela.tituloId }, data: { status: novoStatus } })
    })

    return { ok: true }
  })
}
