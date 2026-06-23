import { prisma } from '@erp/database'
import type { OFXTransaction } from './ofx.parser.js'

type RegraClassificacao = Awaited<ReturnType<typeof prisma.regraClassificacao.findMany>>[number]

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ResultadoClassificacao =
  | { fonte: 'REGRA';     contaFinanceiraId: string; confianca: number; regraId: string }
  | { fonte: 'HISTORICO'; contaFinanceiraId: string; confianca: number }

// ── Classificação por Regras ──────────────────────────────────────────────────

export function classificarTransacaoSync(
  tx: Pick<OFXTransaction, 'name' | 'memo' | 'amount' | 'type'>,
  regras: RegraClassificacao[],
): ResultadoClassificacao | null {
  const nomeUpper = (tx.name || '').toUpperCase()
  const memoUpper = (tx.memo || '').toUpperCase()
  const tipoTx = tx.type === 'CREDIT' ? 'CREDITO' : 'DEBITO'

  for (const regra of regras) {
    if (regra.tipoTransacao !== 'QUALQUER' && regra.tipoTransacao !== tipoTx) continue

    let match = false

    if (regra.campo === 'VALOR') {
      const min = Number(regra.valorMin ?? 0)
      const max = Number(regra.valorMax ?? Infinity)
      match = tx.amount >= min && tx.amount <= max
    } else {
      const sujeito =
        regra.campo === 'NOME'        ? nomeUpper :
        regra.campo === 'MEMO'        ? memoUpper :
        `${nomeUpper} ${memoUpper}`

      const valor = (regra.valorCorrespondencia ?? '').toUpperCase()

      switch (regra.tipoCorrespondencia) {
        case 'CONTEM':      match = sujeito.includes(valor); break
        case 'COMECA_COM':  match = sujeito.startsWith(valor); break
        case 'TERMINA_COM': match = sujeito.endsWith(valor); break
        case 'IGUAL':       match = sujeito === valor; break
        case 'REGEX': {
          // Usa o padrão cru (não `valor`): uppercase corromperia metacaracteres
          // como \s→\S, \d→\D, \w→\W. A flag 'i' já cobre a diferença de caixa.
          try { match = new RegExp(regra.valorCorrespondencia ?? '', 'i').test(sujeito) } catch { match = false }
          break
        }
        case 'INTERVALO': {
          const min = Number(regra.valorMin ?? 0)
          const max = Number(regra.valorMax ?? Infinity)
          match = tx.amount >= min && tx.amount <= max
          break
        }
      }
    }

    if (match) {
      return { fonte: 'REGRA', contaFinanceiraId: regra.contaFinanceiraId, confianca: 0.9, regraId: regra.id }
    }
  }

  return null
}

// Mantida para compatibilidade com chamadas avulsas fora do fluxo de importação
export async function classificarTransacao(
  tx: Pick<OFXTransaction, 'name' | 'memo' | 'amount' | 'type'>
): Promise<ResultadoClassificacao | null> {
  const regras = await prisma.regraClassificacao.findMany({
    where: { ativo: true },
    orderBy: { prioridade: 'asc' },
  })
  return classificarTransacaoSync(tx, regras)
}

// ── Classificação por Histórico ───────────────────────────────────────────────

/**
 * Para cada nome recebido, busca transações anteriores já classificadas
 * (status CLASSIFICADO ou REVISADO com contaFinanceiraId preenchido),
 * elege a conta com mais ocorrências e calcula confiança baseada em consistência.
 *
 * Confiança:
 *   - Escala de 0.65 (baixa consistência) a 0.90 (100% consistente)
 *   - Exige ao menos 2 registros históricos para emitir sugestão
 *   - Sempre abaixo de 1.0 para distinguir de classificação manual (REVISADO)
 */
export async function buscarHistoricoClassificacao(
  nomes: string[],
): Promise<Map<string, { contaFinanceiraId: string; confianca: number }>> {
  const resultado = new Map<string, { contaFinanceiraId: string; confianca: number }>()
  if (nomes.length === 0) return resultado

  const nomesUnicos = [...new Set(nomes.filter(Boolean))]

  // Busca case-insensitive via OR de equals (Prisma não suporta mode em 'in')
  const historico = await prisma.transacaoFinanceira.findMany({
    where: {
      OR: nomesUnicos.map(n => ({ nomeOriginal: { equals: n, mode: 'insensitive' as const } })),
      contaFinanceiraId: { not: null },
      status: { in: ['CLASSIFICADO', 'REVISADO'] },
    },
    select: { nomeOriginal: true, contaFinanceiraId: true },
  })

  // Agrupa em memória por nome normalizado → conta → contagem
  const porNome = new Map<string, Map<string, number>>()
  for (const row of historico) {
    if (!row.nomeOriginal || !row.contaFinanceiraId) continue
    const chave = row.nomeOriginal.toLowerCase().trim()
    if (!porNome.has(chave)) porNome.set(chave, new Map())
    const contasMap = porNome.get(chave)!
    contasMap.set(row.contaFinanceiraId, (contasMap.get(row.contaFinanceiraId) ?? 0) + 1)
  }

  // Para cada nome, elege a conta majoritária e calcula confiança
  for (const [chave, contasMap] of porNome) {
    const entradas = [...contasMap.entries()].sort((a, b) => b[1] - a[1])
    const [contaVencedora, countVencedor] = entradas[0]
    const total = entradas.reduce((acc, [, c]) => acc + c, 0)

    if (total < 2) continue // exige mínimo de histórico para sugerir

    const consistencia = countVencedor / total  // 0.5 → 1.0
    // Confiança: 0.65 (50% consistência) → 0.90 (100% consistência)
    const confianca = Math.round((0.65 + consistencia * 0.25) * 100) / 100

    resultado.set(chave, { contaFinanceiraId: contaVencedora, confianca })
  }

  return resultado
}
