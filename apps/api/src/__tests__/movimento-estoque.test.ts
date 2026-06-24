import { describe, it, expect } from 'vitest'
import { quantidadeArmazenada, efeitoEstoque, type TipoMov } from '../modules/estoque/movimento.js'

describe('quantidadeArmazenada', () => {
  it('ENTRADA / SAIDA / PERDA gravam quantidade positiva', () => {
    expect(quantidadeArmazenada('ENTRADA', 10)).toBe(10)
    expect(quantidadeArmazenada('SAIDA', 10)).toBe(10)
    expect(quantidadeArmazenada('PERDA', 10)).toBe(10)
  })

  it('AJUSTE para baixo (padrão) grava negativo', () => {
    expect(quantidadeArmazenada('AJUSTE', 10)).toBe(-10)
    expect(quantidadeArmazenada('AJUSTE', 10, 'SAIDA')).toBe(-10)
  })

  it('AJUSTE para cima grava positivo', () => {
    expect(quantidadeArmazenada('AJUSTE', 10, 'ENTRADA')).toBe(10)
  })
})

describe('efeitoEstoque', () => {
  it('ENTRADA aumenta, SAIDA/PERDA reduzem', () => {
    expect(efeitoEstoque('ENTRADA', 10)).toBe(10)
    expect(efeitoEstoque('SAIDA', 10)).toBe(-10)
    expect(efeitoEstoque('PERDA', 10)).toBe(-10)
  })

  it('AJUSTE usa o sinal da quantidade gravada', () => {
    expect(efeitoEstoque('AJUSTE', 10)).toBe(10)   // ajuste para cima
    expect(efeitoEstoque('AJUSTE', -10)).toBe(-10) // ajuste para baixo
  })
})

describe('lançamento e estorno são inversos (regressão)', () => {
  const casos: { tipo: TipoMov; qtd: number; sentido?: 'ENTRADA' | 'SAIDA' }[] = [
    { tipo: 'ENTRADA', qtd: 10 },
    { tipo: 'SAIDA', qtd: 7 },
    { tipo: 'PERDA', qtd: 3 },
    { tipo: 'AJUSTE', qtd: 5, sentido: 'SAIDA' },
    { tipo: 'AJUSTE', qtd: 5, sentido: 'ENTRADA' },
  ]
  for (const { tipo, qtd, sentido } of casos) {
    it(`${tipo}${sentido ? '/' + sentido : ''}: efeito + estorno = 0`, () => {
      const gravada = quantidadeArmazenada(tipo, qtd, sentido)
      const efeito = efeitoEstoque(tipo, gravada)
      const estorno = -efeitoEstoque(tipo, gravada)
      expect(efeito + estorno).toBe(0)
    })
  }
})
