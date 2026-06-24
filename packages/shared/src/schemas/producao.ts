import { z } from 'zod'

export const OrdemProducaoSchema = z.object({
  id: z.string().uuid(),
  numero: z.string(),
  produtoId: z.string().uuid(),
  quantidade: z.number().positive(),
  status: z.enum(['PLANEJADA', 'EM_PRODUCAO', 'CONCLUIDA', 'CANCELADA']),
  turno: z.enum(['MANHA', 'TARDE', 'NOITE']),
  dataProducao: z.coerce.date(),
  responsavelId: z.string().uuid().optional(),
  observacao: z.string().optional(),
  criadoEm: z.coerce.date(),
})

export type OrdemProducao = z.infer<typeof OrdemProducaoSchema>
