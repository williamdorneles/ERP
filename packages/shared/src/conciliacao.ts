// Seleção de correspondências para auto-conciliação bancária em lote.
// Função pura (sem dependências) — compartilhada entre API e Web e coberta por testes.

export interface SugestaoConciliacao {
  parcelaId: string
  tituloDescricao: string
  valor: number
  diffValor: number
  score: number
}

export interface TransacaoComSugestoes {
  id: string
  tipo: 'DEBITO' | 'CREDITO'
  valor: number
  nomeOriginal: string | null
  descricao: string | null
  sugestoes: SugestaoConciliacao[]
}

export interface AutoCandidato {
  transacaoId: string
  txNome: string
  txValor: number
  tipo: 'DEBITO' | 'CREDITO'
  parcelaId: string
  tituloDescricao: string
  parcelaValor: number
  diffValor: number
  score: number
  confianca: 'ALTA' | 'MEDIA'
  /** Pagamento menor que a parcela → gera parcela de saldo. */
  parcial: boolean
  /** Pagamento maior que a parcela. */
  sobrepago: boolean
}

export interface OpcoesAutoConciliacao {
  /** Score mínimo para um match entrar (80 = inclui MEDIA, 150 = só ALTA). */
  scoreMinimo?: number
  /** Margem mínima entre o melhor e o 2º match para considerar inequívoco. */
  margemAmbiguidade?: number
}

const TOLERANCIA = 0.005

/**
 * Dada a lista de transações com suas sugestões (ordenadas por score desc),
 * retorna os candidatos seguros para auto-conciliação:
 * - score do melhor match ≥ scoreMinimo
 * - match inequívoco: o melhor vence o 2º por ≥ margemAmbiguidade
 * - unicidade de parcela: se duas transações apontam para a mesma parcela,
 *   mantém apenas a de maior score (a outra fica para revisão manual)
 */
export function selecionarAutoConciliacoes(
  transacoes: TransacaoComSugestoes[],
  opts: OpcoesAutoConciliacao = {},
): AutoCandidato[] {
  const scoreMinimo = opts.scoreMinimo ?? 80
  const margem = opts.margemAmbiguidade ?? 20

  const candidatos: AutoCandidato[] = []
  for (const tx of transacoes) {
    const melhor = tx.sugestoes[0]
    if (!melhor || melhor.score < scoreMinimo) continue

    const segundo = tx.sugestoes[1]
    if (segundo && melhor.score - segundo.score < margem) continue // ambíguo

    candidatos.push({
      transacaoId: tx.id,
      txNome: tx.nomeOriginal || tx.descricao || '—',
      txValor: tx.valor,
      tipo: tx.tipo,
      parcelaId: melhor.parcelaId,
      tituloDescricao: melhor.tituloDescricao,
      parcelaValor: melhor.valor,
      diffValor: melhor.diffValor,
      score: melhor.score,
      confianca: melhor.score >= 150 ? 'ALTA' : 'MEDIA',
      parcial: melhor.diffValor < -TOLERANCIA,
      sobrepago: melhor.diffValor > TOLERANCIA,
    })
  }

  // Unicidade de parcela: uma parcela só pode ser alvo de um candidato
  const porParcela = new Map<string, AutoCandidato>()
  for (const c of candidatos) {
    const atual = porParcela.get(c.parcelaId)
    if (!atual || c.score > atual.score) porParcela.set(c.parcelaId, c)
  }
  return [...porParcela.values()]
}
