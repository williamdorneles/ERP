import { z } from 'zod';
export declare const ParcelaInputSchema: z.ZodObject<{
    numero: z.ZodNumber;
    valor: z.ZodNumber;
    vencimento: z.ZodString;
    observacao: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    valor: number;
    numero: number;
    vencimento: string;
    observacao?: string | undefined;
}, {
    valor: number;
    numero: number;
    vencimento: string;
    observacao?: string | undefined;
}>;
export declare const CriarTituloSchema: z.ZodObject<{
    tipo: z.ZodEnum<["PAGAR", "RECEBER"]>;
    descricao: z.ZodString;
    documento: z.ZodOptional<z.ZodString>;
    pessoaId: z.ZodOptional<z.ZodString>;
    pedidoVendaId: z.ZodOptional<z.ZodString>;
    contaFinanceiraId: z.ZodOptional<z.ZodString>;
    observacao: z.ZodOptional<z.ZodString>;
    parcelas: z.ZodArray<z.ZodObject<{
        numero: z.ZodNumber;
        valor: z.ZodNumber;
        vencimento: z.ZodString;
        observacao: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        valor: number;
        numero: number;
        vencimento: string;
        observacao?: string | undefined;
    }, {
        valor: number;
        numero: number;
        vencimento: string;
        observacao?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    descricao: string;
    tipo: "PAGAR" | "RECEBER";
    parcelas: {
        valor: number;
        numero: number;
        vencimento: string;
        observacao?: string | undefined;
    }[];
    observacao?: string | undefined;
    documento?: string | undefined;
    pessoaId?: string | undefined;
    pedidoVendaId?: string | undefined;
    contaFinanceiraId?: string | undefined;
}, {
    descricao: string;
    tipo: "PAGAR" | "RECEBER";
    parcelas: {
        valor: number;
        numero: number;
        vencimento: string;
        observacao?: string | undefined;
    }[];
    observacao?: string | undefined;
    documento?: string | undefined;
    pessoaId?: string | undefined;
    pedidoVendaId?: string | undefined;
    contaFinanceiraId?: string | undefined;
}>;
export declare const AtualizarTituloSchema: z.ZodObject<{
    descricao: z.ZodOptional<z.ZodString>;
    documento: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    pessoaId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    contaFinanceiraId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    observacao: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    descricao?: string | undefined;
    observacao?: string | null | undefined;
    documento?: string | null | undefined;
    pessoaId?: string | null | undefined;
    contaFinanceiraId?: string | null | undefined;
}, {
    descricao?: string | undefined;
    observacao?: string | null | undefined;
    documento?: string | null | undefined;
    pessoaId?: string | null | undefined;
    contaFinanceiraId?: string | null | undefined;
}>;
export declare const BaixarParcelaSchema: z.ZodObject<{
    dataBaixa: z.ZodString;
    valorPago: z.ZodNumber;
    contaBancariaId: z.ZodString;
    juros: z.ZodOptional<z.ZodNumber>;
    multa: z.ZodOptional<z.ZodNumber>;
    taxas: z.ZodOptional<z.ZodNumber>;
    observacao: z.ZodOptional<z.ZodString>;
    vencimentoRestante: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    dataBaixa: string;
    valorPago: number;
    contaBancariaId: string;
    observacao?: string | undefined;
    juros?: number | undefined;
    multa?: number | undefined;
    taxas?: number | undefined;
    vencimentoRestante?: string | undefined;
}, {
    dataBaixa: string;
    valorPago: number;
    contaBancariaId: string;
    observacao?: string | undefined;
    juros?: number | undefined;
    multa?: number | undefined;
    taxas?: number | undefined;
    vencimentoRestante?: string | undefined;
}>;
export type ParcelaInput = z.infer<typeof ParcelaInputSchema>;
export type CriarTituloInput = z.infer<typeof CriarTituloSchema>;
export type AtualizarTituloInput = z.infer<typeof AtualizarTituloSchema>;
export type BaixarParcelaInput = z.infer<typeof BaixarParcelaSchema>;
//# sourceMappingURL=titulos.d.ts.map