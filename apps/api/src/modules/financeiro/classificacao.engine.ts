import { prisma } from '@erp/database'
import type { OFXTransaction } from './ofx.parser.js'

type RegraClassificacao = Awaited<ReturnType<typeof prisma.regraClassificacao.findMany>>[number]

export interface ResultadoClassificacao {
  contaFinanceiraId: string
  fonte: string
  confianca: number
  regraId: string
}

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
        regra.campo === 'NOME' ? nomeUpper :
        regra.campo === 'MEMO' ? memoUpper :
        `${nomeUpper} ${memoUpper}`

      const valor = (regra.valorCorrespondencia ?? '').toUpperCase()

      switch (regra.tipoCorrespondencia) {
        case 'CONTEM':      match = sujeito.includes(valor); break
        case 'COMECA_COM':  match = sujeito.startsWith(valor); break
        case 'TERMINA_COM': match = sujeito.endsWith(valor); break
        case 'IGUAL':       match = sujeito === valor; break
        case 'REGEX': {
          try { match = new RegExp(valor, 'i').test(sujeito) } catch { match = false }
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
      return { contaFinanceiraId: regra.contaFinanceiraId, fonte: 'REGRA', confianca: 0.9, regraId: regra.id }
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
