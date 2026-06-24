// Efeito das movimentações de estoque no saldo do produto.
// Centralizado para garantir que o lançamento e o seu estorno sejam exatamente inversos.

export type TipoMov = 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'PERDA'

/**
 * Quantidade a gravar na movimentação a partir da entrada do usuário (sempre positiva).
 * AJUSTE guarda o sinal (negativo = redução; positivo = aumento); os demais tipos
 * gravam a quantidade positiva e o sinal vem do tipo.
 */
export function quantidadeArmazenada(
  tipo: TipoMov,
  quantidade: number,
  ajusteSentido?: 'ENTRADA' | 'SAIDA',
): number {
  if (tipo === 'AJUSTE') return ajusteSentido === 'ENTRADA' ? quantidade : -quantidade
  return quantidade
}

/**
 * Efeito no saldo do produto de uma movimentação já gravada (quantidade com o sinal correto).
 * - SAIDA / PERDA: reduzem (−)
 * - ENTRADA: aumenta (+)
 * - AJUSTE: usa o sinal da quantidade gravada
 * O estorno de uma movimentação é simplesmente `-efeitoEstoque(...)`.
 */
export function efeitoEstoque(tipo: TipoMov, quantidadeGravada: number): number {
  if (tipo === 'SAIDA' || tipo === 'PERDA') return -quantidadeGravada
  return quantidadeGravada
}
