import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { requirePerfil } from '../../plugins/auth.plugin.js'
import { parseNFe } from './nfe.parser.js'
import { consultarDistribuicao } from './sefaz-distribuicao.service.js'
import { z } from 'zod'

// ── Schemas ───────────────────────────────────────────────────────────────────

const ItemSalvarSchema = z.object({
  nItem: z.number().int(),
  produtoId: z.string().uuid().nullable(),
  produtoNovo: z.boolean().default(false),
  cProd: z.string().optional(),
  descricao: z.string(),
  ncm: z.string().optional(),
  cfop: z.string().optional(),
  unidade: z.string().optional(),
  quantidade: z.number().nonnegative(),
  valorUnitario: z.number().nonnegative(),
  valorTotal: z.number().nonnegative(),
  fatorConversao: z.number().positive().optional().nullable(),
  operacaoConversao: z.enum(['MULTIPLICAR', 'DIVIDIR']).optional().nullable(),
})

const ParcelaSchema = z.object({
  numero: z.string(),
  dias: z.number().default(0),
  vencimento: z.string(),
  valor: z.number().positive(),
  envioPara: z.enum(['PRAZO', 'CAIXA', 'CONTA']).default('PRAZO'),
  contaBancariaId: z.string().uuid().nullable().optional(),
  meioPagamento: z.string().optional(),
})

const SalvarNfSchema = z.object({
  id: z.string().uuid().optional(),
  chaveAcesso: z.string().max(44).optional(),
  numero: z.string().optional(),
  serie: z.string().optional(),
  dataEmissao: z.string(),
  dataEntrada: z.string(),
  fornecedorId: z.string().uuid().optional().nullable(),
  fornecedorNome: z.string().min(1),
  fornecedorCnpj: z.string().optional().nullable(),
  totalProdutos: z.number(),
  vFrete: z.number().default(0),
  vSeg: z.number().default(0),
  vDesc: z.number().default(0),
  vOutro: z.number().default(0),
  vBC: z.number().default(0),
  vICMS: z.number().default(0),
  vICMSDeson: z.number().default(0),
  vBCST: z.number().default(0),
  vST: z.number().default(0),
  vFCP: z.number().default(0),
  vFCPST: z.number().default(0),
  vIPI: z.number().default(0),
  vIPIDevol: z.number().default(0),
  vPIS: z.number().default(0),
  vCOFINS: z.number().default(0),
  vII: z.number().default(0),
  vTotTrib: z.number().default(0),
  totalImpostos: z.number().default(0),
  totalNf: z.number(),
  contaFinanceiraId: z.string().uuid().optional().nullable(),
  observacao: z.string().max(500).optional(),
  itens: z.array(ItemSalvarSchema).min(1),
  parcelas: z.array(ParcelaSchema).default([]),
  xmlOriginal: z.string().optional(),
  // Dados completos do emitente para cadastro do fornecedor
  emitenteRazaoSocial: z.string().optional().nullable(),
  emitenteNomeFant: z.string().optional().nullable(),
  emitenteIE: z.string().optional().nullable(),
  emitenteFone: z.string().optional().nullable(),
  emitenteEnderLgr: z.string().optional().nullable(),
  emitenteEnderNro: z.string().optional().nullable(),
  emitenteEnderBairro: z.string().optional().nullable(),
  emitenteEnderMun: z.string().optional().nullable(),
  emitenteEnderUF: z.string().optional().nullable(),
  emitenteEnderCEP: z.string().optional().nullable(),
})

const FormarCustoSchema = z.object({
  frete: z.number().min(0),
  outros: z.number().min(0).default(0),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const SELECT_PRODUTO = { id: true, codigo: true, nome: true, unidadeMedida: true, custoUnitario: true } as const

function mapUnidade(u: string) {
  const v = (u ?? '').toUpperCase()
  if (v === 'KG' || v === 'KGS') return 'KG'
  if (v === 'G' || v === 'GR' || v === 'GRS') return 'G'
  if (v === 'L' || v === 'LT' || v === 'LTS') return 'L'
  if (v === 'ML') return 'ML'
  if (v === 'CX' || v === 'BX') return 'CX'
  if (v === 'PCT' || v === 'PC' || v === 'PK') return 'PCT'
  return 'UN'
}

async function autoMatchProduto(cProd: string, fornecedorId: string | null) {
  if (!cProd || !fornecedorId) return null
  return prisma.produto.findFirst({
    where: { codigoFornecedor: cProd, fornecedorId, ativo: true },
    select: SELECT_PRODUTO,
  })
}

// ── Rotas ─────────────────────────────────────────────────────────────────────

export async function nfEntradaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'FINANCEIRO', 'ESTOQUE'))

  // ── Parse XML ─────────────────────────────────────────────────────────────

  app.post('/parse-xml', async (request, reply) => {
    const { xml } = request.body as { xml: string }
    if (!xml?.trim()) return reply.code(400).send({ error: 'XML não informado.' })

    try {
      const parsed = parseNFe(xml)

      let fornecedor = null
      if (parsed.emitenteCnpj) {
        const cnpjLimpo = parsed.emitenteCnpj.replace(/\D/g, '')
        fornecedor = await prisma.pessoa.findFirst({
          where: { documento: { contains: cnpjLimpo } },
          select: { id: true, nome: true, documento: true },
        })
      }

      const itensComProduto = await Promise.all(
        parsed.itens.map(async item => {
          const produto = await autoMatchProduto(item.cProd, fornecedor?.id ?? null)
          return { ...item, produtoId: produto?.id ?? null, produtoNovo: false, produto }
        }),
      )

      return {
        ...parsed,
        fornecedorId: fornecedor?.id ?? null,
        fornecedorNome: fornecedor?.nome ?? parsed.emitenteNome,
        fornecedorCnpj: parsed.emitenteCnpj,
        fornecedor,
        itens: itensComProduto,
      }
    } catch (err) {
      return reply.code(400).send({ error: `Erro ao processar XML: ${err instanceof Error ? err.message : 'formato inválido'}` })
    }
  })

  // ── Listagem ──────────────────────────────────────────────────────────────

  app.get('/', async (request) => {
    const { status, dataInicio, dataFim, pagina, limite } = request.query as {
      status?: string; dataInicio?: string; dataFim?: string; pagina?: string; limite?: string
    }
    const page = Number(pagina ?? 1)
    const lim = Math.min(Number(limite ?? 50), 100)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (dataInicio || dataFim) {
      where.dataEntrada = {
        ...(dataInicio && { gte: new Date(dataInicio) }),
        ...(dataFim && { lte: new Date(dataFim) }),
      }
    }

    const [dados, total] = await Promise.all([
      prisma.nfEntrada.findMany({
        where,
        include: {
          fornecedor: { select: { id: true, nome: true } },
          _count: { select: { itens: true } },
        },
        orderBy: { dataEntrada: 'desc' },
        skip: (page - 1) * lim,
        take: lim,
      }),
      prisma.nfEntrada.count({ where }),
    ])

    return { dados, total, pagina: page, limite: lim, paginas: Math.ceil(total / lim) }
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const nf = await prisma.nfEntrada.findUnique({
      where: { id },
      include: {
        fornecedor: { select: { id: true, nome: true, documento: true } },
        itens: { include: { produto: { select: { id: true, codigo: true, nome: true } } } },
        titulos: { include: { parcelas: true } },
      },
    })
    if (!nf) return reply.code(404).send({ error: 'NF não encontrada.' })
    return nf
  })

  // ── Salvar NF (RASCUNHO — sem lançar estoque ou financeiro) ──────────────

  app.post('/salvar', async (request, reply) => {
    const data = SalvarNfSchema.parse(request.body)
    const isUpdate = !!data.id

    if (isUpdate) {
      const existing = await prisma.nfEntrada.findUnique({ where: { id: data.id } })
      if (!existing) return reply.code(404).send({ error: 'NF não encontrada.' })
      if (existing.estoqueElancado || existing.financeiroLancado) {
        return reply.code(409).send({ error: 'NF com lançamentos não pode ser editada. Estorne os lançamentos primeiro.' })
      }
      if (data.chaveAcesso) {
        const outra = await prisma.nfEntrada.findFirst({ where: { chaveAcesso: data.chaveAcesso, id: { not: data.id } } })
        if (outra) return reply.code(409).send({ error: 'NF-e com esta chave de acesso já foi importada.' })
      }
    } else {
      if (data.chaveAcesso) {
        const existe = await prisma.nfEntrada.findUnique({ where: { chaveAcesso: data.chaveAcesso } })
        if (existe) return reply.code(409).send({ error: 'NF-e com esta chave de acesso já foi importada.' })
      }
    }

    // Auto-cadastro do fornecedor quando não encontrado no cadastro
    let fornecedorId = data.fornecedorId || null
    if (!fornecedorId && data.fornecedorCnpj) {
      const cnpjLimpo = data.fornecedorCnpj.replace(/\D/g, '')
      // Verifica se já existe (pode ter sido criado entre o parse-xml e o salvar)
      const existente = await prisma.pessoa.findFirst({
        where: { documento: { contains: cnpjLimpo } },
        select: { id: true },
      })
      if (existente) {
        fornecedorId = existente.id
      } else {
        // Gera código sequencial para a Pessoa
        const ultima = await prisma.pessoa.findFirst({ orderBy: { codigo: 'desc' }, select: { codigo: true } })
        const proximoCodigo = String((parseInt(ultima?.codigo ?? '0', 10) || 0) + 1).padStart(6, '0')
        const novo = await prisma.pessoa.create({
          data: {
            codigo: proximoCodigo,
            tipo: 'FORNECEDOR',
            tipoLegal: cnpjLimpo.length === 14 ? 'PJ' : 'PF',
            nome: data.emitenteRazaoSocial || data.fornecedorNome,
            nomeFantasia: data.emitenteNomeFant || null,
            documento: cnpjLimpo,
            ie: data.emitenteIE || null,
            telefone: data.emitenteFone || null,
            logradouro: data.emitenteEnderLgr || null,
            numero: data.emitenteEnderNro || null,
            bairro: data.emitenteEnderBairro || null,
            municipio: data.emitenteEnderMun || null,
            uf: data.emitenteEnderUF || null,
            cep: data.emitenteEnderCEP?.replace(/\D/g, '') || null,
          },
        })
        fornecedorId = novo.id
      }
    }

    const totalImpostosCalc = +(
      data.vICMS + data.vST + data.vIPI + data.vPIS + data.vCOFINS +
      data.vII + data.vFCP + data.vFCPST - data.vICMSDeson - data.vIPIDevol
    ).toFixed(2)

    const nfData = {
      chaveAcesso: data.chaveAcesso || null,
      numero: data.numero || null,
      serie: data.serie || null,
      dataEmissao: new Date(data.dataEmissao),
      dataEntrada: new Date(data.dataEntrada),
      fornecedorId,
      fornecedorNome: data.fornecedorNome,
      fornecedorCnpj: data.fornecedorCnpj || null,
      totalProdutos: data.totalProdutos,
      vFrete: data.vFrete, vSeg: data.vSeg, vDesc: data.vDesc, vOutro: data.vOutro,
      vBC: data.vBC, vICMS: data.vICMS, vICMSDeson: data.vICMSDeson,
      vBCST: data.vBCST, vST: data.vST, vFCP: data.vFCP, vFCPST: data.vFCPST,
      vIPI: data.vIPI, vIPIDevol: data.vIPIDevol, vPIS: data.vPIS,
      vCOFINS: data.vCOFINS, vII: data.vII, vTotTrib: data.vTotTrib,
      totalImpostos: totalImpostosCalc,
      totalNf: data.totalNf,
      contaFinanceiraId: data.contaFinanceiraId || null,
      observacao: data.observacao || null,
      xmlOriginal: data.xmlOriginal || null,
      parcelasJson: data.parcelas.length > 0 ? JSON.stringify(data.parcelas) : null,
    }

    const itensData = data.itens.map(i => ({
      nItem: i.nItem,
      cProd: i.cProd || null,
      descricao: i.descricao,
      ncm: i.ncm || null,
      cfop: i.cfop || null,
      unidade: i.unidade || null,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitario,
      valorTotal: i.valorTotal,
      produtoId: i.produtoId || null,
      produtoNovo: i.produtoNovo ?? false,
      fatorConversao: i.fatorConversao ?? null,
      operacaoConversao: i.operacaoConversao ?? null,
    }))

    let nfId: string

    if (isUpdate) {
      await prisma.itemNfEntrada.deleteMany({ where: { nfEntradaId: data.id } })
      await prisma.nfEntrada.update({
        where: { id: data.id },
        data: { ...nfData, itens: { create: itensData } },
      })
      nfId = data.id!
    } else {
      const nf = await prisma.nfEntrada.create({
        data: { ...nfData, status: 'RASCUNHO', itens: { create: itensData } },
      })
      nfId = nf.id
    }

    // Salva mapeamento cProd → produto para auto-match futuro
    for (const item of data.itens) {
      if (!item.produtoId || !item.cProd) continue
      await prisma.produto.updateMany({
        where: { id: item.produtoId, codigoFornecedor: null },
        data: { codigoFornecedor: item.cProd, fornecedorId: fornecedorId ?? null },
      })
    }

    return reply.code(isUpdate ? 200 : 201).send({ id: nfId })
  })

  // ── Lançar Estoque ────────────────────────────────────────────────────────

  app.post('/:id/lancar-estoque', async (request, reply) => {
    const { id } = request.params as { id: string }

    const nf = await prisma.nfEntrada.findUnique({
      where: { id },
      include: { itens: true },
    })
    if (!nf) return reply.code(404).send({ error: 'NF não encontrada.' })
    if (nf.estoqueElancado) return reply.code(409).send({ error: 'Estoque já foi lançado para esta NF.' })

    const configMetodo = await prisma.configuracao.findUnique({ where: { chave: 'METODO_CUSTO' } })
    const metodo = configMetodo?.valor ?? 'MEDIO'

    await prisma.$transaction(async (tx) => {
      // 1. Cria produtos marcados como "novo"
      for (const item of nf.itens.filter(i => i.produtoNovo && !i.produtoId)) {
        const last = await tx.produto.findFirst({ orderBy: { codigo: 'desc' }, select: { codigo: true } })
        const nextNum = (parseInt(last?.codigo ?? '0', 10) || 0) + 1
        const codigo = String(nextNum).padStart(6, '0')

        const novoProduto = await tx.produto.create({
          data: {
            codigo,
            nome: item.descricao,
            tipo: 'INSUMO',
            unidadeMedida: mapUnidade(item.unidade ?? 'UN') as never,
            ncm: item.ncm ?? null,
            custoUnitario: Number(item.valorUnitario),
            fornecedorId: nf.fornecedorId ?? null,
            codigoFornecedor: item.cProd ?? null,
            fatorConversao: item.fatorConversao ?? null,
            operacaoConversao: (item.operacaoConversao as never) ?? null,
          },
        })

        await tx.itemNfEntrada.update({
          where: { id: item.id },
          data: { produtoId: novoProduto.id, produtoNovo: false },
        })
      }

      // 2. Recarrega itens com produtoId (incluindo os recém-criados)
      const itensComProduto = await tx.itemNfEntrada.findMany({
        where: { nfEntradaId: id, produtoId: { not: null } },
      })

      const produtoIds = itensComProduto.map(i => i.produtoId!)
      const produtos = await tx.produto.findMany({
        where: { id: { in: produtoIds } },
        select: { id: true, estoqueAtual: true, custoMedio: true, ultimoCusto: true, fatorConversao: true, operacaoConversao: true },
      })
      const produtoMap = new Map(produtos.map(p => [p.id, p]))

      // 3. Movimentações de estoque
      for (const item of itensComProduto) {
        const prod = produtoMap.get(item.produtoId!)
        if (!prod) continue

        // Aplica conversão de unidade se configurada no produto
        const fator = prod.fatorConversao ? Number(prod.fatorConversao) : 1
        const op = prod.operacaoConversao
        const qtdeNf = Number(item.quantidade)
        const qtdeEstoque = (op === 'MULTIPLICAR') ? qtdeNf * fator
          : (op === 'DIVIDIR') ? qtdeNf / fator
          : qtdeNf
        const valorTotal = Number(item.valorTotal)
        const novoCusto = +(qtdeEstoque > 0 ? valorTotal / qtdeEstoque : Number(item.valorUnitario)).toFixed(4)

        const estoqueAtual = Number(prod.estoqueAtual)
        const custoMedioAtual = Number(prod.custoMedio)
        const novoEstoque = estoqueAtual + qtdeEstoque
        const novoCustoMedio = novoEstoque > 0
          ? (estoqueAtual * custoMedioAtual + qtdeEstoque * novoCusto) / novoEstoque
          : novoCusto
        const custoAtivo = metodo === 'ULTIMO' ? novoCusto : novoCustoMedio

        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: item.produtoId!,
            nfEntradaId: id,
            tipo: 'ENTRADA',
            quantidade: +qtdeEstoque.toFixed(4),
            custoUnitario: novoCusto,
            observacao: `NF ${nf.numero || id} — ${item.descricao}`,
          },
        })

        await tx.produto.update({
          where: { id: item.produtoId! },
          data: {
            estoqueAtual: { increment: +qtdeEstoque.toFixed(4) },
            ultimoCusto: novoCusto,
            custoMedio: +novoCustoMedio.toFixed(4),
            custoUnitario: +custoAtivo.toFixed(4),
          },
        })
      }

      await tx.nfEntrada.update({
        where: { id },
        data: { estoqueElancado: true, status: 'CONFIRMADA' },
      })
    })

    return { ok: true }
  })

  // ── Lançar Financeiro ─────────────────────────────────────────────────────

  app.post('/:id/lancar-financeiro', async (request, reply) => {
    const { id } = request.params as { id: string }

    const nf = await prisma.nfEntrada.findUnique({
      where: { id },
      select: {
        id: true, numero: true, fornecedorId: true, fornecedorNome: true,
        totalNf: true, financeiroLancado: true,
        contaFinanceiraId: true, parcelasJson: true,
      },
    })
    if (!nf) return reply.code(404).send({ error: 'NF não encontrada.' })
    if (nf.financeiroLancado) return reply.code(409).send({ error: 'Financeiro já lançado para esta NF.' })

    type ParcelaSalva = {
      numero: string; dias: number; vencimento: string; valor: number
      envioPara: 'PRAZO' | 'CAIXA' | 'CONTA'
      contaBancariaId?: string | null
      meioPagamento?: string
    }
    const parcelas: ParcelaSalva[] = nf.parcelasJson
      ? JSON.parse(nf.parcelasJson)
      : [{ numero: '001', dias: 0, vencimento: new Date().toISOString().slice(0, 10), valor: Number(nf.totalNf), envioPara: 'PRAZO' }]

    // Resolve conta caixa uma vez (usada por parcelas com envioPara=CAIXA)
    let caixaId: string | null = null
    if (parcelas.some(p => p.envioPara === 'CAIXA')) {
      const caixa = await prisma.contaBancaria.findFirst({ where: { isCaixa: true, ativo: true }, select: { id: true } })
      caixaId = caixa?.id ?? null
    }

    const totalParcelas = parcelas.reduce((s, p) => s + p.valor, 0)
    const todasPagas = parcelas.every(p => p.envioPara !== 'PRAZO')

    await prisma.tituloFinanceiro.create({
      data: {
        tipo: 'PAGAR',
        descricao: `NF ${nf.numero || id} — ${nf.fornecedorNome}`,
        documento: nf.numero ? String(nf.numero) : null,
        total: totalParcelas,
        pessoaId: nf.fornecedorId || null,
        nfEntradaId: id,
        contaFinanceiraId: nf.contaFinanceiraId || null,
        status: todasPagas ? 'QUITADO' : 'ABERTO',
        parcelas: {
          create: parcelas.map((p, idx) => {
            const pago = p.envioPara !== 'PRAZO'
            const contaBancariaId =
              p.envioPara === 'CAIXA' ? caixaId
              : p.envioPara === 'CONTA' ? (p.contaBancariaId ?? null)
              : null
            return {
              numero: idx + 1,
              valor: p.valor,
              vencimento: new Date(p.vencimento),
              status: pago ? 'QUITADO' : 'ABERTO',
              dataBaixa: pago ? new Date() : null,
              valorPago: pago ? p.valor : null,
              contaBancariaId,
              observacao: p.numero ? `Dup. ${p.numero}` : null,
            }
          }),
        },
      },
    })

    await prisma.nfEntrada.update({ where: { id }, data: { financeiroLancado: true } })

    return { ok: true }
  })

  // ── Formar Custo ──────────────────────────────────────────────────────────

  app.post('/:id/formar-custo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = FormarCustoSchema.parse(request.body)

    const nf = await prisma.nfEntrada.findUnique({
      where: { id },
      include: { itens: { where: { produtoId: { not: null } } } },
    })
    if (!nf) return reply.code(404).send({ error: 'NF não encontrada.' })
    if (nf.custoFormado) return reply.code(409).send({ error: 'Custo já formado para esta NF.' })
    if (!nf.estoqueElancado) return reply.code(400).send({ error: 'Lance o estoque antes de formar o custo.' })

    const totalAdicional = data.frete + data.outros
    const totalProdutos = nf.itens.reduce((s, i) => s + Number(i.valorTotal), 0)
    if (totalProdutos <= 0 || nf.itens.length === 0) {
      return reply.code(400).send({ error: 'Nenhum produto vinculado na nota.' })
    }

    const produtoIds = nf.itens.map(i => i.produtoId!)
    const produtos = await prisma.produto.findMany({
      where: { id: { in: produtoIds } },
      select: { id: true, fatorConversao: true, operacaoConversao: true },
    })
    const produtoMap = new Map(produtos.map(p => [p.id, p]))

    await prisma.$transaction(async (tx) => {
      for (const item of nf.itens) {
        if (!item.produtoId) continue
        const prod = produtoMap.get(item.produtoId)
        const fator = prod?.fatorConversao ? Number(prod.fatorConversao) : 1
        const op = prod?.operacaoConversao
        const qtdeNf = Number(item.quantidade)
        const qtdeEstoque = op === 'MULTIPLICAR' ? qtdeNf * fator
          : op === 'DIVIDIR' ? qtdeNf / fator
          : qtdeNf

        const participacao = Number(item.valorTotal) / totalProdutos
        const adicionalItem = totalAdicional * participacao
        const custoNovo = qtdeEstoque > 0
          ? (Number(item.valorTotal) + adicionalItem) / qtdeEstoque
          : Number(item.valorUnitario)

        await tx.produto.update({
          where: { id: item.produtoId },
          data: { ultimoCusto: +custoNovo.toFixed(4), custoUnitario: +custoNovo.toFixed(4) },
        })

        await tx.produtoCusto.create({
          data: {
            produtoId:   item.produtoId,
            custo:       +custoNovo.toFixed(4),
            motivo:      'FORMACAO_CUSTO',
            nfEntradaId: id,
            observacao:  `Formação de custo NF ${nf.numero || id}`,
          },
        })
      }
      await tx.nfEntrada.update({ where: { id }, data: { custoFormado: true } })
    })

    return { ok: true }
  })

  // ── Preview para Formar Custo (sem salvar) ────────────────────────────────

  app.get('/:id/preview-custo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { frete = '0', outros = '0' } = request.query as { frete?: string; outros?: string }

    const nf = await prisma.nfEntrada.findUnique({
      where: { id },
      include: {
        itens: {
          where: { produtoId: { not: null } },
          include: { produto: { select: { id: true, codigo: true, nome: true, custoUnitario: true, custoMedio: true, ultimoCusto: true, fatorConversao: true, operacaoConversao: true } } },
        },
      },
    })
    if (!nf) return reply.code(404).send({ error: 'NF não encontrada.' })

    const totalAdicional = Number(frete) + Number(outros)
    const totalProdutos = nf.itens.reduce((s, i) => s + Number(i.valorTotal), 0)

    const itens = nf.itens.map(item => {
      const fator = item.produto?.fatorConversao ? Number(item.produto.fatorConversao) : 1
      const op = item.produto?.operacaoConversao
      const qtdeNf = Number(item.quantidade)
      const qtdeEstoque = op === 'MULTIPLICAR' ? qtdeNf * fator
        : op === 'DIVIDIR' ? qtdeNf / fator
        : qtdeNf

      const participacao = totalProdutos > 0 ? Number(item.valorTotal) / totalProdutos : 0
      const adicionalItem = totalAdicional * participacao
      const custoNovo = qtdeEstoque > 0
        ? (Number(item.valorTotal) + adicionalItem) / qtdeEstoque
        : Number(item.valorUnitario)
      return {
        id: item.id,
        descricao: item.descricao,
        quantidade: Number(item.quantidade),
        qtdeEstoque: +qtdeEstoque.toFixed(4),
        valorTotal: Number(item.valorTotal),
        adicionalRateado: +adicionalItem.toFixed(4),
        custoAtual: Number(item.produto?.custoUnitario ?? 0),
        custoNovo: +custoNovo.toFixed(4),
        produto: item.produto,
      }
    })

    return { totalAdicional, totalProdutos, itens }
  })

  // ── Sincronizar com SEFAZ (NFeDistribuicaoDFe) ────────────────────────────

  app.post('/sincronizar-sefaz', async (_request, reply) => {
    const empresa = await prisma.empresa.findFirst({ include: { certificado: true } })
    if (!empresa) return reply.code(400).send({ error: 'Empresa não configurada.' })
    if (!empresa.certificado) return reply.code(400).send({ error: 'Certificado digital não configurado. Acesse Configurações.' })
    if (!empresa.uf) return reply.code(400).send({ error: 'UF da empresa não configurada.' })

    const configNsu = await prisma.configuracao.findUnique({ where: { chave: 'ULTIMO_NSU_ENTRADA' } })
    let ultNSU = configNsu?.valor ?? '0'

    const todosDocumentos: Awaited<ReturnType<typeof consultarDistribuicao>>['documentos'] = []
    let tentativas = 0
    let temMais = true

    while (temMais && tentativas < 10) {
      tentativas++
      let resultado
      try {
        resultado = await consultarDistribuicao(
          empresa.cnpj, empresa.uf, empresa.ambiente,
          empresa.certificado.arquivoBase64, empresa.certificado.senha, ultNSU,
        )
      } catch (err) {
        return reply.code(502).send({ error: `Falha ao comunicar com SEFAZ: ${err instanceof Error ? err.message : 'erro desconhecido'}` })
      }

      if (resultado.cStat === '656') {
        return reply.code(429).send({ error: 'SEFAZ: consumo indevido — aguarde antes de consultar novamente (limite: 1 vez por hora por CNPJ).' })
      }
      if (resultado.cStat !== '137' && resultado.cStat !== '138') {
        return reply.code(502).send({ error: `SEFAZ retornou: ${resultado.cStat} — ${resultado.xMotivo}` })
      }

      todosDocumentos.push(...resultado.documentos)
      if (resultado.ultNSU) ultNSU = resultado.ultNSU
      temMais = resultado.cStat === '138' && resultado.ultNSU !== resultado.maxNSU && !!resultado.maxNSU
    }

    await prisma.configuracao.upsert({
      where: { chave: 'ULTIMO_NSU_ENTRADA' },
      update: { valor: ultNSU },
      create: { chave: 'ULTIMO_NSU_ENTRADA', valor: ultNSU, descricao: 'Último NSU da distribuição NF-e de entrada' },
    })

    const cnpjEmpresa = empresa.cnpj.replace(/\D/g, '')
    const nfeXmls = todosDocumentos.filter(d => d.tipoDoc === 'procNFe')
    const chavesExistentes = new Set(
      (await prisma.nfEntrada.findMany({ select: { chaveAcesso: true }, where: { chaveAcesso: { not: null } } }))
        .map(n => n.chaveAcesso!),
    )

    const nfesParseadas: unknown[] = []
    for (const doc of nfeXmls) {
      try {
        const parsed = parseNFe(doc.xml)
        const destCnpj = parsed.destinatarioCnpj.replace(/\D/g, '')
        if (destCnpj && destCnpj !== cnpjEmpresa) continue
        if (parsed.chaveAcesso && chavesExistentes.has(parsed.chaveAcesso)) continue

        let fornecedor = null
        if (parsed.emitenteCnpj) {
          const cnpjLimpo = parsed.emitenteCnpj.replace(/\D/g, '')
          fornecedor = await prisma.pessoa.findFirst({
            where: { documento: { contains: cnpjLimpo } },
            select: { id: true, nome: true, documento: true },
          })
        }

        const itensComProduto = await Promise.all(
          parsed.itens.map(async item => {
            const produto = await autoMatchProduto(item.cProd, fornecedor?.id ?? null)
            return { ...item, produtoId: produto?.id ?? null, produtoNovo: false, produto }
          }),
        )

        nfesParseadas.push({
          nsu: doc.nsu,
          ...parsed,
          fornecedorId: fornecedor?.id ?? null,
          fornecedorNome: fornecedor?.nome ?? parsed.emitenteNome,
          fornecedorCnpj: parsed.emitenteCnpj,
          fornecedor,
          itens: itensComProduto,
          xmlOriginal: doc.xml,
        })
      } catch { /* ignora XML malformado */ }
    }

    return {
      totalDocumentos: todosDocumentos.length,
      nfesNovos: nfesParseadas.length,
      resNFeIgnorados: todosDocumentos.filter(d => d.tipoDoc === 'resNFe').length,
      ultNSU,
      nfes: nfesParseadas,
    }
  })

  // ── Estornar Estoque ──────────────────────────────────────────────────────

  app.post('/:id/estornar-estoque', async (request, reply) => {
    const { id } = request.params as { id: string }

    const nf = await prisma.nfEntrada.findUnique({
      where: { id },
      include: { itens: { where: { produtoId: { not: null } } } },
    })
    if (!nf) return reply.code(404).send({ error: 'NF não encontrada.' })
    if (!nf.estoqueElancado) return reply.code(409).send({ error: 'Estoque não foi lançado para esta NF.' })

    await prisma.$transaction(async (tx) => {
      for (const item of nf.itens) {
        if (!item.produtoId) continue

        // Busca o custo anterior à entrada desta NF para este produto
        const movAnterior = await tx.movimentacaoEstoque.findFirst({
          where: {
            produtoId: item.produtoId,
            nfEntradaId: { not: id },
            custoUnitario: { not: null },
          },
          orderBy: { criadoEm: 'desc' },
          select: { custoUnitario: true },
        })

        const custoAnterior = movAnterior ? Number(movAnterior.custoUnitario) : Number(item.valorUnitario)

        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: item.produtoId,
            nfEntradaId: id,
            tipo: 'AJUSTE',
            quantidade: -item.quantidade,
            custoUnitario: +custoAnterior.toFixed(4),
            observacao: `Estorno estoque NF ${nf.numero || id} — ${item.descricao}`,
          },
        })

        await tx.produto.update({
          where: { id: item.produtoId },
          data: {
            estoqueAtual: { decrement: item.quantidade },
            ultimoCusto: +custoAnterior.toFixed(4),
            custoUnitario: +custoAnterior.toFixed(4),
          },
        })

        await tx.produtoCusto.create({
          data: {
            produtoId:   item.produtoId,
            custo:       +custoAnterior.toFixed(4),
            motivo:      'ESTORNO_NF',
            nfEntradaId: id,
            observacao:  `Estorno NF ${nf.numero || id}`,
          },
        })
      }

      await tx.nfEntrada.update({
        where: { id },
        data: { estoqueElancado: false, custoFormado: false, status: 'RASCUNHO' },
      })
    })

    return { ok: true }
  })

  // ── Estornar Financeiro ───────────────────────────────────────────────────

  app.post('/:id/estornar-financeiro', async (request, reply) => {
    const { id } = request.params as { id: string }

    const nf = await prisma.nfEntrada.findUnique({
      where: { id },
      include: { titulos: { include: { parcelas: true } } },
    })
    if (!nf) return reply.code(404).send({ error: 'NF não encontrada.' })
    if (!nf.financeiroLancado) return reply.code(409).send({ error: 'Financeiro não foi lançado para esta NF.' })

    const parcelasQuitadas = nf.titulos.flatMap(t => t.parcelas).filter(p => p.status === 'QUITADO')
    if (parcelasQuitadas.length > 0) {
      return reply.code(409).send({ error: `Não é possível estornar pois ${parcelasQuitadas.length} parcela(s) já estão quitadas.` })
    }

    await prisma.$transaction(async (tx) => {
      const tituloIds = nf.titulos.map(t => t.id)
      await tx.parcelaFinanceira.deleteMany({ where: { tituloId: { in: tituloIds } } })
      await tx.tituloFinanceiro.deleteMany({ where: { nfEntradaId: id } })
      await tx.nfEntrada.update({ where: { id }, data: { financeiroLancado: false } })
    })

    return { ok: true }
  })

  // ── Excluir NF ────────────────────────────────────────────────────────────

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const nf = await prisma.nfEntrada.findUnique({ where: { id } })
    if (!nf) return reply.code(404).send({ error: 'NF não encontrada.' })
    if (nf.estoqueElancado || nf.financeiroLancado) {
      return reply.code(409).send({ error: 'Não é possível excluir. Estorne os lançamentos primeiro.' })
    }

    await prisma.nfEntrada.delete({ where: { id } })

    return { ok: true }
  })

}
