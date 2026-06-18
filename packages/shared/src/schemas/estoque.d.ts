import { z } from 'zod';
export declare const CategoriaInsumoEnum: z.ZodEnum<["FARINHA", "GORDURA", "ACUCAR", "FERMENTO", "LATICINIOS", "OVOS", "EMBALAGEM", "OUTROS"]>;
export declare const InsumoSchema: z.ZodObject<{
    id: z.ZodString;
    codigo: z.ZodString;
    nome: z.ZodString;
    categoria: z.ZodEnum<["FARINHA", "GORDURA", "ACUCAR", "FERMENTO", "LATICINIOS", "OVOS", "EMBALAGEM", "OUTROS"]>;
    unidadeMedida: z.ZodEnum<["KG", "G", "L", "ML", "UN", "CX", "PCT"]>;
    estoqueAtual: z.ZodDefault<z.ZodNumber>;
    estoqueMínimo: z.ZodDefault<z.ZodNumber>;
    custoUnitario: z.ZodNumber;
    ativo: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    nome: string;
    ativo: boolean;
    codigo: string;
    categoria: "FARINHA" | "GORDURA" | "ACUCAR" | "FERMENTO" | "LATICINIOS" | "OVOS" | "EMBALAGEM" | "OUTROS";
    unidadeMedida: "KG" | "G" | "L" | "ML" | "UN" | "CX" | "PCT";
    estoqueAtual: number;
    estoqueMínimo: number;
    custoUnitario: number;
}, {
    id: string;
    nome: string;
    codigo: string;
    categoria: "FARINHA" | "GORDURA" | "ACUCAR" | "FERMENTO" | "LATICINIOS" | "OVOS" | "EMBALAGEM" | "OUTROS";
    unidadeMedida: "KG" | "G" | "L" | "ML" | "UN" | "CX" | "PCT";
    custoUnitario: number;
    ativo?: boolean | undefined;
    estoqueAtual?: number | undefined;
    estoqueMínimo?: number | undefined;
}>;
export declare const MovimentacaoEstoqueSchema: z.ZodObject<{
    id: z.ZodString;
    insumoId: z.ZodString;
    tipo: z.ZodEnum<["ENTRADA", "SAIDA", "AJUSTE", "PERDA"]>;
    quantidade: z.ZodNumber;
    lote: z.ZodOptional<z.ZodString>;
    dataVencimento: z.ZodOptional<z.ZodDate>;
    observacao: z.ZodOptional<z.ZodString>;
    criadoEm: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    criadoEm: Date;
    quantidade: number;
    insumoId: string;
    tipo: "ENTRADA" | "SAIDA" | "AJUSTE" | "PERDA";
    observacao?: string | undefined;
    lote?: string | undefined;
    dataVencimento?: Date | undefined;
}, {
    id: string;
    criadoEm: Date;
    quantidade: number;
    insumoId: string;
    tipo: "ENTRADA" | "SAIDA" | "AJUSTE" | "PERDA";
    observacao?: string | undefined;
    lote?: string | undefined;
    dataVencimento?: Date | undefined;
}>;
export type Insumo = z.infer<typeof InsumoSchema>;
export type MovimentacaoEstoque = z.infer<typeof MovimentacaoEstoqueSchema>;
//# sourceMappingURL=estoque.d.ts.map