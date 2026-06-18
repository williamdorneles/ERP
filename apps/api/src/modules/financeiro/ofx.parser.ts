export interface OFXTransaction {
  fitid: string
  date: string      // YYYYMMDD
  amount: number
  type: 'DEBIT' | 'CREDIT'
  name: string
  memo: string
}

export interface OFXStatement {
  bankId: string
  accountId: string
  accountType: string
  currency: string
  startDate: string
  endDate: string
  transactions: OFXTransaction[]
}

export function parseOFX(content: string): OFXStatement {
  // Normaliza quebras de linha e remove BOM
  const text = content.replace(/\r\n/g, '\n').replace(/^﻿/, '').trim()

  // Detecta se é XML (OFX 2.x) ou SGML (OFX 1.x)
  if (text.startsWith('<?xml') || text.startsWith('<OFX>')) {
    return parseOFXXML(text)
  }
  return parseOFXSGML(text)
}

function parseOFXSGML(text: string): OFXStatement {
  const getTag = (tag: string, content: string): string => {
    const match = content.match(new RegExp(`<${tag}>([^<\n]+)`, 'i'))
    return match ? match[1].trim() : ''
  }

  const getAllBlocks = (tag: string, content: string): string[] => {
    const results: string[] = []
    const regex = new RegExp(`<${tag}>[\\s\\S]*?(?=<${tag}>|</${tag.split('.')[0]}>|$)`, 'gi')
    let match
    while ((match = regex.exec(content)) !== null) {
      results.push(match[0])
    }
    return results
  }

  // Remove headers OFX (linhas antes de <OFX>)
  const ofxStart = text.indexOf('<OFX>')
  const body = ofxStart >= 0 ? text.slice(ofxStart) : text

  const bankId = getTag('BANKID', body) || getTag('DTSERVER', body)
  const accountId = getTag('ACCTID', body)
  const accountType = getTag('ACCTTYPE', body) || 'CHECKING'
  const currency = getTag('CURDEF', body) || 'BRL'
  const startDate = getTag('DTSTART', body)
  const endDate = getTag('DTEND', body)

  const stmtTrn = body.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || []

  const transactions: OFXTransaction[] = stmtTrn.map(block => {
    const trnType = getTag('TRNTYPE', block).toUpperCase()
    const rawAmount = parseFloat(getTag('DTAMT', block) || getTag('TRNAMT', block) || '0')
    const amount = Math.abs(rawAmount)
    const type: 'DEBIT' | 'CREDIT' = trnType === 'CREDIT' || rawAmount > 0 ? 'CREDIT' : 'DEBIT'

    return {
      fitid: getTag('FITID', block),
      date: normalizeDate(getTag('DTPOSTED', block)),
      amount,
      type,
      name: getTag('NAME', block),
      memo: getTag('MEMO', block),
    }
  }).filter(t => t.fitid && t.amount > 0)

  return { bankId, accountId, accountType, currency, startDate, endDate, transactions }
}

function parseOFXXML(text: string): OFXStatement {
  const getTag = (tag: string, content: string): string => {
    const match = content.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
    return match ? match[1].trim() : ''
  }

  const bankId = getTag('BANKID', text)
  const accountId = getTag('ACCTID', text)
  const accountType = getTag('ACCTTYPE', text) || 'CHECKING'
  const currency = getTag('CURDEF', text) || 'BRL'
  const startDate = getTag('DTSTART', text)
  const endDate = getTag('DTEND', text)

  const stmtTrn = text.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || []

  const transactions: OFXTransaction[] = stmtTrn.map(block => {
    const trnType = getTag('TRNTYPE', block).toUpperCase()
    const rawAmount = parseFloat(getTag('TRNAMT', block) || '0')
    const amount = Math.abs(rawAmount)
    const type: 'DEBIT' | 'CREDIT' = trnType === 'CREDIT' || rawAmount > 0 ? 'CREDIT' : 'DEBIT'

    return {
      fitid: getTag('FITID', block),
      date: normalizeDate(getTag('DTPOSTED', block)),
      amount,
      type,
      name: getTag('NAME', block),
      memo: getTag('MEMO', block),
    }
  }).filter(t => t.fitid && t.amount > 0)

  return { bankId, accountId, accountType, currency, startDate, endDate, transactions }
}

function normalizeDate(raw: string): string {
  // OFX dates: YYYYMMDD or YYYYMMDDHHMMSS or YYYYMMDDHHMMSS.000[-05:EST]
  const clean = raw.replace(/[.\[].+/, '').slice(0, 8)
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }
  return raw
}

export function normalizePayeeName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, '')   // remove dates
    .replace(/\b\d{5,}\b/g, '')                    // remove long numbers
    .replace(/PIX\s+(?:RECEBIDO|ENVIADO|ENV|REC)\s*/i, '')
    .replace(/TED\s+\d*/i, '')
    .replace(/DOC\s+\d*/i, '')
    .replace(/BOLETO\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 100)
}
