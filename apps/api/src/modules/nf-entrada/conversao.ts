// Conversão de unidade de compra → unidade de estoque para itens de NF de entrada.
// Centralizado aqui para que lançar estoque, formar custo, preview e estorno usem
// exatamente a mesma fórmula (evita drift entre os fluxos).

export type OperacaoConversao = 'MULTIPLICAR' | 'DIVIDIR' | null | undefined

/**
 * Converte a quantidade da nota (unidade de compra) para a unidade de estoque.
 * - MULTIPLICAR: qtde * fator
 * - DIVIDIR:     qtde / fator
 * - nenhuma:     qtde inalterada
 * Fator inválido/ausente é tratado como 1 (sem conversão).
 */
export function converterQtde(
  qtdeNf: number,
  fatorConversao: number | null | undefined,
  operacaoConversao: OperacaoConversao,
): number {
  const fator = fatorConversao && fatorConversao > 0 ? Number(fatorConversao) : 1
  if (operacaoConversao === 'MULTIPLICAR') return qtdeNf * fator
  if (operacaoConversao === 'DIVIDIR') return qtdeNf / fator
  return qtdeNf
}

/**
 * Custo por unidade de estoque a partir do valor total do item da nota.
 * Cai para valorUnitario (por unidade de compra) apenas quando não há quantidade de estoque.
 */
export function custoPorUnidadeEstoque(
  valorTotal: number,
  qtdeEstoque: number,
  valorUnitario: number,
): number {
  return qtdeEstoque > 0 ? valorTotal / qtdeEstoque : valorUnitario
}
