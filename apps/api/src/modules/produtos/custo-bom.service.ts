/**
 * Calcula o custo unitário de um produto a partir dos itens do seu BOM.
 * custo do lote = Σ (custo do componente × quantidade × (1 + perda%)); dividido pela qtde produzida.
 *
 * Usado como ESTIMATIVA (custo teórico): semente do custo ao definir a receita, preview de
 * formação de custo e cálculo de variância na produção. O custo "de verdade" de um produto
 * fabricado é apurado no apontamento de produção (custo real do lote), não por esta fórmula —
 * por isso não há mais propagação automática em cascata quando um componente muda de preço.
 */
export function calcularCustoBom(
  itens: { quantidade: number; percPerda: number; componente: { custoUnitario: unknown } }[],
  qtdeProduzida: number,
): number {
  const total = itens.reduce((acc, item) => {
    const custo = Number(item.componente.custoUnitario)
    const fator = 1 + item.percPerda / 100
    return acc + custo * Number(item.quantidade) * fator
  }, 0)
  return qtdeProduzida > 0 ? +(total / qtdeProduzida).toFixed(4) : 0
}
