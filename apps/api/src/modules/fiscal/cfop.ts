export type DestinoOperacao = 'INTERNO' | 'INTERESTADUAL' | 'EXTERIOR'

/**
 * Resolve o CFOP final a partir da base cadastrada na natureza de operação.
 * A base usa o 1º dígito como curinga (ex.: "x102"); o dígito real vem do destino e do tipo:
 *   - SAÍDA:   mesma UF → 5, outra UF → 6, exterior → 7
 *   - ENTRADA: mesma UF → 1, outra UF → 2, exterior → 3
 * Sempre considera os 3 últimos dígitos da base, então "x102", "5102" e "x5102" dão o mesmo CFOP.
 * Retorna null se a base não tiver ao menos 3 dígitos.
 */
export function resolverCfop(
  cfopBase: string | null | undefined,
  tipoOperacao: 'SAIDA' | 'ENTRADA',
  destino: DestinoOperacao,
): string | null {
  if (!cfopBase) return null
  const sufixo = cfopBase.replace(/\D/g, '').slice(-3)
  if (sufixo.length < 3) return null
  const primeiro: Record<DestinoOperacao, string> = tipoOperacao === 'SAIDA'
    ? { INTERNO: '5', INTERESTADUAL: '6', EXTERIOR: '7' }
    : { INTERNO: '1', INTERESTADUAL: '2', EXTERIOR: '3' }
  return primeiro[destino] + sufixo
}

/**
 * Determina o destino de uma operação comparando a UF do emitente com a do destinatário.
 * Sem UF de destino (consumidor final / NFC-e local) assume operação interna.
 */
export function destinoPorUF(ufEmitente?: string | null, ufDestino?: string | null): DestinoOperacao {
  if (ufDestino === 'EX') return 'EXTERIOR'
  if (!ufDestino || !ufEmitente) return 'INTERNO'
  return ufEmitente.toUpperCase() === ufDestino.toUpperCase() ? 'INTERNO' : 'INTERESTADUAL'
}
