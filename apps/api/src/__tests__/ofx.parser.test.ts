import { describe, it, expect } from 'vitest'
import { parseOFX, normalizePayeeName } from '../modules/financeiro/ofx.parser.js'

const OFX_SGML = `
OFXHEADER:100
DATA:OFXSGML
VERSION:151

<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>BRL
        <BANKACCTFROM>
          <BANKID>341
          <ACCTID>12345-6
          <ACCTTYPE>CHECKING
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20240101
          <DTEND>20240131
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20240115
            <TRNAMT>1500.00
            <FITID>2024011501
            <NAME>PAGAMENTO SALARIO
            <MEMO>FOLHA JAN/2024
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20240120
            <TRNAMT>-350.50
            <FITID>2024012001
            <NAME>FORNECEDOR ABC LTDA
            <MEMO>NF 1234
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20240125
            <TRNAMT>0
            <FITID>2024012501
            <NAME>TRANSACAO ZERADA
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`

const OFX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKACCTFROM>
          <BANKID>237</BANKID>
          <ACCTID>99999-0</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20240201</DTSTART>
          <DTEND>20240229</DTEND>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20240205120000</DTPOSTED>
            <TRNAMT>-200.00</TRNAMT>
            <FITID>FEB2024001</FITID>
            <NAME>SUPERMERCADO XYZ</NAME>
            <MEMO>COMPRA CARTAO</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT</TRNTYPE>
            <DTPOSTED>20240210</DTPOSTED>
            <TRNAMT>3000.00</TRNAMT>
            <FITID>FEB2024002</FITID>
            <NAME>CLIENTE EMPRESA SA</NAME>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`

describe('parseOFX — formato SGML', () => {
  const result = parseOFX(OFX_SGML)

  it('extrai dados da conta bancária', () => {
    expect(result.bankId).toBe('341')
    expect(result.accountId).toBe('12345-6')
    expect(result.currency).toBe('BRL')
  })

  it('ignora transações com valor zero', () => {
    expect(result.transactions).toHaveLength(2)
  })

  it('parseia transação de crédito corretamente', () => {
    const credit = result.transactions.find(t => t.fitid === '2024011501')!
    expect(credit.type).toBe('CREDIT')
    expect(credit.amount).toBe(1500)
    expect(credit.name).toBe('PAGAMENTO SALARIO')
    expect(credit.date).toBe('2024-01-15')
  })

  it('parseia transação de débito e normaliza valor para positivo', () => {
    const debit = result.transactions.find(t => t.fitid === '2024012001')!
    expect(debit.type).toBe('DEBIT')
    expect(debit.amount).toBe(350.5)
  })
})

describe('parseOFX — formato XML', () => {
  const result = parseOFX(OFX_XML)

  it('extrai dados da conta bancária', () => {
    expect(result.bankId).toBe('237')
    expect(result.accountId).toBe('99999-0')
  })

  it('parseia duas transações', () => {
    expect(result.transactions).toHaveLength(2)
  })

  it('normaliza data com horário para YYYY-MM-DD', () => {
    const debit = result.transactions.find(t => t.fitid === 'FEB2024001')!
    expect(debit.date).toBe('2024-02-05')
  })

  it('parseia crédito com amount positivo', () => {
    const credit = result.transactions.find(t => t.fitid === 'FEB2024002')!
    expect(credit.type).toBe('CREDIT')
    expect(credit.amount).toBe(3000)
  })
})

describe('normalizePayeeName', () => {
  it('remove prefixo PIX RECEBIDO', () => {
    expect(normalizePayeeName('PIX RECEBIDO PADARIA DO ZE')).toBe('PADARIA DO ZE')
  })

  it('remove prefixo PIX ENVIADO', () => {
    expect(normalizePayeeName('PIX ENVIADO FORNECEDOR ABC')).toBe('FORNECEDOR ABC')
  })

  it('remove datas em formato DD/MM/YYYY', () => {
    const result = normalizePayeeName('COMPRA 15/01/2024 MERCADO')
    expect(result).not.toContain('15/01/2024')
  })

  it('remove números longos', () => {
    const result = normalizePayeeName('TRANSFERENCIA 123456789012 EMPRESA')
    expect(result).not.toContain('123456789012')
  })

  it('converte para maiúsculas e remove espaços duplos', () => {
    expect(normalizePayeeName('  padaria   silva  ')).toBe('PADARIA SILVA')
  })
})
