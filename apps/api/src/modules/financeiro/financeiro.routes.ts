import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import {
  CriarContaBancariaSchema,
  AtualizarContaBancariaSchema,
  LancamentoManualSchema,
  AjusteSaldoSchema,
  CriarContaFinanceiraSchema,
  AtualizarContaFinanceiraSchema,
  ClassificarTransacaoSchema,
  AprovarLoteSchema,
  CriarRegraClassificacaoSchema,
  AtualizarRegraClassificacaoSchema,
} from '@erp/shared'
import { requirePerfil } from '../../plugins/auth.plugin.js'
import { parseOFX, normalizePayeeName } from './ofx.parser.js'
import { classificarTransacaoSync, buscarHistoricoClassificacao } from './classificacao.engine.js'

export async function financeiroRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'FINANCEIRO'))

  // ── Contas Bancárias ──────────────────────────────────────────

  app.get('/contas-bancarias', async (request) => {
    const { mostrarInativas } = request.query as { mostrarInativas?: string }
    const contas = await prisma.contaBancaria.findMany({
      where: mostrarInativas === 'true' ? {} : { ativo: true },
      orderBy: [{ isCaixa: 'desc' }, { nome: 'asc' }],
    })

    const saldos = await prisma.transacaoFinanceira.groupBy({
      by: ['contaBancariaId', 'tipo'],
      where: { contaBancariaId: { in: contas.map(c => c.id) } },
      _sum: { valor: true },
    })

    return contas.map(conta => {
      const creditos = saldos.filter(s => s.contaBancariaId === conta.id && s.tipo === 'CREDITO')
        .reduce((acc, s) => acc + Number(s._sum.valor ?? 0), 0)
      const debitos = saldos.filter(s => s.contaBancariaId === conta.id && s.tipo === 'DEBITO')
        .reduce((acc, s) => acc + Number(s._sum.valor ?? 0), 0)
      return { ...conta, saldoAtual: Number(conta.saldoInicial) + creditos - debitos }
    })
  })

  app.post('/contas-bancarias', async (request, reply) => {
    const data = CriarContaBancariaSchema.parse(request.body)
    const cb = await prisma.contaBancaria.create({ data: data as never })
    return reply.code(201).send(cb)
  })

  app.put('/contas-bancarias/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = AtualizarContaBancariaSchema.parse(request.body)
    const cb = await prisma.contaBancaria.update({ where: { id }, data: data as never })
    return cb
  })

  app.patch('/contas-bancarias/:id/toggle-ativo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const atual = await prisma.contaBancaria.findUnique({ where: { id }, select: { ativo: true } })
    if (!atual) return reply.code(404).send({ error: 'Conta não encontrada.' })
    return prisma.contaBancaria.update({ where: { id }, data: { ativo: !atual.ativo } })
  })

  // ── Extrato ───────────────────────────────────────────────────

  app.get('/contas-bancarias/:id/extrato', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { dataInicio, dataFim, pagina, limite } = request.query as {
      dataInicio?: string; dataFim?: string; pagina?: string; limite?: string
    }

    const conta = await prisma.contaBancaria.findUnique({ where: { id } })
    if (!conta) return reply.code(404).send({ error: 'Conta não encontrada.' })

    const page = Number(pagina ?? 1)
    const lim = Math.min(Number(limite ?? 50), 200)

    const where: Record<string, unknown> = { contaBancariaId: id }
    if (dataInicio || dataFim) {
      where.data = {
        ...(dataInicio && { gte: new Date(dataInicio) }),
        ...(dataFim && { lte: new Date(dataFim) }),
      }
    }

    const [lancamentos, total] = await Promise.all([
      prisma.transacaoFinanceira.findMany({
        where,
        include: { contaFinanceira: { select: { id: true, codigo: true, nome: true } } },
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
        skip: (page - 1) * lim,
        take: lim,
      }),
      prisma.transacaoFinanceira.count({ where }),
    ])

    // Saldo até a data de início (exclusive) para calcular saldo corrente
    const saldoAntes = dataInicio
      ? await prisma.transacaoFinanceira.groupBy({
          by: ['tipo'],
          where: { contaBancariaId: id, data: { lt: new Date(dataInicio) } },
          _sum: { valor: true },
        }).then(grupos => {
          const cred = grupos.find(g => g.tipo === 'CREDITO')?._sum.valor ?? 0
          const deb = grupos.find(g => g.tipo === 'DEBITO')?._sum.valor ?? 0
          return Number(conta.saldoInicial) + Number(cred) - Number(deb)
        })
      : Number(conta.saldoInicial)

    return { conta: { ...conta, saldoAntes }, lancamentos, total, pagina: page, limite: lim, paginas: Math.ceil(total / lim) }
  })

  // ── Lançamento Manual ─────────────────────────────────────────

  app.post('/contas-bancarias/:id/lancamento', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tipo, valor, data, descricao, contaFinanceiraId } = LancamentoManualSchema.parse(request.body)

    const conta = await prisma.contaBancaria.findUnique({ where: { id } })
    if (!conta) return reply.code(404).send({ error: 'Conta não encontrada.' })

    const lancamento = await prisma.transacaoFinanceira.create({
      data: {
        contaBancariaId: id,
        fitid: `MANUAL-${crypto.randomUUID()}`,
        data: new Date(data),
        valor,
        tipo,
        descricao,
        nomeOriginal: descricao,
        contaFinanceiraId: contaFinanceiraId ?? null,
        fonteClassificacao: 'MANUAL',
        confiancaClassificacao: 1,
        status: 'REVISADO',
      },
    })
    return reply.code(201).send(lancamento)
  })

  // ── Ajuste de Saldo ───────────────────────────────────────────

  app.post('/contas-bancarias/:id/ajuste-saldo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { saldoDesejado, data, descricao } = AjusteSaldoSchema.parse(request.body)

    const conta = await prisma.contaBancaria.findUnique({ where: { id } })
    if (!conta) return reply.code(404).send({ error: 'Conta não encontrada.' })

    // Calcula saldo atual
    const grupos = await prisma.transacaoFinanceira.groupBy({
      by: ['tipo'],
      where: { contaBancariaId: id },
      _sum: { valor: true },
    })
    const cred = grupos.find(g => g.tipo === 'CREDITO')?._sum.valor ?? 0
    const deb = grupos.find(g => g.tipo === 'DEBITO')?._sum.valor ?? 0
    const saldoAtual = Number(conta.saldoInicial) + Number(cred) - Number(deb)
    const diferenca = saldoDesejado - saldoAtual

    if (Math.abs(diferenca) < 0.01) {
      return reply.code(400).send({ error: 'Saldo já está correto. Nenhum ajuste necessário.' })
    }

    const ajuste = await prisma.transacaoFinanceira.create({
      data: {
        contaBancariaId: id,
        fitid: `AJUSTE-${crypto.randomUUID()}`,
        data: new Date(data),
        valor: Math.abs(diferenca),
        tipo: diferenca > 0 ? 'CREDITO' : 'DEBITO',
        descricao: descricao ?? 'Ajuste de saldo',
        nomeOriginal: descricao ?? 'Ajuste de saldo',
        fonteClassificacao: 'MANUAL',
        confiancaClassificacao: 1,
        status: 'REVISADO',
      },
    })
    return reply.code(201).send({ ajuste, saldoAnterior: saldoAtual, saldoNovo: saldoDesejado, diferenca })
  })

  // ── Plano de Contas ───────────────────────────────────────────

  app.get('/contas', async (request) => {
    const { mostrarInativas } = request.query as { mostrarInativas?: string }
    return prisma.contaFinanceira.findMany({
      where: mostrarInativas === 'true' ? {} : { ativo: true },
      orderBy: { codigoCompleto: 'asc' },
    })
  })

  app.get('/contas/arvore', async () => {
    const contas = await prisma.contaFinanceira.findMany({
      where: { ativo: true }, orderBy: { codigoCompleto: 'asc' },
    })
    return buildTree(contas)
  })

  app.post('/contas', async (request, reply) => {
    const data = CriarContaFinanceiraSchema.parse(request.body)
    let nivel = 1
    let codigoCompleto = data.codigo
    if (data.contaPaiId) {
      const pai = await prisma.contaFinanceira.findUnique({ where: { id: data.contaPaiId } })
      if (pai) { nivel = pai.nivel + 1; codigoCompleto = `${pai.codigoCompleto}.${data.codigo}` }
    }
    const conta = await prisma.contaFinanceira.create({
      data: {
        codigo: data.codigo,
        nome: data.nome,
        tipo: data.tipo as never,
        natureza: data.natureza as never,
        contaPaiId: data.contaPaiId || null,
        isAnalitica: data.isAnalitica ?? true,
        nivel,
        codigoCompleto,
      },
    })
    return reply.code(201).send(conta)
  })

  app.put('/contas/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = AtualizarContaFinanceiraSchema.parse(request.body)
    const conta = await prisma.contaFinanceira.update({ where: { id }, data: data as never })
    return conta
  })

  app.delete('/contas/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const temLancamentos = await prisma.transacaoFinanceira.count({ where: { contaFinanceiraId: id } })
    if (temLancamentos > 0) {
      return reply.code(409).send({ error: `Conta possui ${temLancamentos} lançamento(s) vinculado(s) e não pode ser inativada.` })
    }
    const temSubcontas = await prisma.contaFinanceira.count({ where: { contaPaiId: id, ativo: true } })
    if (temSubcontas > 0) {
      return reply.code(409).send({ error: 'Conta possui subcontas ativas. Inative-as primeiro.' })
    }
    await prisma.contaFinanceira.update({ where: { id }, data: { ativo: false } })
    return reply.send({ ok: true })
  })

  app.patch('/contas/:id/reativar', async (request, reply) => {
    const { id } = request.params as { id: string }
    const conta = await prisma.contaFinanceira.findUnique({ where: { id } })
    if (!conta) return reply.code(404).send({ error: 'Conta não encontrada.' })
    await prisma.contaFinanceira.update({ where: { id }, data: { ativo: true } })
    return reply.send({ ok: true })
  })

  // ── Importação OFX ────────────────────────────────────────────
  // Frontend envia o conteúdo do arquivo como string no body JSON
  // para evitar dependência de @fastify/multipart

  app.post('/ofx/importar', async (request, reply) => {
    const { conteudo, arquivo, contaBancariaId: cbIdReq } = request.body as {
      conteudo: string; arquivo: string; contaBancariaId?: string
    }

    const importacao = await prisma.importacaoOFX.create({
      data: { arquivo, status: 'PROCESSANDO', contaBancariaId: cbIdReq || null },
    })

    try {
      const extrato = parseOFX(conteudo)

      // Associa ou cria conta bancária pelo ofxContaId
      let contaBancariaId = cbIdReq ?? null
      if (!contaBancariaId) {
        let cb = await prisma.contaBancaria.findFirst({
          where: { ofxContaId: extrato.accountId },
        })
        if (!cb) {
          cb = await prisma.contaBancaria.create({
            data: {
              nome: `${extrato.bankId || 'Banco'} ${extrato.accountId}`,
              banco: extrato.bankId,
              conta: extrato.accountId,
              ofxBancoId: extrato.bankId,
              ofxContaId: extrato.accountId,
            },
          })
        }
        contaBancariaId = cb.id
        await prisma.importacaoOFX.update({ where: { id: importacao.id }, data: { contaBancariaId } })
      }

      // Carrega regras uma única vez para classificar todas as transações em memória
      const regras = await prisma.regraClassificacao.findMany({
        where: { ativo: true },
        orderBy: { prioridade: 'asc' },
      })

      // Descobre duplicatas em uma única query (em vez de uma por transação)
      const fitidsExistentes = new Set(
        (await prisma.transacaoFinanceira.findMany({
          where: {
            contaBancariaId,
            fitid: { in: extrato.transactions.map(t => t.fitid) },
          },
          select: { fitid: true },
        })).map(t => t.fitid)
      )

      const novasTxs = extrato.transactions.filter(t => !fitidsExistentes.has(t.fitid))
      const duplicadas = extrato.transactions.length - novasTxs.length
      let classificadas = 0

      // 1ª passagem: classificação por regras (síncrona, em memória)
      const matchesPorRegra = new Map<string, number>()
      const primeiraPassagem = novasTxs.map(tx => {
        const classif = classificarTransacaoSync(tx, regras)
        if (classif?.fonte === 'REGRA') {
          matchesPorRegra.set(classif.regraId, (matchesPorRegra.get(classif.regraId) ?? 0) + 1)
        }
        return { tx, classif }
      })

      // 2ª passagem: histórico para as que as regras não cobriram
      const nomesParaHistorico = [...new Set(
        primeiraPassagem
          .filter(p => !p.classif && p.tx.name)
          .map(p => p.tx.name!),
      )]
      const historico = await buscarHistoricoClassificacao(nomesParaHistorico)

      const rows = primeiraPassagem.map(({ tx, classif }) => {
        let classificacaoFinal = classif
        if (!classificacaoFinal && tx.name) {
          const hist = historico.get(tx.name.toLowerCase().trim())
          if (hist) classificacaoFinal = { fonte: 'HISTORICO', ...hist }
        }
        if (classificacaoFinal) classificadas++
        return {
          contaBancariaId,
          fitid: tx.fitid,
          data: new Date(tx.date),
          valor: tx.amount,
          tipo: tx.type === 'CREDIT' ? 'CREDITO' : 'DEBITO',
          descricao: normalizePayeeName(tx.name || tx.memo || '') || tx.memo || tx.name || '',
          nomeOriginal: tx.name,
          memoOriginal: tx.memo,
          contaFinanceiraId: classificacaoFinal?.contaFinanceiraId ?? null,
          fonteClassificacao: classificacaoFinal?.fonte ?? null,
          confiancaClassificacao: classificacaoFinal?.confianca ?? null,
          status: classificacaoFinal ? 'SUGERIDO' : 'PENDENTE',
        }
      })

      // Insere todas de uma vez + atualiza contadores de regra em paralelo
      await Promise.all([
        prisma.transacaoFinanceira.createMany({ data: rows as never[], skipDuplicates: true }),
        ...Array.from(matchesPorRegra.entries()).map(([id, count]) =>
          prisma.regraClassificacao.update({ where: { id }, data: { totalMatchs: { increment: count } } })
        ),
      ])

      const novas = novasTxs.length

      await prisma.importacaoOFX.update({
        where: { id: importacao.id },
        data: {
          status: 'CONCLUIDO',
          totalTransacoes: extrato.transactions.length,
          novas, duplicadas, classificadas,
        },
      })

      return reply.code(201).send({
        importacaoId: importacao.id,
        total: extrato.transactions.length,
        novas, duplicadas, classificadas,
        pendentes: novas - classificadas,
        contaBancariaId,
      })
    } catch (err) {
      await prisma.importacaoOFX.update({
        where: { id: importacao.id },
        data: { status: 'ERRO', erro: err instanceof Error ? err.message : 'Erro desconhecido' },
      })
      return reply.code(500).send({ error: 'Erro ao processar OFX.' })
    }
  })

  app.get('/ofx/importacoes', async () =>
    prisma.importacaoOFX.findMany({
      include: { contaBancaria: { select: { nome: true } } },
      orderBy: { criadoEm: 'desc' },
    })
  )

  // ── Transações ────────────────────────────────────────────────

  app.get('/transacoes', async (request) => {
    const { status, contaBancariaId, dataInicio, dataFim, pagina, limite } = request.query as {
      status?: string; contaBancariaId?: string; dataInicio?: string; dataFim?: string
      pagina?: string; limite?: string
    }
    const page = Number(pagina ?? 1)
    const lim = Math.min(Number(limite ?? 50), 100)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (contaBancariaId) where.contaBancariaId = contaBancariaId
    if (dataInicio || dataFim) where.data = {
      ...(dataInicio && { gte: new Date(dataInicio) }),
      ...(dataFim && { lte: new Date(dataFim) }),
    }

    const [dados, total] = await Promise.all([
      prisma.transacaoFinanceira.findMany({
        where,
        include: {
          contaBancaria: { select: { id: true, nome: true } },
          contaFinanceira: { select: { id: true, codigo: true, nome: true } },
        },
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
        skip: (page - 1) * lim,
        take: lim,
      }),
      prisma.transacaoFinanceira.count({ where }),
    ])

    return { dados, total, pagina: page, limite: lim, paginas: Math.ceil(total / lim) }
  })

  app.put('/transacoes/:id/classificar', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { contaFinanceiraId, aplicarSimilares } = ClassificarTransacaoSchema.parse(request.body)

    const tx = await prisma.transacaoFinanceira.findUnique({ where: { id } })
    if (!tx) return reply.code(404).send({ error: 'Transação não encontrada.' })

    await prisma.transacaoFinanceira.update({
      where: { id },
      data: { contaFinanceiraId, fonteClassificacao: 'MANUAL', confiancaClassificacao: 1.0, status: 'REVISADO' },
    })

    let similaresAtualizados = 0
    if (aplicarSimilares && tx.nomeOriginal) {
      const prefixo = tx.nomeOriginal.toUpperCase().slice(0, 30)
      const { count } = await prisma.transacaoFinanceira.updateMany({
        where: { status: 'PENDENTE', nomeOriginal: { contains: prefixo, mode: 'insensitive' } },
        data: { contaFinanceiraId, fonteClassificacao: 'MANUAL', confiancaClassificacao: 0.9, status: 'CLASSIFICADO' },
      })
      similaresAtualizados = count
    }

    return { ok: true, similaresAtualizados }
  })

  app.put('/transacoes/:id/aprovar', async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.transacaoFinanceira.update({ where: { id }, data: { status: 'REVISADO' } })
    return { ok: true }
  })

  app.post('/transacoes/aprovar-lote', async (request) => {
    const { ids } = AprovarLoteSchema.parse(request.body)
    const { count } = await prisma.transacaoFinanceira.updateMany({
      where: { id: { in: ids } },
      data: { status: 'REVISADO' },
    })
    return { atualizados: count }
  })

  // Re-classifica todas as transações PENDENTE usando regras + histórico
  app.post('/transacoes/reclassificar-pendentes', async () => {
    const pendentes = await prisma.transacaoFinanceira.findMany({
      where: { status: 'PENDENTE' },
      select: { id: true, nomeOriginal: true, memoOriginal: true, valor: true, tipo: true },
    })

    if (pendentes.length === 0) return { reclassificadas: 0 }

    const regras = await prisma.regraClassificacao.findMany({
      where: { ativo: true },
      orderBy: { prioridade: 'asc' },
    })

    // 1ª passagem: regras
    type Pendente = typeof pendentes[number]
    const semRegra: Pendente[] = []
    const atualizacoesRegra: { id: string; contaFinanceiraId: string; fonte: string; confianca: number }[] = []

    for (const tx of pendentes) {
      const classif = classificarTransacaoSync(
        { name: tx.nomeOriginal ?? '', memo: tx.memoOriginal ?? '', amount: Number(tx.valor), type: tx.tipo === 'CREDITO' ? 'CREDIT' : 'DEBIT' },
        regras,
      )
      if (classif) {
        atualizacoesRegra.push({ id: tx.id, contaFinanceiraId: classif.contaFinanceiraId, fonte: classif.fonte, confianca: classif.confianca })
      } else {
        semRegra.push(tx)
      }
    }

    // 2ª passagem: histórico para as restantes
    const nomesParaHistorico = [...new Set(semRegra.map(t => t.nomeOriginal).filter(Boolean) as string[])]
    const historico = await buscarHistoricoClassificacao(nomesParaHistorico)

    const atualizacoesHistorico: { id: string; contaFinanceiraId: string; fonte: string; confianca: number }[] = []
    for (const tx of semRegra) {
      if (!tx.nomeOriginal) continue
      const hist = historico.get(tx.nomeOriginal.toLowerCase().trim())
      if (hist) atualizacoesHistorico.push({ id: tx.id, contaFinanceiraId: hist.contaFinanceiraId, fonte: 'HISTORICO', confianca: hist.confianca })
    }

    const todasAtualizacoes = [...atualizacoesRegra, ...atualizacoesHistorico]
    if (todasAtualizacoes.length === 0) return { reclassificadas: 0 }

    // Atualiza em paralelo (lote de promises individuais — createMany não suporta update)
    await Promise.all(
      todasAtualizacoes.map(u =>
        prisma.transacaoFinanceira.update({
          where: { id: u.id },
          data: { contaFinanceiraId: u.contaFinanceiraId, fonteClassificacao: u.fonte, confiancaClassificacao: u.confianca, status: 'SUGERIDO' },
        })
      )
    )

    return {
      reclassificadas: todasAtualizacoes.length,
      porRegra: atualizacoesRegra.length,
      porHistorico: atualizacoesHistorico.length,
    }
  })

  // ── Regras de Classificação ───────────────────────────────────

  app.get('/regras', async () =>
    prisma.regraClassificacao.findMany({
      include: { contaFinanceira: { select: { id: true, codigo: true, nome: true } } },
      orderBy: { prioridade: 'asc' },
    })
  )

  app.post('/regras', async (request, reply) => {
    const data = CriarRegraClassificacaoSchema.parse(request.body)
    const regra = await prisma.regraClassificacao.create({ data: data as never })
    return reply.code(201).send(regra)
  })

  app.put('/regras/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = AtualizarRegraClassificacaoSchema.parse(request.body)
    const regra = await prisma.regraClassificacao.update({ where: { id }, data: data as never })
    return regra
  })

  app.delete('/regras/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.regraClassificacao.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  // ── DRE ───────────────────────────────────────────────────────

  app.get('/dre', async (request) => {
    const { dataInicio, dataFim, compDataInicio, compDataFim } = request.query as {
      dataInicio: string; dataFim: string; compDataInicio?: string; compDataFim?: string
    }

    const contas = await prisma.contaFinanceira.findMany({
      where: { isAnalitica: true, ativo: true },
      orderBy: { codigoCompleto: 'asc' },
    })

    const [totaisPeriodo, totaisComp] = await Promise.all([
      getTotaisPorConta(new Date(dataInicio), new Date(dataFim)),
      compDataInicio && compDataFim
        ? getTotaisPorConta(new Date(compDataInicio), new Date(compDataFim))
        : Promise.resolve({} as Record<string, number>),
    ])

    return buildDRE(contas, totaisPeriodo, totaisComp)
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTree(items: { id: string; contaPaiId: string | null; [k: string]: unknown }[]) {
  const map = new Map(items.map(i => [i.id, { ...i, subcontas: [] as unknown[] }]))
  const roots: unknown[] = []
  for (const item of map.values()) {
    if (item.contaPaiId) {
      const pai = map.get(item.contaPaiId as string)
      if (pai) (pai.subcontas as unknown[]).push(item)
    } else {
      roots.push(item)
    }
  }
  return roots
}

async function getTotaisPorConta(dataInicio: Date, dataFim: Date): Promise<Record<string, number>> {
  const grupos = await prisma.transacaoFinanceira.groupBy({
    by: ['contaFinanceiraId', 'tipo'],
    where: {
      data: { gte: dataInicio, lte: dataFim },
      status: { in: ['CLASSIFICADO', 'REVISADO'] },
      contaFinanceiraId: { not: null },
    },
    _sum: { valor: true },
  })

  const totais: Record<string, number> = {}
  for (const g of grupos) {
    if (!g.contaFinanceiraId) continue
    const val = Number(g._sum.valor ?? 0)
    totais[g.contaFinanceiraId] = (totais[g.contaFinanceiraId] ?? 0) +
      (g.tipo === 'CREDITO' ? val : -val)
  }
  return totais
}

function buildDRE(
  contas: { id: string; tipo: string; nome: string; codigo: string; codigoCompleto: string | null }[],
  totais: Record<string, number>,
  totaisComp: Record<string, number>,
) {
  const soma = (tipo: string) => contas.filter(c => c.tipo === tipo).reduce((s, c) => s + (totais[c.id] ?? 0), 0)
  const somaComp = (tipo: string) => contas.filter(c => c.tipo === tipo).reduce((s, c) => s + (totaisComp[c.id] ?? 0), 0)

  const receitaBruta = soma('RECEITA')
  const custo = soma('CUSTO')
  const lucroBruto = receitaBruta - custo
  const despesas = soma('DESPESA')
  const resultadoOp = lucroBruto - despesas
  const naoOp = soma('NAO_OPERACIONAL')
  const resultado = resultadoOp + naoOp

  const receitaBrutaComp = somaComp('RECEITA')
  const custoComp = somaComp('CUSTO')
  const lucroBrutoComp = receitaBrutaComp - custoComp
  const despesasComp = somaComp('DESPESA')
  const resultadoOpComp = lucroBrutoComp - despesasComp
  const naoOpComp = somaComp('NAO_OPERACIONAL')
  const resultadoComp = resultadoOpComp + naoOpComp

  const pct = (v: number, comp: number) => comp !== 0 ? ((v - comp) / Math.abs(comp)) * 100 : null

  const contasPorTipo = (tipo: string) => contas
    .filter(c => c.tipo === tipo)
    .map(c => ({
      id: c.id, codigo: c.codigoCompleto ?? c.codigo, nome: c.nome,
      valor: totais[c.id] ?? 0, valorComp: totaisComp[c.id] ?? 0,
      variacao: pct(totais[c.id] ?? 0, totaisComp[c.id] ?? 0),
      isLinha: true,
    }))

  return [
    { id: 'rec', nome: 'Receita Bruta', valor: receitaBruta, valorComp: receitaBrutaComp, variacao: pct(receitaBruta, receitaBrutaComp), isTitulo: true },
    ...contasPorTipo('RECEITA'),
    { id: 'custo', nome: '(-) Custos', valor: -custo, valorComp: -custoComp, variacao: pct(-custo, -custoComp), isTitulo: true },
    ...contasPorTipo('CUSTO').map(c => ({ ...c, valor: -c.valor, valorComp: -c.valorComp })),
    { id: 'lb', nome: '= Lucro Bruto', valor: lucroBruto, valorComp: lucroBrutoComp, variacao: pct(lucroBruto, lucroBrutoComp), isTotal: true },
    { id: 'desp', nome: '(-) Despesas Operacionais', valor: -despesas, valorComp: -despesasComp, variacao: pct(-despesas, -despesasComp), isTitulo: true },
    ...contasPorTipo('DESPESA').map(c => ({ ...c, valor: -c.valor, valorComp: -c.valorComp })),
    { id: 'rop', nome: '= Resultado Operacional', valor: resultadoOp, valorComp: resultadoOpComp, variacao: pct(resultadoOp, resultadoOpComp), isTotal: true },
    { id: 'naoop', nome: 'Resultado Não Operacional', valor: naoOp, valorComp: naoOpComp, variacao: pct(naoOp, naoOpComp), isTitulo: true },
    ...contasPorTipo('NAO_OPERACIONAL'),
    { id: 'result', nome: '= Resultado Líquido', valor: resultado, valorComp: resultadoComp, variacao: pct(resultado, resultadoComp), isTotal: true, isFinal: true },
  ]
}
