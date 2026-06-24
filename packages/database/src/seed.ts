import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const { hash } = bcrypt

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  const senhaHash = await hash('admin123', 12)

  await prisma.usuario.upsert({
    where: { email: 'admin@erp.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@erp.com',
      senhaHash,
      perfil: 'ADMIN',
    },
  })

  // Categorias (model dinâmico — substitui o enum antigo). Idempotente.
  const nomesCategorias = [
    'Farinha', 'Gordura', 'Açúcar', 'Fermento', 'Laticínios', 'Ovos', 'Embalagem',
    'Pão', 'Bolo', 'Doce', 'Salgado', 'Massa', 'Recheio', 'Outros',
  ]
  for (const nome of nomesCategorias) {
    await prisma.categoria.upsert({ where: { nome }, update: {}, create: { nome } })
  }
  const categorias = await prisma.categoria.findMany({ select: { id: true, nome: true } })
  const catId = (nome: string) => categorias.find(c => c.nome === nome)?.id ?? null

  await prisma.produto.createMany({
    skipDuplicates: true,
    data: [
      { codigo: '000001', nome: 'Farinha de Trigo Especial', tipo: 'INSUMO', categoriaId: catId('Farinha'), unidadeMedida: 'KG', custoUnitario: 3.5, estoqueMinimo: 50 },
      { codigo: '000002', nome: 'Açúcar Cristal', tipo: 'INSUMO', categoriaId: catId('Açúcar'), unidadeMedida: 'KG', custoUnitario: 2.8, estoqueMinimo: 20 },
      { codigo: '000003', nome: 'Fermento Biológico Seco', tipo: 'INSUMO', categoriaId: catId('Fermento'), unidadeMedida: 'KG', custoUnitario: 25.0, estoqueMinimo: 5 },
      { codigo: '000004', nome: 'Sal Refinado', tipo: 'INSUMO', categoriaId: catId('Outros'), unidadeMedida: 'KG', custoUnitario: 1.2, estoqueMinimo: 10 },
      { codigo: '000005', nome: 'Manteiga sem Sal', tipo: 'INSUMO', categoriaId: catId('Gordura'), unidadeMedida: 'KG', custoUnitario: 32.0, estoqueMinimo: 5 },
      { codigo: '000006', nome: 'Ovo Tipo A', tipo: 'INSUMO', categoriaId: catId('Ovos'), unidadeMedida: 'UN', custoUnitario: 0.65, estoqueMinimo: 120 },
      { codigo: '000007', nome: 'Leite Integral', tipo: 'INSUMO', categoriaId: catId('Laticínios'), unidadeMedida: 'L', custoUnitario: 4.2, estoqueMinimo: 20 },
    ],
  })

  await prisma.pessoa.createMany({
    skipDuplicates: true,
    data: [
      {
        codigo: '000001',
        tipo: 'FORNECEDOR',
        tipoLegal: 'PJ',
        nome: 'Moinhos do Sul Ltda',
        nomeFantasia: 'Moinhos do Sul',
        documento: '12345678000199',
        telefone: '(51) 3333-1111',
      },
      {
        codigo: '000002',
        tipo: 'FORNECEDOR',
        tipoLegal: 'PJ',
        nome: 'Distribuidora de Alimentos ABC',
        nomeFantasia: 'ABC Alimentos',
        documento: '98765432000111',
        telefone: '(51) 3333-2222',
      },
    ],
  })

  // Plano de Contas padrão (NBC TG — adaptado para panificação)
  const planoContas = [
    // ── RECEITAS ─────────────────────────────────────────────
    { codigo: '3',     nome: 'RECEITAS',                                tipo: 'RECEITA',         natureza: 'CREDITO', isAnalitica: false, nivel: 1 },
    { codigo: '3.1',   nome: 'Receita Bruta',                           tipo: 'RECEITA',         natureza: 'CREDITO', isAnalitica: false, nivel: 2 },
    { codigo: '3.1.1', nome: 'Receita de Vendas de Produtos',           tipo: 'RECEITA',         natureza: 'CREDITO', isAnalitica: true,  nivel: 3 },
    { codigo: '3.1.2', nome: 'Receita de Prestação de Serviços',        tipo: 'RECEITA',         natureza: 'CREDITO', isAnalitica: true,  nivel: 3 },
    { codigo: '3.1.3', nome: 'Outras Receitas Operacionais',            tipo: 'RECEITA',         natureza: 'CREDITO', isAnalitica: true,  nivel: 3 },
    { codigo: '3.2',   nome: 'Deduções da Receita',                     tipo: 'RECEITA',         natureza: 'DEBITO',  isAnalitica: false, nivel: 2 },
    { codigo: '3.2.1', nome: 'Devoluções e Abatimentos',                tipo: 'RECEITA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '3.2.2', nome: 'Impostos sobre Vendas (PIS/COFINS/ICMS)', tipo: 'RECEITA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },

    // ── CUSTOS ───────────────────────────────────────────────
    { codigo: '4',     nome: 'CUSTOS',                                  tipo: 'CUSTO',           natureza: 'DEBITO',  isAnalitica: false, nivel: 1 },
    { codigo: '4.1',   nome: 'Custo dos Produtos Vendidos (CPV)',        tipo: 'CUSTO',           natureza: 'DEBITO',  isAnalitica: false, nivel: 2 },
    { codigo: '4.1.1', nome: 'Custo de Matéria-Prima',                  tipo: 'CUSTO',           natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '4.1.2', nome: 'Custo de Embalagens',                     tipo: 'CUSTO',           natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '4.2',   nome: 'Custo de Mão de Obra Direta',             tipo: 'CUSTO',           natureza: 'DEBITO',  isAnalitica: false, nivel: 2 },
    { codigo: '4.2.1', nome: 'Salários — Produção',                     tipo: 'CUSTO',           natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '4.2.2', nome: 'Encargos sobre Mão de Obra — Produção',   tipo: 'CUSTO',           natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '4.3',   nome: 'Custos Indiretos de Fabricação',          tipo: 'CUSTO',           natureza: 'DEBITO',  isAnalitica: false, nivel: 2 },
    { codigo: '4.3.1', nome: 'Energia Elétrica — Produção',             tipo: 'CUSTO',           natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '4.3.2', nome: 'Manutenção de Equipamentos',              tipo: 'CUSTO',           natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '4.3.3', nome: 'Outros Custos de Produção',               tipo: 'CUSTO',           natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },

    // ── DESPESAS OPERACIONAIS ─────────────────────────────────
    { codigo: '5',     nome: 'DESPESAS OPERACIONAIS',                   tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: false, nivel: 1 },
    { codigo: '5.1',   nome: 'Despesas com Vendas',                     tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: false, nivel: 2 },
    { codigo: '5.1.1', nome: 'Salários e Comissões — Vendas',           tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.1.2', nome: 'Marketing e Publicidade',                 tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.1.3', nome: 'Fretes e Entregas',                       tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.2',   nome: 'Despesas Gerais e Administrativas',       tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: false, nivel: 2 },
    { codigo: '5.2.1', nome: 'Salários e Encargos — Administrativo',    tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.2.2', nome: 'Aluguel e Condomínio',                    tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.2.3', nome: 'Energia Elétrica e Utilidades',           tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.2.4', nome: 'Telefone e Internet',                     tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.2.5', nome: 'Software e Assinaturas',                  tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.2.6', nome: 'Material de Escritório',                  tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.2.7', nome: 'Honorários Contábeis e Jurídicos',        tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.2.8', nome: 'Seguros',                                 tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.2.9', nome: 'Manutenção e Conservação',                tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.3',   nome: 'Despesas Financeiras',                    tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: false, nivel: 2 },
    { codigo: '5.3.1', nome: 'Juros e Encargos Bancários',              tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.3.2', nome: 'Tarifas Bancárias',                       tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.3.3', nome: 'IOF e Outros Impostos Financeiros',       tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },
    { codigo: '5.4',   nome: 'Depreciação e Amortização',               tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: false, nivel: 2 },
    { codigo: '5.4.1', nome: 'Depreciação de Imobilizado',              tipo: 'DESPESA',         natureza: 'DEBITO',  isAnalitica: true,  nivel: 3 },

    // ── RESULTADO NÃO OPERACIONAL ─────────────────────────────
    { codigo: '6',     nome: 'RESULTADO NÃO OPERACIONAL',               tipo: 'NAO_OPERACIONAL', natureza: 'CREDITO', isAnalitica: false, nivel: 1 },
    { codigo: '6.1',   nome: 'Receitas Financeiras',                    tipo: 'NAO_OPERACIONAL', natureza: 'CREDITO', isAnalitica: true,  nivel: 2 },
    { codigo: '6.2',   nome: 'Ganhos na Venda de Ativos',               tipo: 'NAO_OPERACIONAL', natureza: 'CREDITO', isAnalitica: true,  nivel: 2 },
    { codigo: '6.3',   nome: 'Outras Receitas Não Operacionais',        tipo: 'NAO_OPERACIONAL', natureza: 'CREDITO', isAnalitica: true,  nivel: 2 },
  ] as const

  const idPorCodigo: Record<string, string> = {}

  for (const conta of planoContas) {
    const codigoPai = conta.codigo.split('.').slice(0, -1).join('.')
    const existing = await prisma.contaFinanceira.findUnique({ where: { codigo: conta.codigo } })
    if (existing) {
      idPorCodigo[conta.codigo] = existing.id
      continue
    }
    const criada = await prisma.contaFinanceira.create({
      data: {
        codigo: conta.codigo,
        nome: conta.nome,
        tipo: conta.tipo,
        natureza: conta.natureza,
        isAnalitica: conta.isAnalitica,
        nivel: conta.nivel,
        codigoCompleto: conta.codigo,
        contaPaiId: codigoPai ? idPorCodigo[codigoPai] : null,
      },
    })
    idPorCodigo[conta.codigo] = criada.id
  }

  console.log(`✅ Plano de contas populado: ${planoContas.length} contas`)

  const configuracoesDefault = [
    { chave: 'METODO_CUSTO', valor: 'MEDIO', descricao: 'Método de custo usado no CMV e margens: MEDIO (Custo Médio Ponderado) ou ULTIMO (Último Custo)' },
    { chave: 'PERMITIR_ESTOQUE_NEGATIVO', valor: 'SIM', descricao: 'Permite que saídas/consumos deixem o estoque negativo (SIM) ou bloqueia quando não há saldo (NAO)' },
    // Contas padrão de encargos financeiros (DRE) — valor vazio até o usuário vincular
    { chave: 'CONTA_TARIFA_BANCARIA', valor: '', descricao: 'Conta do plano de contas para tarifas bancárias (despesa financeira) lançadas na conciliação/baixa' },
    { chave: 'CONTA_JUROS_PAGOS', valor: '', descricao: 'Conta do plano de contas para juros e multas pagos por atraso (despesa financeira)' },
    { chave: 'CONTA_JUROS_RECEBIDOS', valor: '', descricao: 'Conta do plano de contas para juros e multas recebidos por atraso (receita financeira)' },
    { chave: 'CONTA_DESCONTO_OBTIDO', valor: '', descricao: 'Conta do plano de contas para descontos obtidos em pagamentos (receita / redução de despesa)' },
    { chave: 'CONTA_DESCONTO_CONCEDIDO', valor: '', descricao: 'Conta do plano de contas para descontos concedidos em recebimentos (despesa / redução de receita)' },
  ]

  for (const cfg of configuracoesDefault) {
    await prisma.configuracao.upsert({
      where: { chave: cfg.chave },
      update: {},
      create: cfg,
    })
  }

  console.log(`✅ Configurações padrão criadas: ${configuracoesDefault.length}`)
  console.log('✅ Seed concluído!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
