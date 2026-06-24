import { z } from 'zod'

export const CategoriaInsumoEnum = z.enum([
  'FARINHA',
  'GORDURA',
  'ACUCAR',
  'FERMENTO',
  'LATICINIOS',
  'OVOS',
  'EMBALAGEM',
  'OUTROS',
])

export const InsumoSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string().max(20),
  nome: z.string().min(2),
  categoria: CategoriaInsumoEnum,
  unidadeMedida: z.enum(['KG', 'G', 'L', 'ML', 'UN', 'CX', 'PCT']),
  estoqueAtual: z.number().min(0).default(0),
  estoqueMínimo: z.number().min(0).default(0),
  custoUnitario: z.number().min(0),
  ativo: z.boolean().default(true),
})

export const MovimentacaoEstoqueSchema = z.object({
  id: z.string().uuid(),
  insumoId: z.string().uuid(),
  tipo: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA']),
  quantidade: z.number().positive(),
  lote: z.string().optional(),
  dataVencimento: z.coerce.date().optional(),
  observacao: z.string().optional(),
  criadoEm: z.coerce.date(),
})

export const CriarMovimentacaoSchema = z.object({
  produtoId: z.string().uuid('produtoId deve ser um UUID válido'),
  tipo: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA']),
  quantidade: z.number().positive('Quantidade deve ser maior que zero'),
  custoUnitario: z.number().min(0).optional(),
  // Sentido do AJUSTE de inventário: ENTRADA aumenta, SAIDA reduz (padrão SAIDA).
  ajusteSentido: z.enum(['ENTRADA', 'SAIDA']).optional(),
  lote: z.string().max(50).optional(),
  dataVencimento: z.coerce.date().optional(),
  observacao: z.string().max(500).optional(),
})

export type Insumo = z.infer<typeof InsumoSchema>
export type MovimentacaoEstoque = z.infer<typeof MovimentacaoEstoqueSchema>
export type CriarMovimentacaoInput = z.infer<typeof CriarMovimentacaoSchema>
