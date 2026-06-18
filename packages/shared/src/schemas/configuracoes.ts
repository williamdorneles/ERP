import { z } from 'zod'

export const MetodoCustoEnum = z.enum(['MEDIO', 'ULTIMO'])

export const AtualizarConfiguracaoSchema = z.object({
  valor: z.string().min(1).max(200),
})

export type MetodoCusto = z.infer<typeof MetodoCustoEnum>
export type AtualizarConfiguracaoInput = z.infer<typeof AtualizarConfiguracaoSchema>
