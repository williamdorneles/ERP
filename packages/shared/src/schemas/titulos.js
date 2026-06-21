import { z } from 'zod';
export const ParcelaInputSchema = z.object({
    numero: z.number().int().min(1),
    valor: z.number().positive('Valor deve ser positivo'),
    vencimento: z.string().min(1, 'Vencimento obrigatório'),
    observacao: z.string().max(200).optional(),
});
export const CriarTituloSchema = z.object({
    tipo: z.enum(['PAGAR', 'RECEBER']),
    descricao: z.string().min(2).max(200),
    documento: z.string().max(100).optional(),
    pessoaId: z.string().uuid().optional(),
    pedidoVendaId: z.string().uuid().optional(),
    contaFinanceiraId: z.string().uuid().optional(),
    observacao: z.string().max(500).optional(),
    parcelas: z.array(ParcelaInputSchema).min(1, 'Informe ao menos uma parcela'),
});
export const AtualizarTituloSchema = z.object({
    descricao: z.string().min(2).max(200).optional(),
    documento: z.string().max(100).optional().nullable(),
    pessoaId: z.string().uuid().optional().nullable(),
    contaFinanceiraId: z.string().uuid().optional().nullable(),
    observacao: z.string().max(500).optional().nullable(),
});
export const BaixarParcelaSchema = z.object({
    dataBaixa: z.string().min(1, 'Data de baixa obrigatória'),
    valorPago: z.number().positive('Valor pago deve ser positivo'),
    contaBancariaId: z.string().uuid('Conta bancária obrigatória'),
    juros: z.number().min(0).optional(),
    multa: z.number().min(0).optional(),
    taxas: z.number().min(0).optional(),
    observacao: z.string().max(200).optional(),
    vencimentoRestante: z.string().optional(),
});
//# sourceMappingURL=titulos.js.map