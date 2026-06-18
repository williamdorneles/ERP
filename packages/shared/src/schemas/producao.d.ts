import { z } from 'zod';
export declare const IngredienteFichaSchema: z.ZodObject<{
    insumoId: z.ZodString;
    quantidade: z.ZodNumber;
    unidadeMedida: z.ZodEnum<["KG", "G", "L", "ML", "UN"]>;
    observacao: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    quantidade: number;
    unidadeMedida: "KG" | "G" | "L" | "ML" | "UN";
    insumoId: string;
    observacao?: string | undefined;
}, {
    quantidade: number;
    unidadeMedida: "KG" | "G" | "L" | "ML" | "UN";
    insumoId: string;
    observacao?: string | undefined;
}>;
export declare const FichaTecnicaSchema: z.ZodObject<{
    id: z.ZodString;
    codigo: z.ZodString;
    nome: z.ZodString;
    categoria: z.ZodEnum<["PAO", "BOLO", "DOCE", "SALGADO", "MASSA", "RECHEIO", "OUTROS"]>;
    rendimento: z.ZodNumber;
    unidadeRendimento: z.ZodEnum<["KG", "G", "UN"]>;
    tempoPreparo: z.ZodOptional<z.ZodNumber>;
    tempoFermentacao: z.ZodOptional<z.ZodNumber>;
    temperaturaForno: z.ZodOptional<z.ZodNumber>;
    ingredientes: z.ZodArray<z.ZodObject<{
        insumoId: z.ZodString;
        quantidade: z.ZodNumber;
        unidadeMedida: z.ZodEnum<["KG", "G", "L", "ML", "UN"]>;
        observacao: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        quantidade: number;
        unidadeMedida: "KG" | "G" | "L" | "ML" | "UN";
        insumoId: string;
        observacao?: string | undefined;
    }, {
        quantidade: number;
        unidadeMedida: "KG" | "G" | "L" | "ML" | "UN";
        insumoId: string;
        observacao?: string | undefined;
    }>, "many">;
    instrucoes: z.ZodOptional<z.ZodString>;
    ativo: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    nome: string;
    ativo: boolean;
    codigo: string;
    categoria: "OUTROS" | "PAO" | "BOLO" | "DOCE" | "SALGADO" | "MASSA" | "RECHEIO";
    rendimento: number;
    unidadeRendimento: "KG" | "G" | "UN";
    ingredientes: {
        quantidade: number;
        unidadeMedida: "KG" | "G" | "L" | "ML" | "UN";
        insumoId: string;
        observacao?: string | undefined;
    }[];
    tempoPreparo?: number | undefined;
    tempoFermentacao?: number | undefined;
    temperaturaForno?: number | undefined;
    instrucoes?: string | undefined;
}, {
    id: string;
    nome: string;
    codigo: string;
    categoria: "OUTROS" | "PAO" | "BOLO" | "DOCE" | "SALGADO" | "MASSA" | "RECHEIO";
    rendimento: number;
    unidadeRendimento: "KG" | "G" | "UN";
    ingredientes: {
        quantidade: number;
        unidadeMedida: "KG" | "G" | "L" | "ML" | "UN";
        insumoId: string;
        observacao?: string | undefined;
    }[];
    ativo?: boolean | undefined;
    tempoPreparo?: number | undefined;
    tempoFermentacao?: number | undefined;
    temperaturaForno?: number | undefined;
    instrucoes?: string | undefined;
}>;
export declare const OrdemProducaoSchema: z.ZodObject<{
    id: z.ZodString;
    numero: z.ZodString;
    fichaTecnicaId: z.ZodString;
    quantidade: z.ZodNumber;
    status: z.ZodEnum<["PLANEJADA", "EM_PRODUCAO", "CONCLUIDA", "CANCELADA"]>;
    turno: z.ZodEnum<["MANHA", "TARDE", "NOITE"]>;
    dataProducao: z.ZodDate;
    responsavelId: z.ZodOptional<z.ZodString>;
    observacao: z.ZodOptional<z.ZodString>;
    criadoEm: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    criadoEm: Date;
    numero: string;
    fichaTecnicaId: string;
    quantidade: number;
    status: "PLANEJADA" | "EM_PRODUCAO" | "CONCLUIDA" | "CANCELADA";
    turno: "MANHA" | "TARDE" | "NOITE";
    dataProducao: Date;
    responsavelId?: string | undefined;
    observacao?: string | undefined;
}, {
    id: string;
    criadoEm: Date;
    numero: string;
    fichaTecnicaId: string;
    quantidade: number;
    status: "PLANEJADA" | "EM_PRODUCAO" | "CONCLUIDA" | "CANCELADA";
    turno: "MANHA" | "TARDE" | "NOITE";
    dataProducao: Date;
    responsavelId?: string | undefined;
    observacao?: string | undefined;
}>;
export type FichaTecnica = z.infer<typeof FichaTecnicaSchema>;
export type OrdemProducao = z.infer<typeof OrdemProducaoSchema>;
//# sourceMappingURL=producao.d.ts.map