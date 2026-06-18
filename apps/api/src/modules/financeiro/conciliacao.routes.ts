import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { requirePerfil } from '../../plugins/auth.plugin.js'
import { z } from 'zod'

const ConfirmarSchema = z.object({
  transacaoId: z.string().uuid(),
  parcelaId: z.string().uuid(),
  dataBaixa: z.string().optional(),
  valorPago: z.number().positive().optional(),
})

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

export async function conciliacaoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'FINANCEIRO'))

  // ── Listar transações não conciliadas + sugestões ─────────────────────────

  app.get('/:contaBancariaId', async (request, reply) => {
    const { contaBancariaId } = request.params as { contaBancariaId: string }
    const { dataInicio, dataFim } = request.query as { dataInicio?: string; dataFim?: string }

    const conta = await prisma.contaBancaria.findUnique({ where: { id: contaBancariaId } })
    if (!conta) return reply.code(404).send({ error: 'Conta não encontrada.' })

    // Só transações OFX reais: sem vínculo com parcela + não criadas pelo sistema
    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: {
        contaBancariaId,
        parcelaFinanceiraId: null,
        NOT: { fonteClassificacao: { in: ['TITULO', 'MANUAL'] } },
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
    const { transacaoId, parcelaId, dataBaixa, valorPago } = ConfirmarSchema.parse(request.body)

    const [tx, parcela] = await Promise.all([
      prisma.transacaoFinanceira.findUnique({ where: { id: transacaoId } }),
      prisma.parcelaFinanceira.findUnique({
        where: { id: parcelaId },
        include: { titulo: { select: { id: true, tipo: true } } },
      }),
    ])

    if (!tx) return reply.code(404).send({ error: 'Transação não encontrada.' })
    if (!parcela) return reply.code(404).send({ error: 'Parcela não encontrada.' })
    if (tx.parcelaFinanceiraId) return reply.code(409).send({ error: 'Transação já conciliada com outra parcela.' })
    if (parcela.status !== 'ABERTO') return reply.code(409).send({ error: 'Parcela já foi quitada ou cancelada.' })

    const tipoEsperado = tx.tipo === 'DEBITO' ? 'PAGAR' : 'RECEBER'
    if (parcela.titulo.tipo !== tipoEsperado) {
      return reply.code(400).send({
        error: `Tipo incompatível: débito deve ser conciliado com título a Pagar, crédito com título a Receber.`,
      })
    }

    const dataBaixaFinal = dataBaixa ? new Date(dataBaixa) : new Date(tx.data)
    const valorPagoFinal = valorPago ?? Number(tx.valor)

    await prisma.$transaction(async (t) => {
      // Baixa a parcela
      await t.parcelaFinanceira.update({
        where: { id: parcelaId },
        data: {
          status: 'QUITADO',
          dataBaixa: dataBaixaFinal,
          valorPago: valorPagoFinal,
          contaBancariaId: tx.contaBancariaId,
        },
      })

      // Vincula transação à parcela e marca como revisada
      await t.transacaoFinanceira.update({
        where: { id: transacaoId },
        data: {
          parcelaFinanceiraId: parcelaId,
          status: 'REVISADO',
          fonteClassificacao: 'CONCILIACAO',
          confiancaClassificacao: 1.0,
        },
      })

      // Atualiza status do título
      const todasParcelas = await t.parcelaFinanceira.findMany({
        where: { tituloId: parcela.tituloId },
        select: { status: true },
      })
      const abertas = todasParcelas.filter(p => p.status === 'ABERTO').length
      const quitadas = todasParcelas.filter(p => p.status === 'QUITADO').length
      const novoStatus = abertas === 0 && quitadas > 0 ? 'QUITADO'
        : quitadas > 0 ? 'PARCIAL' : 'ABERTO'
      await t.tituloFinanceiro.update({ where: { id: parcela.tituloId }, data: { status: novoStatus } })
    })

    return { ok: true }
  })
}
