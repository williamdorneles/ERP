import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { requirePerfil } from '../../plugins/auth.plugin.js'
import {
  emitirNotaFiscal,
  cancelarNotaFiscal,
  consultarStatusNFe,
  criarNFeDePedido,
  transmitirNotaFiscal,
  atualizarNFe,
  getUrlDanfe,
  getUrlXml,
} from './fiscal.service.js'

export async function fiscalRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'FINANCEIRO'))

  // ─── Empresa ───────────────────────────────────────────────────────────────

  app.get('/empresa', async () => {
    const empresa = await prisma.empresa.findFirst({
      include: { certificado: { select: { validade: true, titular: true, serialNumber: true } } },
    })
    return empresa ?? null
  })

  app.put('/empresa', async (request, reply) => {
    const data = request.body as Record<string, unknown>
    const empresa = await prisma.empresa.findFirst()

    if (empresa) {
      return prisma.empresa.update({ where: { id: empresa.id }, data: data as never })
    }
    const nova = await prisma.empresa.create({ data: data as never })
    return reply.code(201).send(nova)
  })

  // ─── Certificado Digital ───────────────────────────────────────────────────

  app.post('/certificado', async (request, reply) => {
    const { arquivoBase64, senha, validade, serialNumber, titular } = request.body as {
      arquivoBase64: string
      senha: string
      validade: string
      serialNumber?: string
      titular?: string
    }

    const empresa = await prisma.empresa.findFirst()
    if (!empresa) return reply.code(400).send({ error: 'Configure a empresa antes de enviar o certificado.' })

    const cert = await prisma.certificadoDigital.upsert({
      where: { empresaId: empresa.id },
      create: {
        empresaId: empresa.id,
        arquivoBase64,
        senha,
        validade: new Date(validade),
        serialNumber,
        titular,
      },
      update: { arquivoBase64, senha, validade: new Date(validade), serialNumber, titular },
    })

    return reply.code(201).send({ id: cert.id, validade: cert.validade, titular: cert.titular })
  })

  app.get('/certificado', async (request, reply) => {
    const empresa = await prisma.empresa.findFirst()
    if (!empresa) return reply.code(404).send({ error: 'Empresa não configurada.' })

    const cert = await prisma.certificadoDigital.findUnique({
      where: { empresaId: empresa.id },
      select: { id: true, validade: true, titular: true, serialNumber: true, criadoEm: true },
    })
    return cert ?? null
  })

  // ─── Notas Fiscais ─────────────────────────────────────────────────────────

  app.get('/nfe', async (request) => {
    const { status, modelo, inicio, fim } = request.query as {
      status?: string; modelo?: string; inicio?: string; fim?: string
    }
    return prisma.notaFiscal.findMany({
      where: {
        ...(status && { status: status as never }),
        ...(modelo && { modelo: modelo as never }),
        ...(inicio && fim && {
          dataEmissao: { gte: new Date(inicio), lte: new Date(fim) },
        }),
      },
      include: {
        itens: { select: { id: true, xProd: true, qCom: true, vProd: true } },
        eventos: { orderBy: { criadoEm: 'desc' }, take: 1 },
        pedidoVenda: { select: { estoqueElancado: true, financeiroLancado: true, numero: true } },
      },
      orderBy: { dataEmissao: 'desc' },
      take: 100,
    })
  })

  app.get('/nfe/estatisticas', async () => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const [total, autorizadas, rejeitadas, canceladas, totalHoje] = await Promise.all([
      prisma.notaFiscal.count(),
      prisma.notaFiscal.count({ where: { status: 'AUTORIZADA' } }),
      prisma.notaFiscal.count({ where: { status: 'REJEITADA' } }),
      prisma.notaFiscal.count({ where: { status: 'CANCELADA' } }),
      prisma.notaFiscal.aggregate({
        where: { status: 'AUTORIZADA', dataEmissao: { gte: hoje } },
        _sum: { vNF: true },
        _count: true,
      }),
    ])
    return {
      total,
      autorizadas,
      rejeitadas,
      canceladas,
      totalHoje: { valor: totalHoje._sum.vNF ?? 0, quantidade: totalHoje._count },
    }
  })

  app.get('/nfe/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const nota = await prisma.notaFiscal.findUnique({
      where: { id },
      include: {
        itens: true,
        eventos: { orderBy: { criadoEm: 'desc' } },
        pedidoVenda: { select: { estoqueElancado: true, financeiroLancado: true, numero: true } },
      },
    })
    if (!nota) return reply.code(404).send({ error: 'Nota fiscal não encontrada.' })
    return nota
  })

  // Emitir NF-e avulsa (corpo completo)
  app.post('/nfe', async (request, reply) => {
    const body = request.body as {
      naturezaOperacao: string
      destNome: string
      destCpfCnpj?: string
      destIE?: string
      destIndicadorIE?: number
      destCep?: string; destLogradouro?: string; destNumero?: string
      destBairro?: string; destMunicipio?: string; destUf?: string; destCodigoIBGE?: string
      formaPagamento?: string
      vDesconto?: number
      infCpl?: string
      pedidoVendaId?: string
      itens: Array<{
        cProd: string; xProd: string; ncm: string; cfop: string
        uCom: string; qCom: number; vUnCom: number; vProd: number
        gtin?: string; origem?: number
        csosn?: string; cstICMS?: string; cstPIS?: string; cstCOFINS?: string
        pICMS?: number; pPIS?: number; pCOFINS?: number
      }>
    }

    const empresa = await prisma.empresa.findFirst()
    if (!empresa) return reply.code(400).send({ error: 'Empresa não configurada.' })

    const empresaAtualizada = await prisma.empresa.update({
      where: { id: empresa.id },
      data: { proximoNumeroNFe: { increment: 1 } },
    })
    const numero = empresaAtualizada.proximoNumeroNFe - 1

    const vNF = body.itens.reduce((acc, i) => acc + i.vProd, 0) - (body.vDesconto ?? 0)

    const nota = await prisma.notaFiscal.create({
      data: {
        empresaId: empresa.id,
        numero,
        serie: empresa.serieNFe,
        modelo: 'NFE',
        status: 'PENDENTE',
        naturezaOperacao: body.naturezaOperacao,
        pedidoVendaId: body.pedidoVendaId,
        destNome: body.destNome,
        destCpfCnpj: body.destCpfCnpj,
        destIE: body.destIE,
        destIndicadorIE: body.destIndicadorIE ?? 9,
        destCep: body.destCep,
        destLogradouro: body.destLogradouro,
        destNumero: body.destNumero,
        destBairro: body.destBairro,
        destMunicipio: body.destMunicipio,
        destUf: body.destUf,
        destCodigoIBGE: body.destCodigoIBGE,
        vDesconto: body.vDesconto ?? 0,
        vNF,
        formaPagamento: body.formaPagamento ?? '01',
        infCpl: body.infCpl,
        itens: {
          create: body.itens.map((i, idx) => ({
            nItem: idx + 1,
            cProd: i.cProd,
            xProd: i.xProd,
            ncm: i.ncm,
            cfop: i.cfop,
            uCom: i.uCom,
            qCom: i.qCom,
            vUnCom: i.vUnCom,
            vProd: i.vProd,
            gtin: i.gtin,
            origem: i.origem ?? 0,
            csosn: i.csosn,
            cstICMS: i.cstICMS,
            cstPIS: i.cstPIS,
            cstCOFINS: i.cstCOFINS,
            pICMS: i.pICMS ?? 0,
            pPIS: i.pPIS ?? 0,
            pCOFINS: i.pCOFINS ?? 0,
          })),
        },
      },
    })

    return reply.code(201).send(nota)
  })

  // Emitir NF-e a partir de PedidoVenda
  app.post('/nfe/from-pedido/:pedidoId', async (request, reply) => {
    const { pedidoId } = request.params as { pedidoId: string }
    const { naturezaOperacao, infCpl } = (request.body ?? {}) as {
      naturezaOperacao?: string; infCpl?: string
    }
    try {
      const nota = await criarNFeDePedido(pedidoId, { naturezaOperacao, infCpl })
      return reply.code(201).send(nota)
    } catch (err) {
      return reply.code(400).send({ error: String(err instanceof Error ? err.message : err) })
    }
  })

  // Editar NF-e PENDENTE
  app.put('/nfe/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const nota = await atualizarNFe(id, request.body as never)
      return nota
    } catch (err) {
      return reply.code(400).send({ error: String(err instanceof Error ? err.message : err) })
    }
  })

  // Transmitir NF-e PENDENTE à SEFAZ (lança estoque/financeiro do pedido se ainda não feito)
  app.post('/nfe/:id/transmitir', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const nota = await transmitirNotaFiscal(id)
      return nota
    } catch (err) {
      return reply.code(400).send({ error: String(err instanceof Error ? err.message : err) })
    }
  })

  // Cancelar NF-e
  app.post('/nfe/:id/cancelar', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { justificativa } = request.body as { justificativa: string }
    if (!justificativa || justificativa.length < 15) {
      return reply.code(400).send({ error: 'Justificativa deve ter no mínimo 15 caracteres.' })
    }
    try {
      const nota = await cancelarNotaFiscal(id, justificativa)
      return nota
    } catch (err) {
      return reply.code(400).send({ error: String(err instanceof Error ? err.message : err) })
    }
  })

  // Retry (reemitir rejeitada)
  app.post('/nfe/:id/retry', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const nota = await emitirNotaFiscal(id)
      return nota
    } catch (err) {
      return reply.code(400).send({ error: String(err instanceof Error ? err.message : err) })
    }
  })

  // Consultar status na SEFAZ
  app.get('/nfe/:id/status-sefaz', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      return consultarStatusNFe(id)
    } catch (err) {
      return reply.code(400).send({ error: String(err instanceof Error ? err.message : err) })
    }
  })

  // Redirect para DANFE (PDF no provider)
  app.get('/nfe/:id/danfe', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const url = await getUrlDanfe(id)
      return reply.redirect(url)
    } catch (err) {
      return reply.code(400).send({ error: String(err instanceof Error ? err.message : err) })
    }
  })

  // Redirect para XML autorizado
  app.get('/nfe/:id/xml', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const url = await getUrlXml(id)
      return reply.redirect(url)
    } catch (err) {
      return reply.code(400).send({ error: String(err instanceof Error ? err.message : err) })
    }
  })

  // Eventos da NF-e
  app.get('/nfe/:id/eventos', async (request) => {
    const { id } = request.params as { id: string }
    return prisma.eventoNFe.findMany({
      where: { notaFiscalId: id },
      orderBy: { criadoEm: 'desc' },
    })
  })
}
