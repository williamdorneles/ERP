import { describe, it, expect } from 'vitest'
import { converterQtde, custoPorUnidadeEstoque } from '../modules/nf-entrada/conversao.js'

describe('converterQtde — conversão de unidade de compra → estoque', () => {
  it('MULTIPLICAR: caixa com 12 unidades → 10 cx = 120 un', () => {
    expect(converterQtde(10, 12, 'MULTIPLICAR')).toBe(120)
  })

  it('DIVIDIR: fardo de 6 kg lançado por kg → 30 kg = 5 fardos', () => {
    expect(converterQtde(30, 6, 'DIVIDIR')).toBe(5)
  })

  it('sem operação: quantidade inalterada', () => {
    expect(converterQtde(7, 12, null)).toBe(7)
    expect(converterQtde(7, null, undefined)).toBe(7)
  })

  it('fator ausente ou inválido é tratado como 1', () => {
    expect(converterQtde(10, null, 'MULTIPLICAR')).toBe(10)
    expect(converterQtde(10, 0, 'MULTIPLICAR')).toBe(10)
    expect(converterQtde(10, -3, 'DIVIDIR')).toBe(10)
  })
})

describe('simetria lançar ↔ estornar (regressão do bug de estorno)', () => {
  // O lançamento incrementa o estoque por converterQtde(qtde); o estorno
  // deve decrementar exatamente a mesma quantidade convertida.
  const casos = [
    { qtde: 10, fator: 12, op: 'MULTIPLICAR' as const },
    { qtde: 30, fator: 6, op: 'DIVIDIR' as const },
    { qtde: 8, fator: null, op: null },
    { qtde: 2.5, fator: 4, op: 'MULTIPLICAR' as const },
  ]

  for (const { qtde, fator, op } of casos) {
    it(`qtde=${qtde} fator=${fator} op=${op}: lançado = estornado`, () => {
      const lancado = converterQtde(qtde, fator, op)
      const estornado = converterQtde(qtde, fator, op)
      expect(lancado).toBe(estornado)
    })
  }

  it('estoque volta a zero após lançar e estornar a mesma NF', () => {
    let estoque = 0
    const q = converterQtde(10, 12, 'MULTIPLICAR') // 120
    estoque += q
    expect(estoque).toBe(120)
    estoque -= q
    expect(estoque).toBe(0)
  })
})

describe('custoPorUnidadeEstoque', () => {
  it('valor total dividido pela quantidade de estoque convertida', () => {
    // R$ 240 por 10 cx de 12 un = 120 un → R$ 2,00/un
    expect(custoPorUnidadeEstoque(240, 120, 24)).toBe(2)
  })

  it('cai para valorUnitario quando não há quantidade de estoque', () => {
    expect(custoPorUnidadeEstoque(240, 0, 24)).toBe(24)
  })
})
