import { z } from 'zod';
const UnidadeMedidaEnum = z.enum(['KG', 'G', 'L', 'ML', 'UN', 'CX', 'PCT']);
export const CriarProdutoSchema = z.object({
    nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(200),
    tipo: z.enum(['INSUMO', 'PRODUTO_ACABADO', 'INSUMO_PRODUTO']),
    categoriaId: z.string().uuid().optional().nullable(),
    unidadeMedida: UnidadeMedidaEnum.default('UN'),
    estoqueMinimo: z.number().min(0).default(0),
    custoUnitario: z.number().min(0).default(0),
    precoVenda: z.number().positive().optional(),
    ncm: z.string().length(8, 'NCM deve ter 8 dígitos').optional().or(z.literal('')),
    cest: z.string().max(7).optional(),
    cfop: z.string().length(4, 'CFOP deve ter 4 dígitos').optional().or(z.literal('')),
    origem: z.number().int().min(0).max(8).default(0),
    csosn: z.string().max(4).optional(),
    cstICMS: z.string().max(3).optional(),
    cstPIS: z.string().max(2).optional(),
    cstCOFINS: z.string().max(2).optional(),
    pICMS: z.number().min(0).max(100).optional(),
    pPIS: z.number().min(0).optional(),
    pCOFINS: z.number().min(0).optional(),
    unidadeComercial: z.string().max(6).optional(),
    gtin: z.string().max(14).optional(),
    fornecedorId: z.string().uuid().optional().nullable(),
    codigoFornecedor: z.string().max(60).optional().nullable(),
    fatorConversao: z.number().positive().optional().nullable(),
    operacaoConversao: z.enum(['MULTIPLICAR', 'DIVIDIR']).optional().nullable(),
});
export const AtualizarProdutoSchema = CriarProdutoSchema.partial();
//# sourceMappingURL=produtos.js.map