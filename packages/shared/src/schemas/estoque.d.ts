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
    categoria: "FARINHA" | "GORDURA" | "ACUCAR" | "FERMENTO" | "LATICINIOS" | "OVOS" | "EMBALAGEM" | "OUTROS";
    id: string;
    nome: string;
    ativo: boolean;
    codigo: string;
    unidadeMedida: "KG" | "G" | "L" | "ML" | "UN" | "CX" | "PCT";
    estoqueAtual: number;
    estoqueMínimo: number;
    custoUnitario: number;
}, {
    categoria: "FARINHA" | "GORDURA" | "ACUCAR" | "FERMENTO" | "LATICINIOS" | "OVOS" | "EMBALAGEM" | "OUTROS";
    id: string;
    nome: string;
    codigo: string;
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
    tipo: "ENTRADA" | "SAIDA" | "AJUSTE" | "PERDA";
    insumoId: string;
    quantidade: number;
    observacao?: string | undefined;
    lote?: string | undefined;
    dataVencimento?: Date | undefined;
}, {
    id: string;
    criadoEm: Date;
    tipo: "ENTRADA" | "SAIDA" | "AJUSTE" | "PERDA";
    insumoId: string;
    quantidade: number;
    observacao?: string | undefined;
    lote?: string | undefined;
    dataVencimento?: Date | undefined;
}>;
export declare const CriarMovimentacaoSchema: z.ZodObject<{
    produtoId: z.ZodString;
    tipo: z.ZodEnum<["ENTRADA", "SAIDA", "AJUSTE", "PERDA"]>;
    quantidade: z.ZodNumber;
    lote: z.ZodOptional<z.ZodString>;
    dataVencimento: z.ZodOptional<z.ZodDate>;
    observacao: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tipo: "ENTRADA" | "SAIDA" | "AJUSTE" | "PERDA";
    quantidade: number;
    produtoId: string;
    observacao?: string | undefined;
    lote?: string | undefined;
    dataVencimento?: Date | undefined;
}, {
    tipo: "ENTRADA" | "SAIDA" | "AJUSTE" | "PERDA";
    quantidade: number;
    produtoId: string;
    observacao?: string | undefined;
    lote?: string | undefined;
    dataVencimento?: Date | undefined;
}>;
export type Insumo = z.infer<typeof InsumoSchema>;
export type MovimentacaoEstoque = z.infer<typeof MovimentacaoEstoqueSchema>;
export type CriarMovimentacaoInput = z.infer<typeof CriarMovimentacaoSchema>;
//# sourceMappingURL=estoque.d.ts.map