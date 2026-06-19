// Parser minimalista de NF-e XML — extrai apenas os campos necessários para entrada de estoque.
// Não usa dependências externas; funciona com o formato padrão NF-e 4.0.

function tag(xml: string, t: string): string {
  const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, 'i'))
  return m ? m[1].trim() : ''
}

function allTags(xml: string, t: string): string[] {
  return [...xml.matchAll(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, 'gi'))].map(m => m[1].trim())
}

function attr(xml: string, a: string): string {
  const m = xml.match(new RegExp(`${a}="([^"]*)"`, 'i'))
  return m ? m[1] : ''
}

function num(s: string): number { return parseFloat(s || '0') || 0 }

export interface NFeItem {
  nItem: number
  cProd: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
}

export interface NFeDuplicata {
  numero: string
  vencimento: string  // YYYY-MM-DD
  valor: number
}

export interface NFeParseResult {
  chaveAcesso: string
  numero: string
  serie: string
  dataEmissao: string   // YYYY-MM-DD
  dataEntrada: string   // YYYY-MM-DD
  emitenteCnpj: string
  emitenteNome: string
  destinatarioCnpj: string
  totalProdutos: number
  // Frete, seguro e despesas (ICMSTot)
  vFrete: number
  vSeg: number
  vDesc: number
  vOutro: number
  // Impostos (ICMSTot)
  vBC: number
  vICMS: number
  vICMSDeson: number
  vBCST: number
  vST: number
  vFCP: number
  vFCPST: number
  vIPI: number
  vIPIDevol: number
  vPIS: number
  vCOFINS: number
  vII: number
  vTotTrib: number
  // Totais
  totalImpostos: number
  totalNf: number
  itens: NFeItem[]
  duplicatas: NFeDuplicata[]
}

export function parseNFe(xmlRaw: string): NFeParseResult {
  // Remove namespace prefixes para simplificar (nfe:, ns:, etc.)
  const xml = xmlRaw.replace(/<\/?[a-z0-9]+:/gi, m => m.replace(/[a-z0-9]+:/, ''))

  // Chave de acesso: no atributo Id da infNFe ou no campo chNFe do nfeProc
  const chaveId = attr(xml, 'Id').replace(/^NFe/, '')
  const chaveTag = tag(xml, 'chNFe')
  const chaveAcesso = chaveId.length === 44 ? chaveId : chaveTag

  const ideXml = tag(xml, 'ide')
  const emitXml = tag(xml, 'emit')
  const totalXml = tag(tag(xml, 'total'), 'ICMSTot')

  // Datas: dhEmi / dhSaiEnt podem vir como "2024-06-15T..." ou "2024-06-15"
  const dhEmi = tag(ideXml, 'dhEmi') || tag(ideXml, 'dEmi')
  const dhEnt = tag(ideXml, 'dhSaiEnt') || tag(ideXml, 'dSaiEnt')
  const toDate = (d: string) => d ? d.slice(0, 10) : new Date().toISOString().slice(0, 10)

  const destXml = tag(xml, 'dest')
  const emitenteCnpj = tag(emitXml, 'CNPJ') || tag(emitXml, 'CPF')
  const emitenteNome = tag(emitXml, 'xFant') || tag(emitXml, 'xNome')
  const destinatarioCnpj = tag(destXml, 'CNPJ') || tag(destXml, 'CPF')

  const totalProdutos = num(tag(totalXml, 'vProd'))
  const totalNf       = num(tag(totalXml, 'vNF'))

  // Frete, seguro e despesas
  const vFrete    = num(tag(totalXml, 'vFrete'))
  const vSeg      = num(tag(totalXml, 'vSeg'))
  const vDesc     = num(tag(totalXml, 'vDesc'))
  const vOutro    = num(tag(totalXml, 'vOutro'))
  // Impostos ICMSTot
  const vBC       = num(tag(totalXml, 'vBC'))
  const vICMS     = num(tag(totalXml, 'vICMS'))
  const vICMSDeson = num(tag(totalXml, 'vICMSDeson'))
  const vBCST     = num(tag(totalXml, 'vBCST'))
  const vST       = num(tag(totalXml, 'vST'))
  const vFCP      = num(tag(totalXml, 'vFCP'))
  const vFCPST    = num(tag(totalXml, 'vFCPST'))
  const vIPI      = num(tag(totalXml, 'vIPI'))
  const vIPIDevol = num(tag(totalXml, 'vIPIDevol'))
  const vPIS      = num(tag(totalXml, 'vPIS'))
  const vCOFINS   = num(tag(totalXml, 'vCOFINS'))
  const vII       = num(tag(totalXml, 'vII'))
  const vTotTrib  = num(tag(totalXml, 'vTotTrib'))

  const totalImpostos = +(vICMS + vST + vIPI + vPIS + vCOFINS + vII + vFCP + vFCPST - vICMSDeson - vIPIDevol).toFixed(2)

  // Itens
  const detXmls = allTags(xml, 'det')
  const itens: NFeItem[] = detXmls.map((detXml, i) => {
    const nItem = parseInt(attr(detXml, 'nItem') || String(i + 1))
    const prodXml = tag(detXml, 'prod')
    return {
      nItem,
      cProd: tag(prodXml, 'cProd'),
      descricao: tag(prodXml, 'xProd'),
      ncm: tag(prodXml, 'NCM'),
      cfop: tag(prodXml, 'CFOP'),
      unidade: tag(prodXml, 'uCom'),
      quantidade: num(tag(prodXml, 'qCom')),
      valorUnitario: num(tag(prodXml, 'vUnCom')),
      valorTotal: num(tag(prodXml, 'vProd')),
    }
  })

  // Duplicatas (parcelas de pagamento no campo <cobr>)
  const cobrXml = tag(xml, 'cobr')
  const dupXmls = allTags(cobrXml, 'dup')
  const duplicatas: NFeDuplicata[] = dupXmls.map(d => ({
    numero: tag(d, 'nDup'),
    vencimento: toDate(tag(d, 'dVenc')),
    valor: num(tag(d, 'vDup')),
  }))

  // Se não houver duplicatas, gera uma única parcela com o total
  if (duplicatas.length === 0) {
    duplicatas.push({
      numero: '001',
      vencimento: toDate(dhEnt || dhEmi),
      valor: totalNf,
    })
  }

  return {
    chaveAcesso,
    numero: tag(ideXml, 'nNF'),
    serie: tag(ideXml, 'serie'),
    dataEmissao: toDate(dhEmi),
    dataEntrada: toDate(dhEnt || dhEmi),
    emitenteCnpj,
    emitenteNome,
    destinatarioCnpj,
    totalProdutos,
    vFrete, vSeg, vDesc, vOutro,
    vBC, vICMS, vICMSDeson, vBCST, vST, vFCP, vFCPST,
    vIPI, vIPIDevol, vPIS, vCOFINS, vII, vTotTrib,
    totalImpostos,
    totalNf,
    itens,
    duplicatas,
  }
}
