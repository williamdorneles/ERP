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

// Retorna empresa + valida campos mínimos para emissão
export async function getEmpresaOuErro() {
  const empresa = await prisma.empresa.findFirst()
  if (!empresa) throw new Error('Empresa não configurada. Acesse Fiscal > Configuração.')
  if (!empresa.cnpj) throw new Error('CNPJ da empresa não informado.')
  if (!empresa.providerApiKey) throw new Error('API Key do provedor NF-e não configurada.')
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
      itens: { include: { produto: true } },
    },
  })
  if (!pedido) throw new Error('Pedido não encontrado.')

  const empresa = await getEmpresaOuErro()

  // Valida campos fiscais de todos os produtos
  const semFiscal = pedido.itens.filter(i => !i.produto.ncm || !i.produto.cfop)
  if (semFiscal.length > 0) {
    const nomes = semFiscal.map(i => i.produto.nome).join(', ')
    throw new Error(`Produtos sem dados fiscais (NCM/CFOP): ${nomes}`)
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

  const itensFiscais = pedido.itens.map((item, idx) => ({
    nItem: idx + 1,
    cProd: item.produto.codigo,
    xProd: item.produto.nome,
    ncm: item.produto.ncm!,
    cfop: item.produto.cfop!,
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
  }))

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

  // Emite imediatamente (pode ser movido para uma fila em produção com BullMQ)
  return emitirNotaFiscal(nota.id)
}
