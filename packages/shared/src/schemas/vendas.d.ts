import { z } from 'zod';
export declare const ClienteSchema: z.ZodObject<{
    id: z.ZodString;
    tipo: z.ZodEnum<["PF", "PJ"]>;
    nome: z.ZodString;
    documento: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    telefone: z.ZodOptional<z.ZodString>;
    endereco: z.ZodOptional<z.ZodString>;
    limiteCredito: z.ZodDefault<z.ZodNumber>;
    ativo: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    nome: string;
    ativo: boolean;
    tipo: "PF" | "PJ";
    limiteCredito: number;
    email?: string | undefined;
    documento?: string | undefined;
    telefone?: string | undefined;
    endereco?: string | undefined;
}, {
    id: string;
    nome: string;
    tipo: "PF" | "PJ";
    email?: string | undefined;
    ativo?: boolean | undefined;
    documento?: string | undefined;
    telefone?: string | undefined;
    endereco?: string | undefined;
    limiteCredito?: number | undefined;
}>;
export declare const ItemPedidoSchema: z.ZodObject<{
    produtoId: z.ZodString;
    quantidade: z.ZodNumber;
    precoUnitario: z.ZodNumber;
    desconto: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    quantidade: number;
    produtoId: string;
    precoUnitario: number;
    desconto: number;
}, {
    quantidade: number;
    produtoId: string;
    precoUnitario: number;
    desconto?: number | undefined;
}>;
export declare const PedidoVendaSchema: z.ZodObject<{
    id: z.ZodString;
    numero: z.ZodString;
    clienteId: z.ZodOptional<z.ZodString>;
    canal: z.ZodEnum<["BALCAO", "ATACADO", "DELIVERY", "ONLINE"]>;
    status: z.ZodEnum<["ABERTO", "CONFIRMADO", "EM_PREPARO", "ENTREGUE", "CANCELADO"]>;
    itens: z.ZodArray<z.ZodObject<{
        produtoId: z.ZodString;
        quantidade: z.ZodNumber;
        precoUnitario: z.ZodNumber;
        desconto: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        quantidade: number;
        produtoId: string;
        precoUnitario: number;
        desconto: number;
    }, {
        quantidade: number;
        produtoId: string;
        precoUnitario: number;
        desconto?: number | undefined;
    }>, "many">;
    subtotal: z.ZodNumber;
    desconto: z.ZodDefault<z.ZodNumber>;
    total: z.ZodNumber;
    formaPagamento: z.ZodEnum<["DINHEIRO", "CREDITO", "DEBITO", "PIX", "PRAZO"]>;
    criadoEm: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    status: "ABERTO" | "CONFIRMADO" | "EM_PREPARO" | "ENTREGUE" | "CANCELADO";
    id: string;
    criadoEm: Date;
    numero: string;
    desconto: number;
    canal: "BALCAO" | "ATACADO" | "DELIVERY" | "ONLINE";
    itens: {
        quantidade: number;
        produtoId: string;
        precoUnitario: number;
        desconto: number;
    }[];
    subtotal: number;
    total: number;
    formaPagamento: "DEBITO" | "CREDITO" | "DINHEIRO" | "PIX" | "PRAZO";
    clienteId?: string | undefined;
}, {
    status: "ABERTO" | "CONFIRMADO" | "EM_PREPARO" | "ENTREGUE" | "CANCELADO";
    id: string;
    criadoEm: Date;
    numero: string;
    canal: "BALCAO" | "ATACADO" | "DELIVERY" | "ONLINE";
    itens: {
        quantidade: number;
        produtoId: string;
        precoUnitario: number;
        desconto?: number | undefined;
    }[];
    subtotal: number;
    total: number;
    formaPagamento: "DEBITO" | "CREDITO" | "DINHEIRO" | "PIX" | "PRAZO";
    desconto?: number | undefined;
    clienteId?: string | undefined;
}>;
export declare const CriarPedidoVendaSchema: z.ZodObject<{
    pessoaId: z.ZodOptional<z.ZodString>;
    canal: z.ZodEnum<["BALCAO", "ATACADO", "DELIVERY", "ONLINE"]>;
    formaPagamento: z.ZodEnum<["DINHEIRO", "CREDITO", "DEBITO", "PIX", "PRAZO"]>;
    desconto: z.ZodDefault<z.ZodNumber>;
    vendedorId: z.ZodOptional<z.ZodString>;
    observacao: z.ZodOptional<z.ZodString>;
    itens: z.ZodArray<z.ZodObject<{
        produtoId: z.ZodString;
        quantidade: z.ZodNumber;
        precoUnitario: z.ZodNumber;
        desconto: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        quantidade: number;
        produtoId: string;
        precoUnitario: number;
        desconto: number;
    }, {
        quantidade: number;
        produtoId: string;
        precoUnitario: number;
        desconto?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    desconto: number;
    canal: "BALCAO" | "ATACADO" | "DELIVERY" | "ONLINE";
    itens: {
        quantidade: number;
        produtoId: string;
        precoUnitario: number;
        desconto: number;
    }[];
    formaPagamento: "DEBITO" | "CREDITO" | "DINHEIRO" | "PIX" | "PRAZO";
    observacao?: string | undefined;
    pessoaId?: string | undefined;
    vendedorId?: string | undefined;
}, {
    canal: "BALCAO" | "ATACADO" | "DELIVERY" | "ONLINE";
    itens: {
        quantidade: number;
        produtoId: string;
        precoUnitario: number;
        desconto?: number | undefined;
    }[];
    formaPagamento: "DEBITO" | "CREDITO" | "DINHEIRO" | "PIX" | "PRAZO";
    observacao?: string | undefined;
    pessoaId?: string | undefined;
    desconto?: number | undefined;
    vendedorId?: string | undefined;
}>;
export declare const AtualizarStatusPedidoSchema: z.ZodObject<{
    status: z.ZodEnum<["ABERTO", "CONFIRMADO", "EM_PREPARO", "ENTREGUE", "CANCELADO"]>;
}, "strip", z.ZodTypeAny, {
    status: "ABERTO" | "CONFIRMADO" | "EM_PREPARO" | "ENTREGUE" | "CANCELADO";
}, {
    status: "ABERTO" | "CONFIRMADO" | "EM_PREPARO" | "ENTREGUE" | "CANCELADO";
}>;
export type Cliente = z.infer<typeof ClienteSchema>;
export type PedidoVenda = z.infer<typeof PedidoVendaSchema>;
export type CriarPedidoVendaInput = z.infer<typeof CriarPedidoVendaSchema>;
export type AtualizarStatusPedidoInput = z.infer<typeof AtualizarStatusPedidoSchema>;
//# sourceMappingURL=vendas.d.ts.map