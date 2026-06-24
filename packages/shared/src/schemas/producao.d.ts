import { z } from 'zod';
export declare const OrdemProducaoSchema: z.ZodObject<{
    id: z.ZodString;
    numero: z.ZodString;
    produtoId: z.ZodString;
    quantidade: z.ZodNumber;
    status: z.ZodEnum<["PLANEJADA", "EM_PRODUCAO", "CONCLUIDA", "CANCELADA"]>;
    turno: z.ZodEnum<["MANHA", "TARDE", "NOITE"]>;
    dataProducao: z.ZodDate;
    responsavelId: z.ZodOptional<z.ZodString>;
    observacao: z.ZodOptional<z.ZodString>;
    criadoEm: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    status: "PLANEJADA" | "EM_PRODUCAO" | "CONCLUIDA" | "CANCELADA";
    id: string;
    criadoEm: Date;
    numero: string;
    quantidade: number;
    produtoId: string;
    turno: "MANHA" | "TARDE" | "NOITE";
    dataProducao: Date;
    observacao?: string | undefined;
    responsavelId?: string | undefined;
}, {
    status: "PLANEJADA" | "EM_PRODUCAO" | "CONCLUIDA" | "CANCELADA";
    id: string;
    criadoEm: Date;
    numero: string;
    quantidade: number;
    produtoId: string;
    turno: "MANHA" | "TARDE" | "NOITE";
    dataProducao: Date;
    observacao?: string | undefined;
    responsavelId?: string | undefined;
}>;
export type OrdemProducao = z.infer<typeof OrdemProducaoSchema>;
//# sourceMappingURL=producao.d.ts.map
