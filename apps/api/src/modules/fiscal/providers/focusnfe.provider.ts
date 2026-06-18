export interface ResultadoEmissao {
  status: 'AUTORIZADA' | 'REJEITADA' | 'PROCESSANDO'
  chave?: string
  protocolo?: string
  xmlAutorizacao?: string
  mensagem?: string
  referencia?: string
}

export interface ResultadoCancelamento {
  sucesso: boolean
  protocolo?: string
  xml?: string
  mensagem?: string
}

const URLS = {
  HOMOLOGACAO: 'https://homologacao.focusnfe.com.br',
  PRODUCAO: 'https://api.focusnfe.com.br',
}

function baseUrl(ambiente: string) {
  return ambiente === 'PRODUCAO' ? URLS.PRODUCAO : URLS.HOMOLOGACAO
}

function authHeaders(apiKey: string) {
  const b64 = Buffer.from(`${apiKey}:`).toString('base64')
  return { Authorization: `Basic ${b64}`, 'Content-Type': 'application/json' }
}

export async function emitirNFe(
  payload: Record<string, unknown>,
  referencia: string,
  ambiente: string,
  apiKey: string,
): Promise<ResultadoEmissao> {
  const url = `${baseUrl(ambiente)}/v2/nfe?ref=${referencia}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(payload),
  })

  const body = await resp.json() as Record<string, unknown>

  if (resp.status === 202 || resp.status === 200) {
    const status = String(body.status ?? '')
    if (status === 'autorizado') {
      return {
        status: 'AUTORIZADA',
        chave: String(body.chave_nfe ?? ''),
        protocolo: String(body.numero_protocolo ?? ''),
        mensagem: String(body.mensagem_sefaz ?? 'Autorizado'),
        referencia,
      }
    }
    if (status === 'em_processamento') {
      return { status: 'PROCESSANDO', referencia, mensagem: 'Em processamento pela SEFAZ' }
    }
    return {
      status: 'REJEITADA',
      mensagem: String(body.mensagem_sefaz ?? body.mensagem ?? 'Rejeitado pela SEFAZ'),
      referencia,
    }
  }

  const erros = Array.isArray(body.erros)
    ? (body.erros as Array<{ codigo?: string; mensagem?: string }>).map(e => e.mensagem).join('; ')
    : String(body.mensagem ?? resp.statusText)

  return { status: 'REJEITADA', mensagem: erros, referencia }
}

export async function consultarNFe(
  referencia: string,
  ambiente: string,
  apiKey: string,
): Promise<ResultadoEmissao> {
  const url = `${baseUrl(ambiente)}/v2/nfe/${referencia}`
  const resp = await fetch(url, { headers: authHeaders(apiKey) })
  const body = await resp.json() as Record<string, unknown>

  const status = String(body.status ?? '')
  if (status === 'autorizado') {
    return {
      status: 'AUTORIZADA',
      chave: String(body.chave_nfe ?? ''),
      protocolo: String(body.numero_protocolo ?? ''),
      mensagem: String(body.mensagem_sefaz ?? 'Autorizado'),
      referencia,
    }
  }
  return { status: 'REJEITADA', mensagem: String(body.mensagem_sefaz ?? body.mensagem ?? ''), referencia }
}

export async function cancelarNFe(
  referencia: string,
  justificativa: string,
  ambiente: string,
  apiKey: string,
): Promise<ResultadoCancelamento> {
  const url = `${baseUrl(ambiente)}/v2/nfe/${referencia}`
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(apiKey),
    body: JSON.stringify({ justificativa }),
  })
  const body = await resp.json() as Record<string, unknown>

  if (resp.ok || resp.status === 200 || resp.status === 204) {
    return {
      sucesso: true,
      protocolo: String(body.numero_protocolo ?? ''),
      mensagem: String(body.mensagem_sefaz ?? 'Cancelada'),
    }
  }
  return { sucesso: false, mensagem: String(body.mensagem ?? resp.statusText) }
}

export async function urlDanfe(referencia: string, ambiente: string): Promise<string> {
  return `${baseUrl(ambiente)}/v2/nfe/${referencia}/danfe`
}

export async function urlXml(referencia: string, ambiente: string): Promise<string> {
  return `${baseUrl(ambiente)}/v2/nfe/${referencia}/xml/nota`
}

// ─── Mapeamento FormaPagamento → código SEFAZ ───
const FORMA_PAG: Record<string, string> = {
  DINHEIRO: '01',
  CREDITO: '03',
  DEBITO: '04',
  PIX: '17',
  PRAZO: '15',
}

const CRT_MAP: Record<string, number> = {
  SIMPLES_NACIONAL: 1,
  SIMPLES_EXCESSO: 2,
  REGIME_NORMAL: 3,
}

export interface EmpresaFiscal {
  razaoSocial: string
  nomeFantasia?: string | null
  cnpj: string
  ie?: string | null
  crt: string
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  municipio?: string | null
  uf?: string | null
  codigoIBGE?: string | null
  fone?: string | null
}

export interface ItemNFeInput {
  nItem: number
  cProd: string
  xProd: string
  ncm: string
  cfop: string
  uCom: string
  qCom: number
  vUnCom: number
  vProd: number
  gtin?: string | null
  origem: number
  csosn?: string | null
  cstICMS?: string | null
  cstPIS?: string | null
  cstCOFINS?: string | null
  pICMS?: number | null
  pPIS?: number | null
  pCOFINS?: number | null
}

export interface NFeInput {
  empresa: EmpresaFiscal
  naturezaOperacao: string
  dataEmissao: string
  destNome: string
  destCpfCnpj?: string | null
  destIE?: string | null
  destIndicadorIE: number
  destCep?: string | null
  destLogradouro?: string | null
  destNumero?: string | null
  destBairro?: string | null
  destMunicipio?: string | null
  destUf?: string | null
  destCodigoIBGE?: string | null
  itens: ItemNFeInput[]
  formaPagamento: string
  vTotal: number
  vDesconto?: number
  infCpl?: string | null
}

export function buildFocusNFePayload(input: NFeInput): Record<string, unknown> {
  const isSimples = input.empresa.crt === 'SIMPLES_NACIONAL' || input.empresa.crt === 'SIMPLES_EXCESSO'

  const items = input.itens.map(item => {
    const base: Record<string, unknown> = {
      numero_item: item.nItem,
      codigo_produto: item.cProd,
      descricao: item.xProd,
      ncm: item.ncm,
      cfop: item.cfop,
      unidade_comercial: item.uCom,
      quantidade_comercial: item.qCom,
      valor_unitario_comercial: item.vUnCom,
      valor_bruto: item.vProd,
      codigo_ean: item.gtin ?? 'SEM GTIN',
      unidade_tributavel: item.uCom,
      quantidade_tributavel: item.qCom,
      valor_unitario_tributavel: item.vUnCom,
      origem_mercadoria: item.origem,
    }

    if (isSimples) {
      base.situacao_tributaria = item.csosn ?? '400'
    } else {
      base.situacao_tributaria = item.cstICMS ?? '00'
      if (item.pICMS && item.pICMS > 0) {
        base.modalidade_base_calculo = 3
        base.aliquota_icms = item.pICMS
        base.valor_base_calculo = item.vProd
        base.valor_icms = +(item.vProd * (item.pICMS / 100)).toFixed(2)
      }
    }

    // PIS
    base.pis_situacao_tributaria = item.cstPIS ?? (isSimples ? '07' : '01')
    if (item.pPIS && item.pPIS > 0 && !isSimples) {
      base.pis_base_calculo = item.vProd
      base.pis_aliquota_percentual = item.pPIS
      base.pis_valor = +(item.vProd * (item.pPIS / 100)).toFixed(2)
    } else {
      base.pis_valor = 0
    }

    // COFINS
    base.cofins_situacao_tributaria = item.cstCOFINS ?? (isSimples ? '07' : '01')
    if (item.pCOFINS && item.pCOFINS > 0 && !isSimples) {
      base.cofins_base_calculo = item.vProd
      base.cofins_aliquota_percentual = item.pCOFINS
      base.cofins_valor = +(item.vProd * (item.pCOFINS / 100)).toFixed(2)
    } else {
      base.cofins_valor = 0
    }

    return base
  })

  const payload: Record<string, unknown> = {
    natureza_operacao: input.naturezaOperacao,
    data_emissao: input.dataEmissao,
    data_entrada_saida: input.dataEmissao,
    tipo_documento: 1,
    local_destino: 1,
    finalidade_emissao: 1,
    consumidor_final: 1,
    presenca_comprador: 1,
    // Emitente
    cnpj_emitente: input.empresa.cnpj,
    nome_emitente: input.empresa.razaoSocial,
    nome_fantasia_emitente: input.empresa.nomeFantasia ?? input.empresa.razaoSocial,
    ie_emitente: input.empresa.ie ?? '',
    regime_tributario_emitente: CRT_MAP[input.empresa.crt] ?? 1,
    cep_emitente: input.empresa.cep ?? '',
    logradouro_emitente: input.empresa.logradouro ?? '',
    numero_emitente: input.empresa.numero ?? 'S/N',
    bairro_emitente: input.empresa.bairro ?? '',
    municipio_emitente: input.empresa.municipio ?? '',
    uf_emitente: input.empresa.uf ?? '',
    codigo_municipio_emitente: input.empresa.codigoIBGE ?? '',
    // Destinatário
    indicador_ie_destinatario: input.destIndicadorIE,
    nome_destinatario: input.destNome,
    cep_destinatario: input.destCep ?? '',
    logradouro_destinatario: input.destLogradouro ?? 'Não informado',
    numero_destinatario: input.destNumero ?? 'S/N',
    bairro_destinatario: input.destBairro ?? '',
    municipio_destinatario: input.destMunicipio ?? input.empresa.municipio ?? '',
    uf_destinatario: input.destUf ?? input.empresa.uf ?? '',
    codigo_municipio_destinatario: input.destCodigoIBGE ?? input.empresa.codigoIBGE ?? '',
    items,
    formas_pagamento: [
      {
        forma_pagamento: FORMA_PAG[input.formaPagamento] ?? '01',
        valor_pagamento: input.vTotal,
      },
    ],
  }

  if (input.destCpfCnpj) {
    const doc = input.destCpfCnpj.replace(/\D/g, '')
    if (doc.length === 14) payload.cnpj_destinatario = doc
    else if (doc.length === 11) payload.cpf_destinatario = doc
  }

  if (input.destIE) payload.ie_destinatario = input.destIE
  if (input.vDesconto && input.vDesconto > 0) payload.valor_desconto = input.vDesconto
  if (input.infCpl) payload.informacoes_adicionais_contribuinte = input.infCpl

  return payload
}
