import { describe, it, expect } from 'vitest'
import { calcularSaldoBaixa, statusTituloPorParcelas, montarLinhasEncargo, somaEncargos } from '../modules/financeiro/baixa.js'

describe('calcularSaldoBaixa — baixa total vs parcial', () => {
  it('pagamento igual à parcela → baixa total, sem saldo', () => {
    expect(calcularSaldoBaixa(100, 100)).toEqual({ restante: 0, isParcial: false })
  })

  it('pagamento menor → baixa parcial com saldo restante', () => {
    expect(calcularSaldoBaixa(100, 60)).toEqual({ restante: 40, isParcial: true })
  })

  it('pagamento maior (sobrepagamento) → baixa total, sem saldo negativo', () => {
    expect(calcularSaldoBaixa(100, 130)).toEqual({ restante: 0, isParcial: false })
  })

  it('diferença de centavos dentro da tolerância → baixa total', () => {
    // R$ 0,004 de diferença não gera parcela residual
    expect(calcularSaldoBaixa(100, 99.996)).toEqual({ restante: 0, isParcial: false })
  })

  it('diferença de 1 centavo → baixa parcial', () => {
    expect(calcularSaldoBaixa(100, 99.99)).toEqual({ restante: 0.01, isParcial: true })
  })

  it('arredonda o saldo para 2 casas', () => {
    const r = calcularSaldoBaixa(100.5, 33.33)
    expect(r.isParcial).toBe(true)
    expect(r.restante).toBe(67.17)
  })
})

describe('statusTituloPorParcelas', () => {
  it('todas abertas → ABERTO', () => {
    expect(statusTituloPorParcelas(['ABERTO', 'ABERTO'])).toBe('ABERTO')
  })

  it('todas quitadas → QUITADO', () => {
    expect(statusTituloPorParcelas(['QUITADO', 'QUITADO'])).toBe('QUITADO')
  })

  it('mistura aberta + quitada → PARCIAL', () => {
    expect(statusTituloPorParcelas(['QUITADO', 'ABERTO'])).toBe('PARCIAL')
  })

  it('todas canceladas → CANCELADO', () => {
    expect(statusTituloPorParcelas(['CANCELADO', 'CANCELADO'])).toBe('CANCELADO')
  })

  it('quitada + cancelada (sem abertas) → QUITADO', () => {
    expect(statusTituloPorParcelas(['QUITADO', 'CANCELADO'])).toBe('QUITADO')
  })

  it('aberta + cancelada (sem quitadas) → ABERTO', () => {
    expect(statusTituloPorParcelas(['ABERTO', 'CANCELADO'])).toBe('ABERTO')
  })
})

describe('montarLinhasEncargo / somaEncargos', () => {
  it('PAGAR com tarifa e juros → duas linhas nas contas de pagamento', () => {
    const linhas = montarLinhasEncargo('PAGAR', { tarifa: 2, juros: 5 })
    expect(linhas).toEqual([
      { chaveConta: 'CONTA_TARIFA_BANCARIA', valor: 2 },
      { chaveConta: 'CONTA_JUROS_PAGOS', valor: 5 },
    ])
    expect(somaEncargos(linhas)).toBe(7)
  })

  it('PAGAR soma juros + multa numa única linha de juros', () => {
    const linhas = montarLinhasEncargo('PAGAR', { juros: 3, multa: 1.5 })
    expect(linhas).toEqual([{ chaveConta: 'CONTA_JUROS_PAGOS', valor: 4.5 }])
  })

  it('RECEBER usa a conta de juros recebidos e ignora tarifa', () => {
    const linhas = montarLinhasEncargo('RECEBER', { tarifa: 2, juros: 5 })
    expect(linhas).toEqual([{ chaveConta: 'CONTA_JUROS_RECEBIDOS', valor: 5 }])
  })

  it('sem encargos → nenhuma linha', () => {
    expect(montarLinhasEncargo('PAGAR', {})).toEqual([])
    expect(somaEncargos([])).toBe(0)
  })

  it('valores zerados não geram linha', () => {
    expect(montarLinhasEncargo('PAGAR', { tarifa: 0, juros: 0, multa: 0 })).toEqual([])
  })
})
