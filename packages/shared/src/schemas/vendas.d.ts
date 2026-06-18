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
    desconto: number;
    produtoId: string;
    precoUnitario: number;
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
        desconto: number;
        produtoId: string;
        precoUnitario: number;
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
    id: string;
    criadoEm: Date;
    numero: string;
    status: "ABERTO" | "CONFIRMADO" | "EM_PREPARO" | "ENTREGUE" | "CANCELADO";
    canal: "BALCAO" | "ATACADO" | "DELIVERY" | "ONLINE";
    subtotal: number;
    desconto: number;
    total: number;
    formaPagamento: "DINHEIRO" | "CREDITO" | "DEBITO" | "PIX" | "PRAZO";
    itens: {
        quantidade: number;
        desconto: number;
        produtoId: string;
        precoUnitario: number;
    }[];
    clienteId?: string | undefined;
}, {
    id: string;
    criadoEm: Date;
    numero: string;
    status: "ABERTO" | "CONFIRMADO" | "EM_PREPARO" | "ENTREGUE" | "CANCELADO";
    canal: "BALCAO" | "ATACADO" | "DELIVERY" | "ONLINE";
    subtotal: number;
    total: number;
    formaPagamento: "DINHEIRO" | "CREDITO" | "DEBITO" | "PIX" | "PRAZO";
    itens: {
        quantidade: number;
        produtoId: string;
        precoUnitario: number;
        desconto?: number | undefined;
    }[];
    desconto?: number | undefined;
    clienteId?: string | undefined;
}>;
export type Cliente = z.infer<typeof ClienteSchema>;
export type PedidoVenda = z.infer<typeof PedidoVendaSchema>;
//# sourceMappingURL=vendas.d.ts.map