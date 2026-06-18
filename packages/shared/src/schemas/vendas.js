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
//# sourceMappingURL=vendas.js.map