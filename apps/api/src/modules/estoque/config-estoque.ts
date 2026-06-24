import { prisma } from '@erp/database'

/**
 * Indica se o sistema permite estoque negativo (config PERMITIR_ESTOQUE_NEGATIVO).
 * Padrão: 'SIM' (permite) — preserva o comportamento anterior quando a chave não existe.
 * Quando 'NAO', as baixas (saída manual, consumo de produção) são bloqueadas se
 * deixariam o saldo negativo.
 */
export async function permiteEstoqueNegativo(): Promise<boolean> {
  const cfg = await prisma.configuracao.findUnique({ where: { chave: 'PERMITIR_ESTOQUE_NEGATIVO' } })
  return (cfg?.valor ?? 'SIM') !== 'NAO'
}
