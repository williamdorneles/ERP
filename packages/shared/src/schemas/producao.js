import { z } from 'zod';
export const IngredienteFichaSchema = z.object({
    insumoId: z.string().uuid(),
    quantidade: z.number().positive(),
    unidadeMedida: z.enum(['KG', 'G', 'L', 'ML', 'UN']),
    observacao: z.string().optional(),
});
export const FichaTecnicaSchema = z.object({
    id: z.string().uuid(),
    codigo: z.string().max(20),
    nome: z.string().min(2),
    categoria: z.enum(['PAO', 'BOLO', 'DOCE', 'SALGADO', 'MASSA', 'RECHEIO', 'OUTROS']),
    rendimento: z.number().positive(),
    unidadeRendimento: z.enum(['KG', 'G', 'UN']),
    tempoPreparo: z.number().int().positive().optional(),
    tempoFermentacao: z.number().int().optional(),
    temperaturaForno: z.number().optional(),
    ingredientes: z.array(IngredienteFichaSchema),
    instrucoes: z.string().optional(),
    ativo: z.boolean().default(true),
});
export const OrdemProducaoSchema = z.object({
    id: z.string().uuid(),
    numero: z.string(),
    fichaTecnicaId: z.string().uuid(),
    quantidade: z.number().positive(),
    status: z.enum(['PLANEJADA', 'EM_PRODUCAO', 'CONCLUIDA', 'CANCELADA']),
    turno: z.enum(['MANHA', 'TARDE', 'NOITE']),
    dataProducao: z.coerce.date(),
    responsavelId: z.string().uuid().optional(),
    observacao: z.string().optional(),
    criadoEm: z.coerce.date(),
});
//# sourceMappingURL=producao.js.map