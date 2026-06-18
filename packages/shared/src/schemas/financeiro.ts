import { z } from 'zod'

export const CriarContaBancariaSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  banco: z.string().max(50).optional(),
  agencia: z.string().max(10).optional(),
  conta: z.string().max(20).optional(),
})

export const CriarContaFinanceiraSchema = z.object({
  codigo: z.string().min(1).max(20),
  nome: z.string().min(2).max(200),
  tipo: z.enum(['RECEITA', 'CUSTO', 'DESPESA', 'NAO_OPERACIONAL']),
  natureza: z.enum(['DEBITO', 'CREDITO']),
  contaPaiId: z.string().uuid().optional(),
  isAnalitica: z.boolean().default(true),
})

export const AtualizarContaFinanceiraSchema = CriarContaFinanceiraSchema.partial()

export const ClassificarTransacaoSchema = z.object({
  contaFinanceiraId: z.string().uuid('contaFinanceiraId deve ser um UUID válido'),
  aplicarSimilares: z.boolean().optional(),
})

export const AprovarLoteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Informe ao menos um id'),
})

export const CriarRegraClassificacaoSchema = z.object({
  nome: z.string().min(2).max(200),
  prioridade: z.number().int().min(1),
  campo: z.enum(['NOME', 'MEMO', 'NOME_OU_MEMO', 'VALOR']),
  tipoCorrespondencia: z.enum(['CONTEM', 'COMECA_COM', 'TERMINA_COM', 'IGUAL', 'REGEX', 'INTERVALO']),
  valorCorrespondencia: z.string().max(500).optional(),
  valorMin: z.number().optional(),
  valorMax: z.number().optional(),
  tipoTransacao: z.enum(['QUALQUER', 'DEBITO', 'CREDITO']).default('QUALQUER'),
  contaFinanceiraId: z.string().uuid('contaFinanceiraId deve ser um UUID válido'),
  ativo: z.boolean().default(true),
})

export const AtualizarRegraClassificacaoSchema = CriarRegraClassificacaoSchema.partial()

export type CriarContaBancariaInput = z.infer<typeof CriarContaBancariaSchema>
export type CriarContaFinanceiraInput = z.infer<typeof CriarContaFinanceiraSchema>
export type ClassificarTransacaoInput = z.infer<typeof ClassificarTransacaoSchema>
export type AprovarLoteInput = z.infer<typeof AprovarLoteSchema>
export type CriarRegraClassificacaoInput = z.infer<typeof CriarRegraClassificacaoSchema>
