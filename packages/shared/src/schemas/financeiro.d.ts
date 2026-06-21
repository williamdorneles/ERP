import { z } from 'zod';
export declare const CriarContaBancariaSchema: z.ZodObject<{
    nome: z.ZodString;
    banco: z.ZodOptional<z.ZodString>;
    agencia: z.ZodOptional<z.ZodString>;
    conta: z.ZodOptional<z.ZodString>;
    isCaixa: z.ZodDefault<z.ZodBoolean>;
    saldoInicial: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    nome: string;
    isCaixa: boolean;
    saldoInicial: number;
    banco?: string | undefined;
    agencia?: string | undefined;
    conta?: string | undefined;
}, {
    nome: string;
    banco?: string | undefined;
    agencia?: string | undefined;
    conta?: string | undefined;
    isCaixa?: boolean | undefined;
    saldoInicial?: number | undefined;
}>;
export declare const AtualizarContaBancariaSchema: z.ZodObject<{
    nome: z.ZodOptional<z.ZodString>;
    banco: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    agencia: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    conta: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    isCaixa: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    saldoInicial: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    nome?: string | undefined;
    banco?: string | undefined;
    agencia?: string | undefined;
    conta?: string | undefined;
    isCaixa?: boolean | undefined;
    saldoInicial?: number | undefined;
}, {
    nome?: string | undefined;
    banco?: string | undefined;
    agencia?: string | undefined;
    conta?: string | undefined;
    isCaixa?: boolean | undefined;
    saldoInicial?: number | undefined;
}>;
export declare const LancamentoManualSchema: z.ZodObject<{
    tipo: z.ZodEnum<["DEBITO", "CREDITO"]>;
    valor: z.ZodNumber;
    data: z.ZodString;
    descricao: z.ZodString;
    contaFinanceiraId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    valor: number;
    descricao: string;
    tipo: "DEBITO" | "CREDITO";
    data: string;
    contaFinanceiraId?: string | undefined;
}, {
    valor: number;
    descricao: string;
    tipo: "DEBITO" | "CREDITO";
    data: string;
    contaFinanceiraId?: string | undefined;
}>;
export declare const AjusteSaldoSchema: z.ZodObject<{
    saldoDesejado: z.ZodNumber;
    data: z.ZodString;
    descricao: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    data: string;
    saldoDesejado: number;
    descricao?: string | undefined;
}, {
    data: string;
    saldoDesejado: number;
    descricao?: string | undefined;
}>;
export type CriarContaBancariaInput = z.infer<typeof CriarContaBancariaSchema>;
export type AtualizarContaBancariaInput = z.infer<typeof AtualizarContaBancariaSchema>;
export type LancamentoManualInput = z.infer<typeof LancamentoManualSchema>;
export type AjusteSaldoInput = z.infer<typeof AjusteSaldoSchema>;
export declare const CriarContaFinanceiraSchema: z.ZodObject<{
    codigo: z.ZodString;
    nome: z.ZodString;
    tipo: z.ZodEnum<["RECEITA", "CUSTO", "DESPESA", "NAO_OPERACIONAL"]>;
    natureza: z.ZodEnum<["DEBITO", "CREDITO"]>;
    contaPaiId: z.ZodOptional<z.ZodString>;
    isAnalitica: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    nome: string;
    tipo: "RECEITA" | "CUSTO" | "DESPESA" | "NAO_OPERACIONAL";
    codigo: string;
    natureza: "DEBITO" | "CREDITO";
    isAnalitica: boolean;
    contaPaiId?: string | undefined;
}, {
    nome: string;
    tipo: "RECEITA" | "CUSTO" | "DESPESA" | "NAO_OPERACIONAL";
    codigo: string;
    natureza: "DEBITO" | "CREDITO";
    contaPaiId?: string | undefined;
    isAnalitica?: boolean | undefined;
}>;
export declare const AtualizarContaFinanceiraSchema: z.ZodObject<{
    codigo: z.ZodOptional<z.ZodString>;
    nome: z.ZodOptional<z.ZodString>;
    tipo: z.ZodOptional<z.ZodEnum<["RECEITA", "CUSTO", "DESPESA", "NAO_OPERACIONAL"]>>;
    natureza: z.ZodOptional<z.ZodEnum<["DEBITO", "CREDITO"]>>;
    contaPaiId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    isAnalitica: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    nome?: string | undefined;
    tipo?: "RECEITA" | "CUSTO" | "DESPESA" | "NAO_OPERACIONAL" | undefined;
    codigo?: string | undefined;
    natureza?: "DEBITO" | "CREDITO" | undefined;
    contaPaiId?: string | undefined;
    isAnalitica?: boolean | undefined;
}, {
    nome?: string | undefined;
    tipo?: "RECEITA" | "CUSTO" | "DESPESA" | "NAO_OPERACIONAL" | undefined;
    codigo?: string | undefined;
    natureza?: "DEBITO" | "CREDITO" | undefined;
    contaPaiId?: string | undefined;
    isAnalitica?: boolean | undefined;
}>;
export declare const ClassificarTransacaoSchema: z.ZodObject<{
    contaFinanceiraId: z.ZodString;
    aplicarSimilares: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    contaFinanceiraId: string;
    aplicarSimilares?: boolean | undefined;
}, {
    contaFinanceiraId: string;
    aplicarSimilares?: boolean | undefined;
}>;
export declare const AprovarLoteSchema: z.ZodObject<{
    ids: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    ids: string[];
}, {
    ids: string[];
}>;
export declare const CriarRegraClassificacaoSchema: z.ZodObject<{
    nome: z.ZodString;
    prioridade: z.ZodNumber;
    campo: z.ZodEnum<["NOME", "MEMO", "NOME_OU_MEMO", "VALOR"]>;
    tipoCorrespondencia: z.ZodEnum<["CONTEM", "COMECA_COM", "TERMINA_COM", "IGUAL", "REGEX", "INTERVALO"]>;
    valorCorrespondencia: z.ZodOptional<z.ZodString>;
    valorMin: z.ZodOptional<z.ZodNumber>;
    valorMax: z.ZodOptional<z.ZodNumber>;
    tipoTransacao: z.ZodDefault<z.ZodEnum<["QUALQUER", "DEBITO", "CREDITO"]>>;
    contaFinanceiraId: z.ZodString;
    ativo: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    nome: string;
    ativo: boolean;
    contaFinanceiraId: string;
    prioridade: number;
    campo: "NOME" | "MEMO" | "NOME_OU_MEMO" | "VALOR";
    tipoCorrespondencia: "CONTEM" | "COMECA_COM" | "TERMINA_COM" | "IGUAL" | "REGEX" | "INTERVALO";
    tipoTransacao: "DEBITO" | "CREDITO" | "QUALQUER";
    valorCorrespondencia?: string | undefined;
    valorMin?: number | undefined;
    valorMax?: number | undefined;
}, {
    nome: string;
    contaFinanceiraId: string;
    prioridade: number;
    campo: "NOME" | "MEMO" | "NOME_OU_MEMO" | "VALOR";
    tipoCorrespondencia: "CONTEM" | "COMECA_COM" | "TERMINA_COM" | "IGUAL" | "REGEX" | "INTERVALO";
    ativo?: boolean | undefined;
    valorCorrespondencia?: string | undefined;
    valorMin?: number | undefined;
    valorMax?: number | undefined;
    tipoTransacao?: "DEBITO" | "CREDITO" | "QUALQUER" | undefined;
}>;
export declare const AtualizarRegraClassificacaoSchema: z.ZodObject<{
    nome: z.ZodOptional<z.ZodString>;
    prioridade: z.ZodOptional<z.ZodNumber>;
    campo: z.ZodOptional<z.ZodEnum<["NOME", "MEMO", "NOME_OU_MEMO", "VALOR"]>>;
    tipoCorrespondencia: z.ZodOptional<z.ZodEnum<["CONTEM", "COMECA_COM", "TERMINA_COM", "IGUAL", "REGEX", "INTERVALO"]>>;
    valorCorrespondencia: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    valorMin: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    valorMax: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    tipoTransacao: z.ZodOptional<z.ZodDefault<z.ZodEnum<["QUALQUER", "DEBITO", "CREDITO"]>>>;
    contaFinanceiraId: z.ZodOptional<z.ZodString>;
    ativo: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    nome?: string | undefined;
    ativo?: boolean | undefined;
    contaFinanceiraId?: string | undefined;
    prioridade?: number | undefined;
    campo?: "NOME" | "MEMO" | "NOME_OU_MEMO" | "VALOR" | undefined;
    tipoCorrespondencia?: "CONTEM" | "COMECA_COM" | "TERMINA_COM" | "IGUAL" | "REGEX" | "INTERVALO" | undefined;
    valorCorrespondencia?: string | undefined;
    valorMin?: number | undefined;
    valorMax?: number | undefined;
    tipoTransacao?: "DEBITO" | "CREDITO" | "QUALQUER" | undefined;
}, {
    nome?: string | undefined;
    ativo?: boolean | undefined;
    contaFinanceiraId?: string | undefined;
    prioridade?: number | undefined;
    campo?: "NOME" | "MEMO" | "NOME_OU_MEMO" | "VALOR" | undefined;
    tipoCorrespondencia?: "CONTEM" | "COMECA_COM" | "TERMINA_COM" | "IGUAL" | "REGEX" | "INTERVALO" | undefined;
    valorCorrespondencia?: string | undefined;
    valorMin?: number | undefined;
    valorMax?: number | undefined;
    tipoTransacao?: "DEBITO" | "CREDITO" | "QUALQUER" | undefined;
}>;
export type CriarContaFinanceiraInput = z.infer<typeof CriarContaFinanceiraSchema>;
export type ClassificarTransacaoInput = z.infer<typeof ClassificarTransacaoSchema>;
export type AprovarLoteInput = z.infer<typeof AprovarLoteSchema>;
export type CriarRegraClassificacaoInput = z.infer<typeof CriarRegraClassificacaoSchema>;
//# sourceMappingURL=financeiro.d.ts.map