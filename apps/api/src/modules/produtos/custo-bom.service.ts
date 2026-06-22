import { Prisma } from '@erp/database'

/**
 * Calcula o custo unitário de um produto a partir dos itens do seu BOM.
 * custo do lote = Σ (custo do componente × quantidade × (1 + perda%)); dividido pela qtde produzida.
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

/**
 * Propaga a alteração de custo de um componente para todos os produtos com BOM
 * que o utilizam, recalculando o custoUnitario deles em cascata (multi-nível).
 * Deve ser chamada DENTRO de uma transação, após atualizar o custo do componente.
 *
 * @param tx           cliente Prisma da transação corrente
 * @param componenteId produto cujo custo acabou de mudar
 * @param visitados    guarda contra ciclos (A usa B, B usa A)
 */
export async function propagarCustoComponente(
  tx: Prisma.TransactionClient,
  componenteId: string,
  visitados = new Set<string>(),
): Promise<void> {
  if (visitados.has(componenteId)) return
  visitados.add(componenteId)

  // BOMs (produtos-pai) que usam este componente
  const itens = await tx.produtoBomItem.findMany({
    where: { componenteId },
    select: { bom: { select: { id: true, produtoId: true, qtdeProduzida: true } } },
  })

  const boms = new Map<string, { bomId: string; produtoId: string; qtdeProduzida: number }>()
  for (const it of itens) {
    boms.set(it.bom.id, { bomId: it.bom.id, produtoId: it.bom.produtoId, qtdeProduzida: Number(it.bom.qtdeProduzida) })
  }

  for (const b of boms.values()) {
    // Recalcula o custo do produto-pai com os custos atuais dos componentes
    const bomItens = await tx.produtoBomItem.findMany({
      where: { bomId: b.bomId },
      select: { quantidade: true, percPerda: true, componente: { select: { custoUnitario: true } } },
    })
    const novoCusto = calcularCustoBom(
      bomItens.map(i => ({ quantidade: Number(i.quantidade), percPerda: Number(i.percPerda), componente: i.componente })),
      b.qtdeProduzida,
    )

    const atual = await tx.produto.findUnique({ where: { id: b.produtoId }, select: { custoUnitario: true } })
    if (atual && Number(atual.custoUnitario) === novoCusto) continue // sem mudança real → não propaga

    await tx.produto.update({ where: { id: b.produtoId }, data: { custoUnitario: novoCusto } })
    await tx.produtoCusto.create({
      data: {
        produtoId: b.produtoId,
        custo: novoCusto,
        motivo: 'BOM',
        observacao: 'Recálculo automático por alteração de custo de componente',
      },
    })

    // O produto-pai pode ser componente de outro BOM → cascata para cima
    await propagarCustoComponente(tx, b.produtoId, visitados)
  }
}
