import { prisma } from '@erp/database'
import {
  emitirNFe,
  cancelarNFe,
  consultarNFe,
  buildFocusNFePayload,
  urlDanfe,
  urlXml,
  type NFeInput,
  type ItemNFeInput,
} from './providers/focusnfe.provider.js'
import { permiteEstoqueNegativo } from '../estoque/config-estoque.js'
import { resolverCfop, destinoPorUF } from './cfop.js'

// Retorna empresa + valida campos mínimos para criação de nota
export async function getEmpresaOuErro() {
  const empresa = await prisma.empresa.findFirst()
  if (!empresa) throw new Error('Empresa não configurada. Acesse Fiscal > Configuração.')
  if (!empresa.cnpj) throw new Error('CNPJ da empresa não informado.')
  return empresa
}

export async function emitirNotaFiscal(notaFiscalId: string) {
  const nota = await prisma.notaFiscal.findUnique({
    where: { id: notaFiscalId },
    include: { itens: true, empresa: true },
  })
  if (!nota) throw new Error('Nota fiscal não encontrada.')
  if (nota.status !== 'PENDENTE' && nota.status !== 'REJEITADA') {
    throw new Error(`Nota com status ${nota.status} não pode ser reemitida.`)
  }

  const empresa = nota.empresa
  if (!empresa.providerApiKey) throw new Error('API Key não configurada.')

  // Marca como processando
  await prisma.notaFiscal.update({ where: { id: notaFiscalId }, data: { status: 'PROCESSANDO' } })

  const itensFocus: ItemNFeInput[] = nota.itens.map(i => ({
    nItem: i.nItem,
    cProd: i.cProd,
    xProd: i.xProd,
    ncm: i.ncm,
    cfop: i.cfop,
    uCom: i.uCom,
    qCom: Number(i.qCom),
    vUnCom: Number(i.vUnCom),
    vProd: Number(i.vProd),
    gtin: i.gtin,
    origem: i.origem,
    csosn: i.csosn,
    cstICMS: i.cstICMS,
    cstPIS: i.cstPIS,
    cstCOFINS: i.cstCOFINS,
    pICMS: i.pICMS ? Number(i.pICMS) : null,
    pPIS: i.pPIS ? Number(i.pPIS) : null,
    pCOFINS: i.pCOFINS ? Number(i.pCOFINS) : null,
  }))

  const input: NFeInput = {
    empresa: {
      razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia,
      cnpj: empresa.cnpj,
      ie: empresa.ie,
      crt: empresa.crt,
      cep: empresa.cep,
      logradouro: empresa.logradouro,
      numero: empresa.numero,
      complemento: empresa.complemento,
      bairro: empresa.bairro,
      municipio: empresa.municipio,
      uf: empresa.uf,
      codigoIBGE: empresa.codigoIBGE,
      fone: empresa.fone,
    },
    naturezaOperacao: nota.naturezaOperacao,
    dataEmissao: nota.dataEmissao.toISOString(),
    destNome: nota.destNome,
    destCpfCnpj: nota.destCpfCnpj,
    destIE: nota.destIE,
    destIndicadorIE: nota.destIndicadorIE,
    destCep: nota.destCep,
    destLogradouro: nota.destLogradouro,
    destNumero: nota.destNumero,
    destBairro: nota.destBairro,
    destMunicipio: nota.destMunicipio,
    destUf: nota.destUf,
    destCodigoIBGE: nota.destCodigoIBGE,
    itens: itensFocus,
    formaPagamento: nota.formaPagamento,
    vTotal: Number(nota.vNF),
    vDesconto: Number(nota.vDesconto),
    infCpl: nota.infCpl,
  }

  const focusPayload = buildFocusNFePayload(input)
  const referencia = nota.referenciaNFe ?? nota.id

  try {
    const resultado = await emitirNFe(focusPayload, referencia, empresa.ambiente, empresa.providerApiKey)

    const statusNova = resultado.status === 'AUTORIZADA' ? 'AUTORIZADA'
      : resultado.status === 'PROCESSANDO' ? 'PROCESSANDO'
      : 'REJEITADA'

    const atualizada = await prisma.notaFiscal.update({
      where: { id: notaFiscalId },
      data: {
        status: statusNova,
        chave: resultado.chave,
        protocolo: resultado.protocolo,
        xmlAutorizacao: resultado.xmlAutorizacao,
        mensagemSefaz: resultado.mensagem,
        referenciaNFe: referencia,
      },
    })

    await prisma.eventoNFe.create({
      data: {
        notaFiscalId,
        tipo: '100',
        descricao: 'Emissão',
        protocolo: resultado.protocolo,
        motivo: resultado.mensagem,
      },
    })

    return atualizada
  } catch (err) {
    await prisma.notaFiscal.update({
      where: { id: notaFiscalId },
      data: { status: 'REJEITADA', mensagemSefaz: String(err) },
    })
    throw err
  }
}

export async function cancelarNotaFiscal(notaFiscalId: string, justificativa: string) {
  const nota = await prisma.notaFiscal.findUnique({ where: { id: notaFiscalId }, include: { empresa: true } })
  if (!nota) throw new Error('Nota fiscal não encontrada.')
  if (nota.status !== 'AUTORIZADA') throw new Error('Somente notas AUTORIZADAS podem ser canceladas.')

  const empresa = nota.empresa
  if (!empresa.providerApiKey) throw new Error('API Key não configurada.')

  const referencia = nota.referenciaNFe ?? nota.id
  const resultado = await cancelarNFe(referencia, justificativa, empresa.ambiente, empresa.providerApiKey)

  if (!resultado.sucesso) throw new Error(resultado.mensagem ?? 'Falha ao cancelar na SEFAZ.')

  const atualizada = await prisma.notaFiscal.update({
    where: { id: notaFiscalId },
    data: { status: 'CANCELADA', xmlCancelamento: resultado.xml },
  })

  await prisma.eventoNFe.create({
    data: {
      notaFiscalId,
      tipo: '110111',
      descricao: 'Cancelamento',
      protocolo: resultado.protocolo,
      motivo: justificativa,
    },
  })

  return atualizada
}

export async function consultarStatusNFe(notaFiscalId: string) {
  const nota = await prisma.notaFiscal.findUnique({ where: { id: notaFiscalId }, include: { empresa: true } })
  if (!nota) throw new Error('Nota fiscal não encontrada.')

  const empresa = nota.empresa
  if (!empresa.providerApiKey) throw new Error('API Key não configurada.')
  if (!nota.referenciaNFe) throw new Error('Nota sem referência de emissão.')

  const resultado = await consultarNFe(nota.referenciaNFe, empresa.ambiente, empresa.providerApiKey)

  if (resultado.status === 'AUTORIZADA' && nota.status !== 'AUTORIZADA') {
    await prisma.notaFiscal.update({
      where: { id: notaFiscalId },
      data: {
        status: 'AUTORIZADA',
        chave: resultado.chave,
        protocolo: resultado.protocolo,
        mensagemSefaz: resultado.mensagem,
      },
    })
  }

  return resultado
}

export async function getUrlDanfe(notaFiscalId: string): Promise<string> {
  const nota = await prisma.notaFiscal.findUnique({ where: { id: notaFiscalId }, include: { empresa: true } })
  if (!nota) throw new Error('Nota fiscal não encontrada.')
  if (nota.status !== 'AUTORIZADA') throw new Error('Somente notas AUTORIZADAS têm DANFE.')
  if (!nota.referenciaNFe) throw new Error('Sem referência de emissão.')

  const empresa = nota.empresa
  return urlDanfe(nota.referenciaNFe, empresa.ambiente)
}

export async function getUrlXml(notaFiscalId: string): Promise<string> {
  const nota = await prisma.notaFiscal.findUnique({ where: { id: notaFiscalId }, include: { empresa: true } })
  if (!nota) throw new Error('Nota fiscal não encontrada.')
  if (!nota.referenciaNFe) throw new Error('Sem referência de emissão.')

  const empresa = nota.empresa
  return urlXml(nota.referenciaNFe, empresa.ambiente)
}

// Cria NF-e a partir de um PedidoVenda
export async function criarNFeDePedido(
  pedidoVendaId: string,
  options: { naturezaOperacao?: string; infCpl?: string } = {},
) {
  const pedido = await prisma.pedidoVenda.findUnique({
    where: { id: pedidoVendaId },
    include: {
      pessoa: true,
      natureza: { select: { cfop: true, tipoOperacao: true } },
      itens: { include: { produto: true } },
    },
  })
  if (!pedido) throw new Error('Pedido não encontrado.')

  const empresa = await getEmpresaOuErro()

  // CFOP vem da natureza de operação do pedido; fallback para o campo do produto
  const cfopBase = pedido.natureza?.cfop ?? null
  const tipoOp = pedido.natureza?.tipoOperacao === 'ENTRADA' ? 'ENTRADA' : 'SAIDA'
  const destino = destinoPorUF(empresa.uf, pedido.pessoa?.uf)

  // Valida NCM (obrigatório no produto). CFOP pode vir da natureza — valida só se também não tiver no produto
  const semNcm = pedido.itens.filter(i => !i.produto.ncm)
  if (semNcm.length > 0) {
    const nomes = semNcm.map(i => i.produto.nome).join(', ')
    throw new Error(`Produtos sem NCM: ${nomes}`)
  }
  if (!cfopBase) {
    const semCfop = pedido.itens.filter(i => !i.produto.cfop)
    if (semCfop.length > 0) {
      const nomes = semCfop.map(i => i.produto.nome).join(', ')
      throw new Error(`Natureza de operação sem CFOP e produtos sem CFOP: ${nomes}`)
    }
  }

  // Calcula totais
  const vICMS = 0
  const vPIS = pedido.itens.reduce((acc, i) => {
    const pPIS = Number(i.produto.pPIS ?? 0)
    return acc + (Number(i.subtotal) * pPIS / 100)
  }, 0)
  const vCOFINS = pedido.itens.reduce((acc, i) => {
    const pCOFINS = Number(i.produto.pCOFINS ?? 0)
    return acc + (Number(i.subtotal) * pCOFINS / 100)
  }, 0)

  // Incrementa número atomicamente
  const empresaAtualizada = await prisma.empresa.update({
    where: { id: empresa.id },
    data: { proximoNumeroNFe: { increment: 1 } },
  })
  const numero = empresaAtualizada.proximoNumeroNFe - 1

  const itensFiscais = pedido.itens.map((item, idx) => {
    const cfopResolvido = resolverCfop(cfopBase ?? item.produto.cfop, tipoOp, destino)
      ?? item.produto.cfop
      ?? ''
    return {
    nItem: idx + 1,
    cProd: item.produto.codigo,
    xProd: item.produto.nome,
    ncm: item.produto.ncm!,
    cfop: cfopResolvido,
    uCom: item.produto.unidadeComercial ?? 'UN',
    qCom: Number(item.quantidade),
    vUnCom: Number(item.precoUnitario),
    vProd: Number(item.subtotal),
    gtin: item.produto.gtin,
    origem: item.produto.origem,
    csosn: item.produto.csosn,
    cstICMS: item.produto.cstICMS,
    cstPIS: item.produto.cstPIS,
    cstCOFINS: item.produto.cstCOFINS,
    pICMS: item.produto.pICMS ? Number(item.produto.pICMS) : null,
    pPIS: item.produto.pPIS ? Number(item.produto.pPIS) : null,
    pCOFINS: item.produto.pCOFINS ? Number(item.produto.pCOFINS) : null,
    vBCICMS: 0,
    pICMSval: 0,
    vICMSval: 0,
    vBCPIS: Number(item.subtotal),
    vPISval: +(Number(item.subtotal) * Number(item.produto.pPIS ?? 0) / 100).toFixed(2),
    vBCCOFINS: Number(item.subtotal),
    vCOFINSval: +(Number(item.subtotal) * Number(item.produto.pCOFINS ?? 0) / 100).toFixed(2),
    }
  })

  const nota = await prisma.$transaction(async (tx) => {
    const nf = await tx.notaFiscal.create({
      data: {
        empresaId: empresa.id,
        numero,
        serie: empresa.serieNFe,
        modelo: 'NFE',
        status: 'PENDENTE',
        naturezaOperacao: options.naturezaOperacao ?? 'Venda de Produto',
        pedidoVendaId,
        referenciaNFe: undefined,
        destNome: pedido.pessoa?.nome ?? 'Consumidor Final',
        destCpfCnpj: pedido.pessoa?.documento,
        destIE: pedido.pessoa?.ie,
        destIndicadorIE: pedido.pessoa?.indicadorIE ?? 9,
        destCep: pedido.pessoa?.cep,
        destLogradouro: pedido.pessoa?.logradouro,
        destNumero: pedido.pessoa?.numero,
        destBairro: pedido.pessoa?.bairro,
        destMunicipio: pedido.pessoa?.municipio,
        destUf: pedido.pessoa?.uf,
        destCodigoIBGE: pedido.pessoa?.codigoIBGE,
        vICMS,
        vPIS: +vPIS.toFixed(2),
        vCOFINS: +vCOFINS.toFixed(2),
        vDesconto: Number(pedido.desconto),
        vNF: Number(pedido.total),
        formaPagamento: pedido.formaPagamento,
        infCpl: options.infCpl,
        itens: {
          create: itensFiscais.map(i => ({
            nItem: i.nItem,
            cProd: i.cProd,
            xProd: i.xProd,
            ncm: i.ncm,
            cfop: i.cfop,
            uCom: i.uCom,
            qCom: i.qCom,
            vUnCom: i.vUnCom,
            vProd: i.vProd,
            gtin: i.gtin,
            origem: i.origem,
            csosn: i.csosn,
            cstICMS: i.cstICMS,
            cstPIS: i.cstPIS,
            cstCOFINS: i.cstCOFINS,
            pICMS: i.pICMS ?? 0,
            pPIS: i.pPIS ?? 0,
            pCOFINS: i.pCOFINS ?? 0,
            vPIS: i.vPISval,
            vCOFINS: i.vCOFINSval,
          })),
        },
      },
    })
    return nf
  })

  return nota
}

// Transmite nota PENDENTE à SEFAZ e lança estoque/financeiro do pedido vinculado se ainda não feito
export async function transmitirNotaFiscal(notaFiscalId: string) {
  const notaEmitida = await emitirNotaFiscal(notaFiscalId)
  if (notaEmitida.status !== 'AUTORIZADA' || !notaEmitida.pedidoVendaId) return notaEmitida

  const pedido = await prisma.pedidoVenda.findUnique({
    where: { id: notaEmitida.pedidoVendaId },
    include: {
      itens: { include: { produto: { select: { id: true, nome: true, estoqueAtual: true, custoMedio: true } } } },
      natureza: { select: { movimentaEstoque: true, geraFinanceiro: true, contaFinanceiraId: true } },
    },
  })
  if (!pedido || pedido.status === 'CANCELADO') return notaEmitida

  // Lançar estoque se necessário
  if (!pedido.estoqueElancado) {
    const movimentaEstoque = pedido.natureza?.movimentaEstoque ?? 'SAIDA'
    if (movimentaEstoque !== 'NENHUM') {
      const tipoMov = movimentaEstoque === 'ENTRADA' ? 'ENTRADA' : 'SAIDA' as const
      const podeNegativo = await permiteEstoqueNegativo()

      const podeLancar = podeNegativo || tipoMov === 'ENTRADA' || pedido.itens.every(
        item => Number(item.produto.estoqueAtual) - Number(item.quantidade) >= -0.001,
      )

      if (podeLancar) {
        await prisma.$transaction(async (tx) => {
          for (const item of pedido.itens) {
            const qtde = +Number(item.quantidade).toFixed(3)
            const custo = +Number(item.produto.custoMedio).toFixed(4)
            await tx.movimentacaoEstoque.create({
              data: {
                produtoId: item.produtoId,
                pedidoVendaId: pedido.id,
                tipo: tipoMov,
                quantidade: qtde,
                custoUnitario: custo,
                observacao: `Venda Pedido ${pedido.numero} — NF-e ${notaEmitida.numero}`,
              },
            })
            await tx.produto.update({
              where: { id: item.produtoId },
              data: { estoqueAtual: tipoMov === 'SAIDA' ? { decrement: qtde } : { increment: qtde } },
            })
          }
          await tx.pedidoVenda.update({ where: { id: pedido.id }, data: { estoqueElancado: true } })
        })
      }
    }
  }

  // Lançar financeiro se necessário
  if (!pedido.financeiroLancado && (pedido.natureza === null || pedido.natureza.geraFinanceiro)) {
    type ParcelaP = { numero: string; vencimento: string; valor: number; meioPagamento?: string }
    const totalNf = Number(pedido.total)
    const vencPadrao = pedido.dataEmissao
      ? new Date(pedido.dataEmissao).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)

    let parcelas: ParcelaP[] = pedido.parcelasJson ? JSON.parse(pedido.parcelasJson as string) : []
    parcelas = parcelas.filter(p => p.vencimento && Number(p.valor) > 0)
    if (parcelas.length === 0) {
      parcelas = [{ numero: '001', vencimento: vencPadrao, valor: totalNf }]
    }

    const totalParcelas = parcelas.reduce((s, p) => s + Number(p.valor), 0)
    const contaFinanceiraId = pedido.natureza?.contaFinanceiraId ?? null

    await prisma.tituloFinanceiro.create({
      data: {
        tipo: 'RECEBER',
        descricao: `Venda Pedido ${pedido.numero}`,
        documento: String(pedido.numero),
        total: totalParcelas,
        pessoaId: pedido.pessoaId || null,
        pedidoVendaId: pedido.id,
        contaFinanceiraId,
        status: 'ABERTO',
        parcelas: {
          create: parcelas.map((p, idx) => ({
            numero: idx + 1,
            valor: p.valor,
            vencimento: new Date(p.vencimento),
            status: 'ABERTO',
            observacao: p.numero ? `Dup. ${p.numero}` : null,
          })),
        },
      },
    })
    await prisma.pedidoVenda.update({ where: { id: pedido.id }, data: { financeiroLancado: true } })
  }

  return notaEmitida
}

// Atualiza campos editáveis de uma nota PENDENTE (cabeçalho + itens)
export async function atualizarNFe(notaFiscalId: string, data: {
  naturezaOperacao?: string
  infCpl?: string
  finNFe?: number
  dataEmissao?: string
  destNome?: string
  destCpfCnpj?: string
  destIE?: string
  destIndicadorIE?: number
  destCep?: string
  destLogradouro?: string
  destNumero?: string
  destBairro?: string
  destMunicipio?: string
  destUf?: string
  destCodigoIBGE?: string
  formaPagamento?: string
  vFrete?: number
  vSeguro?: number
  vDesconto?: number
  itens?: Array<{
    id: string
    xProd?: string
    cProd?: string
    qCom?: number
    vUnCom?: number
    vProd?: number
    uCom?: string
    ncm?: string
    cfop?: string
    pICMS?: number
    pPIS?: number
    pCOFINS?: number
  }>
}) {
  const nota = await prisma.notaFiscal.findUnique({
    where: { id: notaFiscalId },
    select: { status: true, vFrete: true, vSeguro: true, vDesconto: true },
  })
  if (!nota) throw new Error('Nota fiscal não encontrada.')
  if (nota.status !== 'PENDENTE') throw new Error('Somente notas PENDENTE podem ser editadas.')

  return prisma.$transaction(async (tx) => {
    if (data.itens?.length) {
      for (const item of data.itens) {
        const { id, ...campos } = item
        await tx.itemNotaFiscal.update({
          where: { id },
          data: {
            ...(campos.xProd !== undefined && { xProd: campos.xProd }),
            ...(campos.cProd !== undefined && { cProd: campos.cProd }),
            ...(campos.qCom !== undefined && { qCom: campos.qCom }),
            ...(campos.vUnCom !== undefined && { vUnCom: campos.vUnCom }),
            ...(campos.vProd !== undefined && { vProd: campos.vProd }),
            ...(campos.uCom !== undefined && { uCom: campos.uCom }),
            ...(campos.ncm !== undefined && { ncm: campos.ncm }),
            ...(campos.cfop !== undefined && { cfop: campos.cfop }),
            ...(campos.pICMS !== undefined && { pICMS: campos.pICMS }),
            ...(campos.pPIS !== undefined && { pPIS: campos.pPIS }),
            ...(campos.pCOFINS !== undefined && { pCOFINS: campos.pCOFINS }),
          },
        })
      }
    }

    const vFrete = data.vFrete ?? Number(nota.vFrete ?? 0)
    const vSeguro = data.vSeguro ?? Number(nota.vSeguro ?? 0)
    const vDesconto = data.vDesconto ?? Number(nota.vDesconto ?? 0)
    const vNF = data.itens?.length
      ? Math.max(data.itens.reduce((s, i) => s + Number(i.vProd ?? 0), 0) + vFrete + vSeguro - vDesconto, 0)
      : undefined

    return tx.notaFiscal.update({
      where: { id: notaFiscalId },
      data: {
        ...(data.naturezaOperacao !== undefined && { naturezaOperacao: data.naturezaOperacao }),
        ...(data.infCpl !== undefined && { infCpl: data.infCpl }),
        ...(data.finNFe !== undefined && { finNFe: data.finNFe }),
        ...(data.dataEmissao !== undefined && { dataEmissao: new Date(data.dataEmissao) }),
        ...(data.destNome !== undefined && { destNome: data.destNome }),
        ...(data.destCpfCnpj !== undefined && { destCpfCnpj: data.destCpfCnpj }),
        ...(data.destIE !== undefined && { destIE: data.destIE }),
        ...(data.destIndicadorIE !== undefined && { destIndicadorIE: data.destIndicadorIE }),
        ...(data.destCep !== undefined && { destCep: data.destCep }),
        ...(data.destLogradouro !== undefined && { destLogradouro: data.destLogradouro }),
        ...(data.destNumero !== undefined && { destNumero: data.destNumero }),
        ...(data.destBairro !== undefined && { destBairro: data.destBairro }),
        ...(data.destMunicipio !== undefined && { destMunicipio: data.destMunicipio }),
        ...(data.destUf !== undefined && { destUf: data.destUf }),
        ...(data.destCodigoIBGE !== undefined && { destCodigoIBGE: data.destCodigoIBGE }),
        ...(data.formaPagamento !== undefined && { formaPagamento: data.formaPagamento }),
        ...(data.vFrete !== undefined && { vFrete: data.vFrete }),
        ...(data.vSeguro !== undefined && { vSeguro: data.vSeguro }),
        ...(data.vDesconto !== undefined && { vDesconto: data.vDesconto }),
        ...(vNF !== undefined && { vNF }),
      },
    })
  })
}
