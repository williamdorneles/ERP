import https from 'node:https'
import { gunzipSync } from 'node:zlib'

// NFeDistribuicaoDFe — consulta NF-es destinadas ao CNPJ via SOAP + mTLS (A1)

const URLS = {
  PRODUCAO:  'https://nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  HOMOLOGACAO: 'https://hom-nfeautorizador.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
}

const UF_CODES: Record<string, string> = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23',
  DF: '53', ES: '32', GO: '52', MA: '21', MT: '51', MS: '50',
  MG: '31', PA: '15', PB: '25', PR: '41', PE: '26', PI: '22',
  RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42',
  SP: '35', SE: '28', TO: '17',
}

export interface DocumentoSefaz {
  nsu: string
  tipoDoc: string  // 'procNFe' | 'resNFe' | 'procEventoNFe'
  xml: string
}

export interface ResultadoConsulta {
  cStat: string
  xMotivo: string
  ultNSU: string
  maxNSU: string
  documentos: DocumentoSefaz[]
}

function tagVal(xml: string, t: string): string {
  const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, 'i'))
  return m ? m[1].trim() : ''
}

function docZips(xml: string): { nsu: string; tipoDoc: string; content: string }[] {
  const re = /<docZip([^>]*)>([\s\S]*?)<\/docZip>/gi
  const results: { nsu: string; tipoDoc: string; content: string }[] = []
  let m
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1]
    const nsu = (attrs.match(/NSU="([^"]*)"/) ?? [])[1] ?? ''
    const tipoDoc = (attrs.match(/tipoDoc="([^"]*)"/) ?? [])[1] ?? ''
    results.push({ nsu, tipoDoc, content: m[2].trim() })
  }
  return results
}

function decodeDocZip(base64gz: string): string {
  const buf = Buffer.from(base64gz.replace(/\s/g, ''), 'base64')
  return gunzipSync(buf).toString('utf8')
}

function buildEnvelope(cnpj: string, cUF: string, tpAmb: '1' | '2', ultNSU: string): string {
  const nsu = ultNSU.padStart(15, '0')
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <cUF>${cUF}</cUF>
      <versaoDados>1.01</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distNFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${cUF}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU>
            <ultNSU>${nsu}</ultNSU>
          </distNSU>
        </distNFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`
}

function httpsPost(url: string, body: string, pfx: Buffer, passphrase: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const bodyBuf = Buffer.from(body, 'utf8')
    const agent = new https.Agent({ pfx, passphrase })

    const req = https.request({
      hostname: u.hostname,
      port: u.port ? Number(u.port) : 443,
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
        'Content-Length': bodyBuf.length,
      },
      agent,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    })

    req.on('error', reject)
    req.setTimeout(30_000, () => { req.destroy(new Error('SEFAZ timeout (30s)')) })
    req.write(bodyBuf)
    req.end()
  })
}

export async function consultarDistribuicao(
  cnpj: string,
  uf: string,
  ambiente: 'PRODUCAO' | 'HOMOLOGACAO',
  pfxBase64: string,
  pfxSenha: string,
  ultNSU: string,
): Promise<ResultadoConsulta> {
  const cUF = UF_CODES[uf.toUpperCase()] ?? '35'
  const tpAmb: '1' | '2' = ambiente === 'PRODUCAO' ? '1' : '2'
  const url = URLS[ambiente]
  const pfx = Buffer.from(pfxBase64, 'base64')

  const envelope = buildEnvelope(cnpj, cUF, tpAmb, ultNSU)
  const responseXml = await httpsPost(url, envelope, pfx, pfxSenha)

  // Extrai o retorno (pode estar dentro de namespace)
  const retXml = tagVal(responseXml, 'retDistDFeInt') || responseXml

  const cStat   = tagVal(retXml, 'cStat')
  const xMotivo = tagVal(retXml, 'xMotivo')
  const ultNSUResp = tagVal(retXml, 'ultNSU')
  const maxNSU     = tagVal(retXml, 'maxNSU')

  const documentos: DocumentoSefaz[] = []
  if (cStat === '138') {
    for (const doc of docZips(retXml)) {
      try {
        documentos.push({ nsu: doc.nsu, tipoDoc: doc.tipoDoc, xml: decodeDocZip(doc.content) })
      } catch {
        // Ignora documento corrompido
      }
    }
  }

  return { cStat, xMotivo, ultNSU: ultNSUResp || ultNSU, maxNSU, documentos }
}
