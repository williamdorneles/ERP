import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { requirePerfil } from '../../plugins/auth.plugin.js'
import { parseNFe } from './nfe.parser.js'
import { consultarDistribuicao } from './sefaz-distribuicao.service.js'
import { z } from 'zod'

// ── Schemas de validação ──────────────────────────────────────────────────────

const ItemConfirmacaoSchema = z.object({
  nItem: z.number().int(),
  produtoId: z.string().uuid().nullable(),
  descricao: z.string(),
  ncm: z.string().optional(),
  cfop: z.string().optional(),
  unidade: z.string().optional(),
  quantidade: z.number().positive(),
  valorUnitario: z.number().positive(),
  valorTotal: z.number().positive(),
})

const ParcelaConfirmacaoSchema = z.object({
  numero: z.string(),
  vencimento: z.string(),
  valor: z.number().positive(),
})

const ConfirmarNfEntradaSchema = z.object({
  chaveAcesso: z.string().max(44).optional(),
  numero: z.string().optional(),
  serie: z.string().optional(),
  dataEmissao: z.string(),
  dataEntrada: z.string(),
  fornecedorId: z.string().uuid().optional().nullable(),
  fornecedorNome: z.string().min(1),
  fornecedorCnpj: z.string().optional().nullable(),
  totalProdutos: z.number(),
  totalImpostos: z.number().default(0),
  totalNf: z.number(),
  observacao: z.string().max(500).optional(),
  contaFinanceiraId: z.string().uuid().optional().nullable(),
  itens: z.array(ItemConfirmacaoSchema).min(1),
  parcelas: z.array(ParcelaConfirmacaoSchema).min(1),
  xmlOriginal: z.string().optional(),
})

export async function nfEntradaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'FINANCEIRO', 'ESTOQUE'))

  // ── Parse XML ─────────────────────────────────────────────────────────────

  app.post('/parse-xml', async (request, reply) => {
    const { xml } = request.body as { xml: string }
    if (!xml?.trim()) return reply.code(400).send({ error: 'XML não informado.' })

    try {
      const parsed = parseNFe(xml)

      // Tenta auto-vincular fornecedor por CNPJ
      let fornecedor = null
      if (parsed.emitenteCnpj) {
        const cnpjLimpo = parsed.emitenteCnpj.replace(/\D/g, '')
        fornecedor = await prisma.pessoa.findFirst({
          where: { documento: { contains: cnpjLimpo } },
          select: { id: true, nome: true, documento: true },
        })
      }

      // Tenta auto-vincular produtos por código ou NCM
      const itensComProduto = await Promise.all(
        parsed.itens.map(async item => {
          let produto = null

          // 1. Por código exato
          if (item.cProd) {
            produto = await prisma.produto.findFirst({
              where: { codigo: item.cProd, ativo: true },
              select: { id: true, codigo: true, nome: true, unidadeMedida: true, custoUnitario: true },
            })
          }

          // 2. Por NCM (pega o primeiro cadastrado com esse NCM)
          if (!produto && item.ncm) {
            produto = await prisma.produto.findFirst({
              where: { ncm: item.ncm, ativo: true },
              select: { id: true, codigo: true, nome: true, unidadeMedida: true, custoUnitario: true },
            })
          }

          return { ...item, produto }
        })
      )

      return { ...parsed, fornecedor, itens: itensComProduto }
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

  // ── Confirmar NF de Entrada ────────────────────────────────────────────────

  app.post('/confirmar', async (request, reply) => {
    const data = ConfirmarNfEntradaSchema.parse(request.body)

    // Verifica chave duplicada
    if (data.chaveAcesso) {
      const existe = await prisma.nfEntrada.findUnique({ where: { chaveAcesso: data.chaveAcesso } })
      if (existe) return reply.code(409).send({ error: 'NF-e com esta chave de acesso já foi lançada.' })
    }

    // Busca configuração de método de custo
    const configMetodo = await prisma.configuracao.findUnique({ where: { chave: 'METODO_CUSTO' } })
    const metodo = configMetodo?.valor ?? 'MEDIO'

    // Itens vinculados a produtos (apenas os que têm produtoId)
    const itensComProduto = data.itens.filter(i => i.produtoId)

    // Busca produtos atuais para cálculo do custo médio
    const produtos = itensComProduto.length > 0
      ? await prisma.produto.findMany({
          where: { id: { in: itensComProduto.map(i => i.produtoId!) } },
          select: { id: true, estoqueAtual: true, custoMedio: true, ultimoCusto: true },
        })
      : []

    const produtoMap = new Map(produtos.map(p => [p.id, p]))

    await prisma.$transaction(async (tx) => {
      // 1. Cria NfEntrada
      const nf = await tx.nfEntrada.create({
        data: {
          chaveAcesso: data.chaveAcesso || null,
          numero: data.numero || null,
          serie: data.serie || null,
          dataEmissao: new Date(data.dataEmissao),
          dataEntrada: new Date(data.dataEntrada),
          fornecedorId: data.fornecedorId || null,
          fornecedorNome: data.fornecedorNome,
          fornecedorCnpj: data.fornecedorCnpj || null,
          totalProdutos: data.totalProdutos,
          totalImpostos: data.totalImpostos,
          totalNf: data.totalNf,
          status: 'CONFIRMADA',
          observacao: data.observacao || null,
          xmlOriginal: data.xmlOriginal || null,
          itens: {
            create: data.itens.map(i => ({
              nItem: i.nItem,
              descricao: i.descricao,
              ncm: i.ncm || null,
              cfop: i.cfop || null,
              unidade: i.unidade || null,
              quantidade: i.quantidade,
              valorUnitario: i.valorUnitario,
              valorTotal: i.valorTotal,
              produtoId: i.produtoId || null,
            })),
          },
        },
      })

      // 2. Para cada item com produto vinculado: movimentação + atualiza custo
      for (const item of itensComProduto) {
        const prod = produtoMap.get(item.produtoId!)
        if (!prod) continue

        const estoqueAtual = Number(prod.estoqueAtual)
        const custoMedioAtual = Number(prod.custoMedio)
        const novoCusto = item.valorUnitario

        // Custo médio ponderado
        const novoEstoque = estoqueAtual + item.quantidade
        const novoCustoMedio = novoEstoque > 0
          ? (estoqueAtual * custoMedioAtual + item.quantidade * novoCusto) / novoEstoque
          : novoCusto

        const custoAtivo = metodo === 'ULTIMO' ? novoCusto : novoCustoMedio

        // Movimentação de estoque
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: item.produtoId!,
            nfEntradaId: nf.id,
            tipo: 'ENTRADA',
            quantidade: item.quantidade,
            custoUnitario: novoCusto,
            observacao: `NF ${data.numero || nf.id} — ${item.descricao}`,
          },
        })

        // Atualiza produto
        await tx.produto.update({
          where: { id: item.produtoId! },
          data: {
            estoqueAtual: { increment: item.quantidade },
            ultimoCusto: novoCusto,
            custoMedio: +novoCustoMedio.toFixed(4),
            custoUnitario: +custoAtivo.toFixed(4),
          },
        })
      }

      // 3. Cria Título a Pagar com parcelas
      const totalParcelas = data.parcelas.reduce((s, p) => s + p.valor, 0)
      await tx.tituloFinanceiro.create({
        data: {
          tipo: 'PAGAR',
          descricao: `NF ${data.numero || nf.id} — ${data.fornecedorNome}`,
          total: totalParcelas,
          pessoaId: data.fornecedorId || null,
          nfEntradaId: nf.id,
          contaFinanceiraId: data.contaFinanceiraId || null,
          observacao: data.observacao || null,
          parcelas: {
            create: data.parcelas.map((p, idx) => ({
              numero: idx + 1,
              valor: p.valor,
              vencimento: new Date(p.vencimento),
              observacao: p.numero ? `Dup. ${p.numero}` : null,
            })),
          },
        },
      })
    })

    return reply.code(201).send({ ok: true })
  })

  // ── Sincronizar com SEFAZ (NFeDistribuicaoDFe) ────────────────────────────

  app.post('/sincronizar-sefaz', async (_request, reply) => {
    const empresa = await prisma.empresa.findFirst({
      include: { certificado: true },
    })
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
          empresa.cnpj,
          empresa.uf,
          empresa.ambiente,
          empresa.certificado.arquivoBase64,
          empresa.certificado.senha,
          ultNSU,
        )
      } catch (err) {
        return reply.code(502).send({
          error: `Falha ao comunicar com SEFAZ: ${err instanceof Error ? err.message : 'erro desconhecido'}`,
        })
      }

      // cStat 656 = consumo indevido (rate limit: 1 req/hora por CNPJ)
      if (resultado.cStat === '656') {
        return reply.code(429).send({ error: 'SEFAZ: consumo indevido — aguarde antes de consultar novamente (limite: 1 vez por hora por CNPJ).' })
      }

      if (resultado.cStat !== '137' && resultado.cStat !== '138') {
        return reply.code(502).send({ error: `SEFAZ retornou: ${resultado.cStat} — ${resultado.xMotivo}` })
      }

      todosDocumentos.push(...resultado.documentos)

      if (resultado.ultNSU) ultNSU = resultado.ultNSU

      // Continua paginando se ainda há documentos
      temMais = resultado.cStat === '138' &&
                resultado.ultNSU !== resultado.maxNSU &&
                !!resultado.maxNSU
    }

    // Persiste último NSU consultado
    await prisma.configuracao.upsert({
      where: { chave: 'ULTIMO_NSU_ENTRADA' },
      update: { valor: ultNSU },
      create: { chave: 'ULTIMO_NSU_ENTRADA', valor: ultNSU, descricao: 'Último NSU da distribuição NF-e de entrada' },
    })

    // Processa apenas procNFe (XML completo autorizado)
    const cnpjEmpresa = empresa.cnpj.replace(/\D/g, '')

    const nfeXmls = todosDocumentos.filter(d => d.tipoDoc === 'procNFe')

    // Chaves já importadas (evita duplicatas)
    const chavesExistentes = new Set(
      (await prisma.nfEntrada.findMany({ select: { chaveAcesso: true }, where: { chaveAcesso: { not: null } } }))
        .map(n => n.chaveAcesso!),
    )

    const nfesParseadas: unknown[] = []

    for (const doc of nfeXmls) {
      try {
        const parsed = parseNFe(doc.xml)

        // Só importa NF-es onde somos o destinatário
        const destCnpj = parsed.destinatarioCnpj.replace(/\D/g, '')
        if (destCnpj && destCnpj !== cnpjEmpresa) continue

        // Pula chaves já importadas
        if (parsed.chaveAcesso && chavesExistentes.has(parsed.chaveAcesso)) continue

        // Auto-vincula fornecedor por CNPJ
        let fornecedor = null
        if (parsed.emitenteCnpj) {
          const cnpjLimpo = parsed.emitenteCnpj.replace(/\D/g, '')
          fornecedor = await prisma.pessoa.findFirst({
            where: { documento: { contains: cnpjLimpo } },
            select: { id: true, nome: true, documento: true },
          })
        }

        // Auto-vincula produtos por código ou NCM
        const itensComProduto = await Promise.all(
          parsed.itens.map(async item => {
            let produto = null
            if (item.cProd) {
              produto = await prisma.produto.findFirst({
                where: { codigo: item.cProd, ativo: true },
                select: { id: true, codigo: true, nome: true, unidadeMedida: true, custoUnitario: true },
              })
            }
            if (!produto && item.ncm) {
              produto = await prisma.produto.findFirst({
                where: { ncm: item.ncm, ativo: true },
                select: { id: true, codigo: true, nome: true, unidadeMedida: true, custoUnitario: true },
              })
            }
            return { ...item, produto }
          }),
        )

        nfesParseadas.push({
          nsu: doc.nsu,
          ...parsed,
          fornecedor,
          itens: itensComProduto,
          xmlOriginal: doc.xml,
        })
      } catch {
        // Ignora XML malformado
      }
    }

    const resNFeCount = todosDocumentos.filter(d => d.tipoDoc === 'resNFe').length

    return {
      totalDocumentos: todosDocumentos.length,
      nfesNovos: nfesParseadas.length,
      resNFeIgnorados: resNFeCount,
      ultNSU,
      nfes: nfesParseadas,
    }
  })

  // ── Cancelar NF ───────────────────────────────────────────────────────────

  app.patch('/:id/cancelar', async (request, reply) => {
    const { id } = request.params as { id: string }
    const nf = await prisma.nfEntrada.findUnique({
      where: { id },
      include: { itens: { where: { produtoId: { not: null } } }, titulos: { include: { parcelas: { where: { status: 'QUITADO' } } } } },
    })
    if (!nf) return reply.code(404).send({ error: 'NF não encontrada.' })
    if (nf.status === 'CANCELADA') return reply.code(409).send({ error: 'NF já cancelada.' })
    if (nf.titulos.some(t => t.parcelas.length > 0)) {
      return reply.code(409).send({ error: 'NF possui parcelas já quitadas. Não é possível cancelar.' })
    }

    await prisma.$transaction(async (tx) => {
      // Estorna movimentações de estoque
      for (const item of nf.itens) {
        if (!item.produtoId) continue
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: item.produtoId,
            nfEntradaId: id,
            tipo: 'AJUSTE',
            quantidade: -item.quantidade,
            observacao: `Estorno NF ${nf.numero || id}`,
          },
        })
        await tx.produto.update({
          where: { id: item.produtoId },
          data: { estoqueAtual: { decrement: item.quantidade } },
        })
      }

      // Cancela títulos a pagar
      await tx.parcelaFinanceira.updateMany({
        where: { titulo: { nfEntradaId: id }, status: 'ABERTO' },
        data: { status: 'CANCELADO' },
      })
      await tx.tituloFinanceiro.updateMany({
        where: { nfEntradaId: id },
        data: { status: 'CANCELADO' },
      })

      await tx.nfEntrada.update({ where: { id }, data: { status: 'CANCELADA' } })
    })

    return { ok: true }
  })
}
