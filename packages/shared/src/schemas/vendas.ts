import { z } from 'zod'

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
})

export const ItemPedidoSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.number().positive(),
  precoUnitario: z.number().positive(),
  desconto: z.number().min(0).default(0),
})

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
})

export const CriarPedidoVendaSchema = z.object({
  pessoaId: z.string().uuid().optional(),
  canal: z.enum(['BALCAO', 'ATACADO', 'DELIVERY', 'ONLINE']),
  formaPagamento: z.enum(['DINHEIRO', 'CREDITO', 'DEBITO', 'PIX', 'PRAZO']),
  desconto: z.number().min(0).default(0),
  // Frete e outras despesas (compõem o total da nota)
  vFrete: z.number().min(0).default(0),
  vSeguro: z.number().min(0).default(0),
  vOutros: z.number().min(0).default(0),
  // Dados fiscais da operação (NF-e/NFC-e)
  modeloNFe: z.enum(['NFE', 'NFCE']).default('NFE'),
  naturezaOperacaoId: z.string().uuid().optional(), // natureza de operação (cadastro)
  naturezaOperacao: z.string().min(1).max(60).default('Venda de mercadoria'), // snapshot (derivado da natureza)
  modalidadeFrete: z.number().int().min(0).max(9).default(9),
  indPres: z.number().int().min(0).max(9).default(1), // presença do comprador (NF-e)
  // Cabeçalho comercial
  dataEmissao: z.coerce.date().optional(),
  previsaoEntrega: z.coerce.date().optional(),
  validadeProposta: z.coerce.date().optional(),
  pedidoCliente: z.string().max(60).optional(),
  // Local de entrega (grupo <entrega> da NF-e)
  entregaDiferente: z.boolean().default(false),
  entregaCep: z.string().max(8).optional(),
  entregaLogradouro: z.string().max(120).optional(),
  entregaNumero: z.string().max(20).optional(),
  entregaComplemento: z.string().max(120).optional(),
  entregaBairro: z.string().max(80).optional(),
  entregaMunicipio: z.string().max(80).optional(),
  entregaUf: z.string().length(2).optional(),
  entregaCodigoIBGE: z.string().max(7).optional(),
  // Transporte (grupo <transp> da NF-e)
  transportadora: z.string().max(120).optional(),
  transportadoraDoc: z.string().max(20).optional(),
  veiculoPlaca: z.string().max(8).optional(),
  veiculoUf: z.string().length(2).optional(),
  volumesQtde: z.number().int().min(0).optional(),
  volumesEspecie: z.string().max(60).optional(),
  pesoBruto: z.number().min(0).optional(),
  pesoLiquido: z.number().min(0).optional(),
  // Cobrança / parcelas (duplicatas da NF-e)
  parcelas: z.array(z.object({
    numero: z.string().max(10),
    vencimento: z.string(), // ISO date (yyyy-mm-dd)
    valor: z.number().min(0),
    meioPagamento: z.string().max(40).default('Dinheiro'),
  })).optional(),
  vendedorId: z.string().uuid().optional(),
  observacao: z.string().max(1000).optional(),
  itens: z.array(z.object({
    produtoId: z.string().uuid('produtoId deve ser um UUID válido'),
    quantidade: z.number().positive('Quantidade deve ser maior que zero'),
    precoUnitario: z.number().positive('Preço deve ser maior que zero'),
    desconto: z.number().min(0).default(0),
  })).min(1, 'Pedido deve ter ao menos um item'),
})

export const AtualizarStatusPedidoSchema = z.object({
  status: z.enum(['ABERTO', 'CONFIRMADO', 'EM_PREPARO', 'ENTREGUE', 'CANCELADO']),
})

export type Cliente = z.infer<typeof ClienteSchema>
export type PedidoVenda = z.infer<typeof PedidoVendaSchema>
export type CriarPedidoVendaInput = z.infer<typeof CriarPedidoVendaSchema>
export type AtualizarStatusPedidoInput = z.infer<typeof AtualizarStatusPedidoSchema>
