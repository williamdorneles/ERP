import { describe, it, expect } from 'vitest'
import { selecionarAutoConciliacoes, type TransacaoComSugestoes } from '@erp/shared'

function tx(over: Partial<TransacaoComSugestoes> & { id: string }): TransacaoComSugestoes {
  return {
    tipo: 'DEBITO', valor: 100, nomeOriginal: 'FORN', descricao: null, sugestoes: [],
    ...over,
  }
}
const sug = (parcelaId: string, score: number, valor = 100, diffValor = 0) =>
  ({ parcelaId, tituloDescricao: 'T', valor, diffValor, score })

describe('selecionarAutoConciliacoes', () => {
  it('inclui match ALTA inequívoco e exato', () => {
    const r = selecionarAutoConciliacoes([tx({ id: 't1', sugestoes: [sug('p1', 180)] })])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ transacaoId: 't1', parcelaId: 'p1', confianca: 'ALTA', parcial: false, sobrepago: false })
  })

  it('inclui MEDIA (≥80) por padrão', () => {
    const r = selecionarAutoConciliacoes([tx({ id: 't1', sugestoes: [sug('p1', 100)] })])
    expect(r).toHaveLength(1)
    expect(r[0].confianca).toBe('MEDIA')
  })

  it('exclui score abaixo do mínimo (BAIXA)', () => {
    const r = selecionarAutoConciliacoes([tx({ id: 't1', sugestoes: [sug('p1', 50)] })])
    expect(r).toHaveLength(0)
  })

  it('respeita scoreMinimo customizado (só ALTA)', () => {
    const r = selecionarAutoConciliacoes([tx({ id: 't1', sugestoes: [sug('p1', 100)] })], { scoreMinimo: 150 })
    expect(r).toHaveLength(0)
  })

  it('exclui match ambíguo (2º próximo do melhor)', () => {
    const r = selecionarAutoConciliacoes([tx({ id: 't1', sugestoes: [sug('p1', 100), sug('p2', 90)] })])
    expect(r).toHaveLength(0)
  })

  it('aceita quando o melhor vence o 2º pela margem', () => {
    const r = selecionarAutoConciliacoes([tx({ id: 't1', sugestoes: [sug('p1', 160), sug('p2', 100)] })])
    expect(r).toHaveLength(1)
    expect(r[0].parcelaId).toBe('p1')
  })

  it('unicidade de parcela: duas transações na mesma parcela → mantém a de maior score', () => {
    const r = selecionarAutoConciliacoes([
      tx({ id: 't1', sugestoes: [sug('p1', 160)] }),
      tx({ id: 't2', sugestoes: [sug('p1', 180)] }),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].transacaoId).toBe('t2')
  })

  it('sinaliza baixa parcial (tx menor que a parcela)', () => {
    const r = selecionarAutoConciliacoes([tx({ id: 't1', valor: 90, sugestoes: [sug('p1', 160, 100, -10)] })])
    expect(r[0]).toMatchObject({ parcial: true, sobrepago: false })
  })

  it('sinaliza sobrepagamento (tx maior que a parcela)', () => {
    const r = selecionarAutoConciliacoes([tx({ id: 't1', valor: 110, sugestoes: [sug('p1', 160, 100, 10)] })])
    expect(r[0]).toMatchObject({ parcial: false, sobrepago: true })
  })

  it('ignora transações sem sugestões', () => {
    const r = selecionarAutoConciliacoes([tx({ id: 't1', sugestoes: [] })])
    expect(r).toHaveLength(0)
  })
})
