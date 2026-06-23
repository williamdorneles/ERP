import { z } from 'zod'

export const MetodoCustoEnum = z.enum(['MEDIO', 'ULTIMO'])

export const AtualizarConfiguracaoSchema = z.object({
  // Permite string vazia para "limpar" uma configuração (ex.: remover vínculo de conta)
  valor: z.string().max(200),
})

export type MetodoCusto = z.infer<typeof MetodoCustoEnum>
export type AtualizarConfiguracaoInput = z.infer<typeof AtualizarConfiguracaoSchema>
