import { describe, it, expect } from 'vitest'
import { resolverCfop, destinoPorUF } from '../modules/fiscal/cfop.js'

describe('resolverCfop', () => {
  it('saída: resolve o 1º dígito por destino (5/6/7)', () => {
    expect(resolverCfop('x102', 'SAIDA', 'INTERNO')).toBe('5102')
    expect(resolverCfop('x102', 'SAIDA', 'INTERESTADUAL')).toBe('6102')
    expect(resolverCfop('x102', 'SAIDA', 'EXTERIOR')).toBe('7102')
  })

  it('entrada: resolve o 1º dígito por destino (1/2/3)', () => {
    expect(resolverCfop('x102', 'ENTRADA', 'INTERNO')).toBe('1102')
    expect(resolverCfop('x102', 'ENTRADA', 'INTERESTADUAL')).toBe('2102')
    expect(resolverCfop('x102', 'ENTRADA', 'EXTERIOR')).toBe('3102')
  })

  it('considera só os 3 últimos dígitos (x102, 5102, x5102 dão o mesmo)', () => {
    expect(resolverCfop('5102', 'SAIDA', 'INTERESTADUAL')).toBe('6102')
    expect(resolverCfop('x5102', 'SAIDA', 'INTERNO')).toBe('5102')
    expect(resolverCfop('x910', 'SAIDA', 'INTERNO')).toBe('5910')
  })

  it('base inválida/vazia retorna null', () => {
    expect(resolverCfop('', 'SAIDA', 'INTERNO')).toBeNull()
    expect(resolverCfop(null, 'SAIDA', 'INTERNO')).toBeNull()
    expect(resolverCfop('x9', 'SAIDA', 'INTERNO')).toBeNull()
  })
})

describe('destinoPorUF', () => {
  it('mesma UF é interno, diferente é interestadual', () => {
    expect(destinoPorUF('RS', 'RS')).toBe('INTERNO')
    expect(destinoPorUF('RS', 'SP')).toBe('INTERESTADUAL')
  })

  it('UF de destino EX é exterior', () => {
    expect(destinoPorUF('RS', 'EX')).toBe('EXTERIOR')
  })

  it('sem UF de destino assume interno (consumidor final / NFC-e local)', () => {
    expect(destinoPorUF('RS', null)).toBe('INTERNO')
    expect(destinoPorUF('RS', undefined)).toBe('INTERNO')
  })
})
