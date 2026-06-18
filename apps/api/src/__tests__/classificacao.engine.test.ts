import { describe, it, expect } from 'vitest'
import { classificarTransacaoSync } from '../modules/financeiro/classificacao.engine.js'

const CONTA_ID = 'conta-001'

type Regra = Parameters<typeof classificarTransacaoSync>[1][number]

function regra(overrides: Partial<Regra>): Regra {
  return {
    id: 'regra-001',
    nome: 'Teste',
    prioridade: 1,
    ativo: true,
    campo: 'NOME',
    tipoCorrespondencia: 'CONTEM',
    valorCorrespondencia: '',
    valorMin: null,
    valorMax: null,
    tipoTransacao: 'QUALQUER',
    contaFinanceiraId: CONTA_ID,
    totalMatchs: 0,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides,
  } as Regra
}

const tx = (name: string, memo = '', amount = 100, type: 'CREDIT' | 'DEBIT' = 'DEBIT') =>
  ({ name, memo, amount, type })

describe('classificarTransacaoSync — campo NOME', () => {
  it('CONTEM: match case insensitive', () => {
    const r = regra({ tipoCorrespondencia: 'CONTEM', valorCorrespondencia: 'padaria' })
    expect(classificarTransacaoSync(tx('Padaria Silva'), [r])).not.toBeNull()
  })

  it('CONTEM: sem match', () => {
    const r = regra({ tipoCorrespondencia: 'CONTEM', valorCorrespondencia: 'supermercado' })
    expect(classificarTransacaoSync(tx('Padaria Silva'), [r])).toBeNull()
  })

  it('COMECA_COM: match', () => {
    const r = regra({ tipoCorrespondencia: 'COMECA_COM', valorCorrespondencia: 'FORN' })
    expect(classificarTransacaoSync(tx('FORNECEDOR ABC'), [r])).not.toBeNull()
  })

  it('COMECA_COM: sem match no meio', () => {
    const r = regra({ tipoCorrespondencia: 'COMECA_COM', valorCorrespondencia: 'FORN' })
    expect(classificarTransacaoSync(tx('EMPRESA FORNECEDOR'), [r])).toBeNull()
  })

  it('TERMINA_COM: match', () => {
    const r = regra({ tipoCorrespondencia: 'TERMINA_COM', valorCorrespondencia: 'LTDA' })
    expect(classificarTransacaoSync(tx('EMPRESA LTDA'), [r])).not.toBeNull()
  })

  it('IGUAL: match exato', () => {
    const r = regra({ tipoCorrespondencia: 'IGUAL', valorCorrespondencia: 'ALUGUEL' })
    expect(classificarTransacaoSync(tx('ALUGUEL'), [r])).not.toBeNull()
  })

  it('IGUAL: não faz match parcial', () => {
    const r = regra({ tipoCorrespondencia: 'IGUAL', valorCorrespondencia: 'ALUGUEL' })
    expect(classificarTransacaoSync(tx('ALUGUEL SALA'), [r])).toBeNull()
  })

  it('REGEX: match por expressão regular', () => {
    const r = regra({ tipoCorrespondencia: 'REGEX', valorCorrespondencia: '^PIX\\s+' })
    expect(classificarTransacaoSync(tx('PIX RECEBIDO CLIENTE'), [r])).not.toBeNull()
  })

  it('REGEX: regex inválido não lança exceção', () => {
    const r = regra({ tipoCorrespondencia: 'REGEX', valorCorrespondencia: '[invalido' })
    expect(() => classificarTransacaoSync(tx('qualquer'), [r])).not.toThrow()
  })
})

describe('classificarTransacaoSync — campo MEMO', () => {
  it('busca no memo quando campo é MEMO', () => {
    const r = regra({ campo: 'MEMO', tipoCorrespondencia: 'CONTEM', valorCorrespondencia: 'NF 001' })
    expect(classificarTransacaoSync(tx('FORNECEDOR', 'NF 001'), [r])).not.toBeNull()
  })

  it('NOME_OU_MEMO: faz match em qualquer um', () => {
    const r = regra({ campo: 'NOME_OU_MEMO', tipoCorrespondencia: 'CONTEM', valorCorrespondencia: 'LUZ' })
    expect(classificarTransacaoSync(tx('CEMIG', 'CONTA LUZ'), [r])).not.toBeNull()
    expect(classificarTransacaoSync(tx('CONTA LUZ'), [r])).not.toBeNull()
  })
})

describe('classificarTransacaoSync — campo VALOR', () => {
  it('INTERVALO: match dentro do range', () => {
    const r = regra({ campo: 'VALOR', tipoCorrespondencia: 'INTERVALO', valorMin: 100, valorMax: 500 })
    expect(classificarTransacaoSync(tx('CONTA LUZ', '', 250), [r])).not.toBeNull()
  })

  it('INTERVALO: sem match acima do range', () => {
    const r = regra({ campo: 'VALOR', tipoCorrespondencia: 'INTERVALO', valorMin: 100, valorMax: 500 })
    expect(classificarTransacaoSync(tx('CONTA LUZ', '', 600), [r])).toBeNull()
  })

  it('INTERVALO: sem match abaixo do range', () => {
    const r = regra({ campo: 'VALOR', tipoCorrespondencia: 'INTERVALO', valorMin: 100, valorMax: 500 })
    expect(classificarTransacaoSync(tx('CONTA LUZ', '', 50), [r])).toBeNull()
  })
})

describe('classificarTransacaoSync — filtro por tipoTransacao', () => {
  it('regra CREDITO não aplica em DEBIT', () => {
    const r = regra({ tipoCorrespondencia: 'CONTEM', valorCorrespondencia: 'PAGTO', tipoTransacao: 'CREDITO' })
    expect(classificarTransacaoSync(tx('PAGTO FORNECEDOR', '', 100, 'DEBIT'), [r])).toBeNull()
  })

  it('regra DEBITO não aplica em CREDIT', () => {
    const r = regra({ tipoCorrespondencia: 'CONTEM', valorCorrespondencia: 'PAGTO', tipoTransacao: 'DEBITO' })
    expect(classificarTransacaoSync(tx('PAGTO FORNECEDOR', '', 100, 'CREDIT'), [r])).toBeNull()
  })

  it('regra DEBITO aplica em DEBIT', () => {
    const r = regra({ tipoCorrespondencia: 'CONTEM', valorCorrespondencia: 'PAGTO', tipoTransacao: 'DEBITO' })
    expect(classificarTransacaoSync(tx('PAGTO FORNECEDOR', '', 100, 'DEBIT'), [r])).not.toBeNull()
  })

  it('regra QUALQUER aplica em CREDIT e DEBIT', () => {
    const r = regra({ tipoCorrespondencia: 'CONTEM', valorCorrespondencia: 'PAGTO' })
    expect(classificarTransacaoSync(tx('PAGTO', '', 100, 'CREDIT'), [r])).not.toBeNull()
    expect(classificarTransacaoSync(tx('PAGTO', '', 100, 'DEBIT'), [r])).not.toBeNull()
  })
})

describe('classificarTransacaoSync — prioridade e retorno', () => {
  it('aplica a primeira regra que faz match quando há múltiplas', () => {
    const r1 = regra({ id: 'r1', prioridade: 1, tipoCorrespondencia: 'CONTEM', valorCorrespondencia: 'AGUA', contaFinanceiraId: 'conta-agua' })
    const r2 = regra({ id: 'r2', prioridade: 2, tipoCorrespondencia: 'CONTEM', valorCorrespondencia: 'AGUA', contaFinanceiraId: 'conta-outros' })
    const result = classificarTransacaoSync(tx('CONTA AGUA'), [r1, r2])
    expect(result?.contaFinanceiraId).toBe('conta-agua')
    expect(result?.regraId).toBe('r1')
  })

  it('retorna null quando lista de regras está vazia', () => {
    expect(classificarTransacaoSync(tx('QUALQUER'), [])).toBeNull()
  })

  it('retorna null quando nenhuma regra faz match', () => {
    const r = regra({ tipoCorrespondencia: 'CONTEM', valorCorrespondencia: 'XYZ_INEXISTENTE' })
    expect(classificarTransacaoSync(tx('PADARIA'), [r])).toBeNull()
  })

  it('retorna fonte REGRA e confianca 0.9 no match', () => {
    const r = regra({ tipoCorrespondencia: 'CONTEM', valorCorrespondencia: 'FORNECEDOR' })
    const result = classificarTransacaoSync(tx('FORNECEDOR ABC'), [r])
    expect(result?.fonte).toBe('REGRA')
    expect(result?.confianca).toBe(0.9)
    expect(result?.contaFinanceiraId).toBe(CONTA_ID)
  })
})
