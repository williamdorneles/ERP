import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinhasDRE {
  id: string
  nome: string
  valor: number
  valorComp: number
  variacao: number | null
  isTitulo?: boolean
  isTotal?: boolean
  isFinal?: boolean
  isLinha?: boolean
  codigo?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function inicioMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function fimMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function mesAnterior(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1)
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function nivelIndent(codigo?: string): number {
  if (!codigo) return 0
  return (codigo.match(/\./g) || []).length
}

// ─── Variação ─────────────────────────────────────────────────────────────────

function Variacao({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-300 text-xs">—</span>

  const abs = Math.abs(value)
  const label = `${abs.toFixed(1)}%`

  if (Math.abs(value) < 0.5) {
    return (
      <span className="flex items-center gap-1 text-gray-400 text-xs">
        <Minus size={12} />
        {label}
      </span>
    )
  }

  if (value > 0) {
    return (
      <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
        <TrendingUp size={12} />
        +{label}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
      <TrendingDown size={12} />
      -{label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DREPage() {
  const hoje = new Date()
  const [dataInicio, setDataInicio] = useState(isoDate(inicioMes(hoje)))
  const [dataFim, setDataFim] = useState(isoDate(fimMes(hoje)))

  const compInicio = isoDate(inicioMes(mesAnterior(new Date(dataInicio))))
  const compFim = isoDate(fimMes(mesAnterior(new Date(dataInicio))))

  const { data: linhas = [], isLoading, refetch } = useQuery<LinhasDRE[]>({
    queryKey: ['dre', dataInicio, dataFim],
    queryFn: () => {
      const params = new URLSearchParams({
        dataInicio,
        dataFim,
        compDataInicio: compInicio,
        compDataFim: compFim,
      })
      return api.get(`/financeiro/dre?${params}`).then(r => r.data)
    },
    enabled: !!dataInicio && !!dataFim,
  })

  const mesAtualLabel = new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const mesAntLabel = new Date(compInicio + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DRE</h1>
          <p className="text-sm text-gray-500 mt-1">Demonstração do Resultado do Exercício</p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
          title="Atualizar"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Filtros de data */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Data início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Data fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={e => setDataFim(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const d = new Date()
              setDataInicio(isoDate(inicioMes(d)))
              setDataFim(isoDate(fimMes(d)))
            }}
          >
            Mês atual
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const d = mesAnterior(new Date())
              setDataInicio(isoDate(inicioMes(d)))
              setDataFim(isoDate(fimMes(d)))
            }}
          >
            Mês anterior
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const d = new Date()
              setDataInicio(`${d.getFullYear()}-01-01`)
              setDataFim(`${d.getFullYear()}-12-31`)
            }}
          >
            Ano atual
          </Button>
        </div>
      </div>

      {/* Comparativo note */}
      <p className="text-xs text-gray-400">
        Comparativo automático com: <strong className="text-gray-600">{mesAntLabel}</strong>
      </p>

      {/* Tabela DRE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Cabeçalho */}
        <div className="grid grid-cols-[1fr_160px_160px_120px] border-b border-gray-200 px-4 py-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
            {mesAtualLabel}
          </span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
            {mesAntLabel}
          </span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Variação</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Calculando DRE...
          </div>
        ) : linhas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <p className="text-gray-500 font-medium">Nenhum dado disponível</p>
            <p className="text-sm text-gray-400">
              Importe transações e classifique-as para gerar o DRE.
            </p>
          </div>
        ) : (
          <div>
            {linhas.map((linha) => {
              if (linha.isFinal) {
                return (
                  <div
                    key={linha.id}
                    className="grid grid-cols-[1fr_160px_160px_120px] px-4 py-4 bg-gray-900 text-white mt-1"
                  >
                    <span className="font-bold text-sm">{linha.nome}</span>
                    <span className={clsx(
                      'text-right font-bold text-sm',
                      linha.valor >= 0 ? 'text-green-400' : 'text-red-400',
                    )}>
                      {fmt(linha.valor)}
                    </span>
                    <span className={clsx(
                      'text-right font-bold text-sm',
                      linha.valorComp >= 0 ? 'text-green-400' : 'text-red-400',
                    )}>
                      {fmt(linha.valorComp)}
                    </span>
                    <div className="flex justify-end">
                      <Variacao value={linha.variacao} />
                    </div>
                  </div>
                )
              }

              if (linha.isTotal) {
                return (
                  <div
                    key={linha.id}
                    className="grid grid-cols-[1fr_160px_160px_120px] px-4 py-3 bg-gray-100 border-t border-b border-gray-200"
                  >
                    <span className="font-semibold text-sm text-gray-800">{linha.nome}</span>
                    <span className={clsx(
                      'text-right font-semibold text-sm',
                      linha.valor >= 0 ? 'text-gray-800' : 'text-red-600',
                    )}>
                      {fmt(linha.valor)}
                    </span>
                    <span className={clsx(
                      'text-right font-semibold text-sm',
                      linha.valorComp >= 0 ? 'text-gray-800' : 'text-red-600',
                    )}>
                      {fmt(linha.valorComp)}
                    </span>
                    <div className="flex justify-end">
                      <Variacao value={linha.variacao} />
                    </div>
                  </div>
                )
              }

              if (linha.isTitulo) {
                return (
                  <div
                    key={linha.id}
                    className="grid grid-cols-[1fr_160px_160px_120px] px-4 py-2 bg-gray-50 border-t border-gray-100 mt-1"
                  >
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {linha.nome}
                    </span>
                    <span className="text-right text-xs text-gray-400">{linha.valor !== 0 ? fmt(linha.valor) : ''}</span>
                    <span className="text-right text-xs text-gray-400">{linha.valorComp !== 0 ? fmt(linha.valorComp) : ''}</span>
                    <div className="flex justify-end">
                      {linha.variacao !== null && <Variacao value={linha.variacao} />}
                    </div>
                  </div>
                )
              }

              // Linha analítica
              const indent = nivelIndent(linha.codigo)
              return (
                <div
                  key={linha.id}
                  className="grid grid-cols-[1fr_160px_160px_120px] px-4 py-2 border-b border-gray-50 hover:bg-gray-50 transition"
                >
                  <div style={{ paddingLeft: `${indent * 16}px` }} className="flex items-center gap-2">
                    {indent > 0 && <span className="text-gray-200 text-xs">└</span>}
                    <span className="text-xs font-mono text-gray-400 w-20 shrink-0">{linha.codigo}</span>
                    <span className="text-sm text-gray-700">{linha.nome}</span>
                  </div>
                  <span className={clsx(
                    'text-right text-sm',
                    linha.valor > 0 ? 'text-gray-700' : linha.valor < 0 ? 'text-red-600' : 'text-gray-300',
                  )}>
                    {linha.valor !== 0 ? fmt(linha.valor) : '—'}
                  </span>
                  <span className={clsx(
                    'text-right text-sm',
                    linha.valorComp > 0 ? 'text-gray-500' : linha.valorComp < 0 ? 'text-red-400' : 'text-gray-300',
                  )}>
                    {linha.valorComp !== 0 ? fmt(linha.valorComp) : '—'}
                  </span>
                  <div className="flex justify-end">
                    <Variacao value={linha.variacao} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
