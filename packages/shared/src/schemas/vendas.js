import { z } from 'zod';
export const ClienteSchema = z.object({
    id: z.string().uuid(),
    tipo: z.enum(['PF', 'PJ']),
    nome: z.string().min(2),
    documento: z.string().optional(),
    email: z.string().email().optional(),
    telefone: z.string().optional(),
    endereco: z.string().optional(),
    limiteCredito: z.number().min(0).default(0),
    ativo: z.boolean().default(true),
});
export const ItemPedidoSchema = z.object({
    produtoId: z.string().uuid(),
    quantidade: z.number().positive(),
    precoUnitario: z.number().positive(),
    desconto: z.number().min(0).default(0),
});
export const PedidoVendaSchema = z.object({
    id: z.string().uuid(),
    numero: z.string(),
    clienteId: z.string().uuid().optional(),
    canal: z.enum(['BALCAO', 'ATACADO', 'DELIVERY', 'ONLINE']),
    status: z.enum(['ABERTO', 'CONFIRMADO', 'EM_PREPARO', 'ENTREGUE', 'CANCELADO']),
    itens: z.array(ItemPedidoSchema),
    subtotal: z.number().min(0),
    desconto: z.number().min(0).default(0),
    total: z.number().min(0),
    formaPagamento: z.enum(['DINHEIRO', 'CREDITO', 'DEBITO', 'PIX', 'PRAZO']),
    criadoEm: z.coerce.date(),
});
export const CriarPedidoVendaSchema = z.object({
    pessoaId: z.string().uuid().optional(),
    canal: z.enum(['BALCAO', 'ATACADO', 'DELIVERY', 'ONLINE']),
    formaPagamento: z.enum(['DINHEIRO', 'CREDITO', 'DEBITO', 'PIX', 'PRAZO']),
    desconto: z.number().min(0).default(0),
    vendedorId: z.string().uuid().optional(),
    observacao: z.string().max(1000).optional(),
    itens: z.array(z.object({
        produtoId: z.string().uuid('produtoId deve ser um UUID válido'),
        quantidade: z.number().positive('Quantidade deve ser maior que zero'),
        precoUnitario: z.number().positive('Preço deve ser maior que zero'),
        desconto: z.number().min(0).default(0),
    })).min(1, 'Pedido deve ter ao menos um item'),
});
export const AtualizarStatusPedidoSchema = z.object({
    status: z.enum(['ABERTO', 'CONFIRMADO', 'EM_PREPARO', 'ENTREGUE', 'CANCELADO']),
});
//# sourceMappingURL=vendas.js.map