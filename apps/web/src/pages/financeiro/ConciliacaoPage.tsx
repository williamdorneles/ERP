import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, AlertTriangle, ChevronRight,
  TrendingDown, TrendingUp, ArrowLeftRight, Search,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../lib/api'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ContaBancaria { id: string; nome: string; isCaixa: boolean }

interface Sugestao {
  parcelaId: string
  numero: number
  tituloId: string
  tituloDescricao: string
  pessoaId: string | null
  pessoaNome: string | null
  valor: number
  vencimento: string
  diffValor: number
  diffDias: number
  score: number
}

interface Transacao {
  id: string
  data: string
  valor: number
  tipo: 'DEBITO' | 'CREDITO'
  descricao: string | null
  nomeOriginal: string | null
  status: string
  fonteClassificacao: string | null
  contaFinanceira: { id: string; codigo: string; nome: string } | null
  sugestoes: Sugestao[]
  melhorScore: number
  confianca: 'ALTA' | 'MEDIA' | 'BAIXA' | null
}

interface ConciliacaoData {
  conta: ContaBancaria
  transacoes: Transacao[]
  stats: { total: number; debitos: number; creditos: number; comSugestaoAlta: number }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (s: string) => new Date(s + (s.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR')

const CONFIANCA_CONFIG = {
  ALTA:  { label: 'Alta', color: 'bg-green-100 text-green-700 border-green-200' },
  MEDIA: { label: 'Média', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  BAIXA: { label: 'Baixa', color: 'bg-gray-100 text-gray-500 border-gray-200' },
}

function defaultInicio() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}
function defaultFim() {
  return new Date().toISOString().split('T')[0]
}

// ── Painel de Sugestões ────────────────────────────────────────────────────────

function PainelSugestoes({
  tx, onConfirmar, confirmando,
}: {
  tx: Transacao
  onConfirmar: (transacaoId: string, parcelaId: string) => void
  confirmando: string | null
}) {
  const isDeb = tx.tipo === 'DEBITO'

  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho da transação selecionada */}
      <div className={clsx(
        'p-4 rounded-xl border mb-4',
        isDeb ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100',
      )}>
        <div className="flex items-center gap-3">
          <div className={clsx('p-2 rounded-lg', isDeb ? 'bg-red-100' : 'bg-green-100')}>
            {isDeb
              ? <TrendingDown size={18} className="text-red-600" />
              : <TrendingUp size={18} className="text-green-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {tx.nomeOriginal || tx.descricao || '—'}
            </p>
            <p className="text-sm text-gray-500">{fmtDate(tx.data)}</p>
          </div>
          <p className={clsx('text-xl font-bold', isDeb ? 'text-red-700' : 'text-green-700')}>
            {isDeb ? '-' : '+'}{fmt(tx.valor)}
          </p>
        </div>
        {tx.contaFinanceira && (
          <p className="text-xs text-gray-500 mt-2 pl-11">
            Conta: {tx.contaFinanceira.codigo} — {tx.contaFinanceira.nome}
          </p>
        )}
      </div>

      {/* Sugestões */}
      <p className="text-sm font-medium text-gray-700 mb-3">
        {tx.sugestoes.length === 0
          ? 'Sem sugestões de conciliação'
          : `${tx.sugestoes.length} parcela(s) candidata(s) — confirme a correspondência:`}
      </p>

      {tx.sugestoes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed rounded-xl p-6">
          <Search size={32} className="mb-2 opacity-30" />
          <p className="text-sm font-medium">Nenhuma parcela encontrada</p>
          <p className="text-xs mt-1 text-center">
            Verifique se existe um título a {isDeb ? 'pagar' : 'receber'} com valor e vencimento próximos
          </p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {tx.sugestoes.map((s, i) => {
            const conf = s.score >= 150 ? 'ALTA' : s.score >= 80 ? 'MEDIA' : 'BAIXA'
            const isConfirmando = confirmando === `${tx.id}-${s.parcelaId}`
            return (
              <div
                key={s.parcelaId}
                className={clsx(
                  'border rounded-xl p-4 transition',
                  i === 0 && s.score >= 150
                    ? 'border-green-300 bg-green-50/50 ring-1 ring-green-200'
                    : 'border-gray-200 bg-white hover:border-gray-300',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full border font-medium',
                        CONFIANCA_CONFIG[conf].color,
                      )}>
                        {CONFIANCA_CONFIG[conf].label} · {s.score}pts
                      </span>
                      {i === 0 && s.score >= 150 && (
                        <span className="text-xs text-green-600 font-medium">Melhor match</span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 text-sm truncate">{s.tituloDescricao}</p>
                    {s.pessoaNome && (
                      <p className="text-xs text-gray-500">{s.pessoaNome}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>
                        Parcela {s.numero} · Venc. {fmtDate(s.vencimento)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">{fmt(s.valor)}</p>
                    {/* Diferença de valor */}
                    {Math.abs(s.diffValor) > 0.01 && (
                      <p className={clsx(
                        'text-xs mt-0.5',
                        Math.abs(s.diffValor / s.valor) <= 0.02 ? 'text-amber-600' : 'text-red-500',
                      )}>
                        {s.diffValor > 0 ? '+' : ''}{fmt(s.diffValor)}
                      </p>
                    )}
                    {/* Diferença de dias */}
                    <p className={clsx(
                      'text-xs mt-0.5',
                      Math.abs(s.diffDias) <= 3 ? 'text-green-600'
                        : Math.abs(s.diffDias) <= 7 ? 'text-amber-600' : 'text-gray-400',
                    )}>
                      {s.diffDias === 0 ? 'Mesmo dia'
                        : s.diffDias > 0 ? `+${s.diffDias}d` : `${s.diffDias}d`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onConfirmar(tx.id, s.parcelaId)}
                  disabled={!!confirmando}
                  className={clsx(
                    'mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg font-medium transition disabled:opacity-50',
                    i === 0 && s.score >= 150
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
                  )}
                >
                  <CheckCircle2 size={15} />
                  {isConfirmando ? 'Conciliando...' : 'Confirmar conciliação'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Linha da transação ─────────────────────────────────────────────────────────

function TxRow({
  tx, selected, onClick,
}: { tx: Transacao; selected: boolean; onClick: () => void }) {
  const isDeb = tx.tipo === 'DEBITO'
  const conf = tx.confianca

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left px-4 py-3 border-b last:border-b-0 transition hover:bg-gray-50',
        selected && 'bg-primary-50 border-l-4 border-l-primary-500',
        !selected && 'border-l-4 border-l-transparent',
      )}
    >
      <div className="flex items-center gap-3">
        <div className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isDeb ? 'bg-red-100' : 'bg-green-100',
        )}>
          {isDeb
            ? <TrendingDown size={14} className="text-red-600" />
            : <TrendingUp size={14} className="text-green-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {tx.nomeOriginal || tx.descricao || '—'}
          </p>
          <p className="text-xs text-gray-400">{fmtDate(tx.data)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <p className={clsx('text-sm font-semibold', isDeb ? 'text-red-700' : 'text-green-700')}>
            {fmt(tx.valor)}
          </p>
          {conf && (
            <span className={clsx(
              'text-xs px-1.5 py-0.5 rounded-full border',
              CONFIANCA_CONFIG[conf].color,
            )}>
              {CONFIANCA_CONFIG[conf].label}
            </span>
          )}
          {!conf && tx.sugestoes.length === 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full border border-gray-100 text-gray-400 bg-gray-50">
              Sem match
            </span>
          )}
          <ChevronRight size={14} className="text-gray-300" />
        </div>
      </div>
    </button>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────

export function ConciliacaoPage() {
  const qc = useQueryClient()
  const [contaId, setContaId] = useState('')
  const [dataInicio, setDataInicio] = useState(defaultInicio)
  const [dataFim, setDataFim] = useState(defaultFim)
  const [txSelecionada, setTxSelecionada] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [filtroConfianca, setFiltroConfianca] = useState<string>('TODAS')

  const { data: contas } = useQuery<{ dados: ContaBancaria[] }>({
    queryKey: ['contas-bancarias-lista'],
    queryFn: () => api.get('/financeiro/contas-bancarias').then(r => r.data),
  })

  const { data, isLoading, refetch } = useQuery<ConciliacaoData>({
    queryKey: ['conciliacao', contaId, dataInicio, dataFim],
    queryFn: () => api.get(`/conciliacao/${contaId}?dataInicio=${dataInicio}&dataFim=${dataFim}`).then(r => r.data),
    enabled: !!contaId,
  })

  const confirmar = useMutation({
    mutationFn: ({ transacaoId, parcelaId }: { transacaoId: string; parcelaId: string }) =>
      api.post('/conciliacao/confirmar', { transacaoId, parcelaId }),
    onSuccess: (_r, vars) => {
      setConfirmando(null)
      // Remove a transação da lista localmente e limpa seleção se era a selecionada
      if (txSelecionada === vars.transacaoId) setTxSelecionada(null)
      qc.invalidateQueries({ queryKey: ['conciliacao'] })
      qc.invalidateQueries({ queryKey: ['titulos'] })
      qc.invalidateQueries({ queryKey: ['titulos-resumo'] })
    },
    onError: () => setConfirmando(null),
  })

  function handleConfirmar(transacaoId: string, parcelaId: string) {
    setConfirmando(`${transacaoId}-${parcelaId}`)
    confirmar.mutate({ transacaoId, parcelaId })
  }

  const transacoes = useMemo(() => {
    const list = data?.transacoes ?? []
    let filtered = list
    if (busca.trim()) {
      const q = busca.toLowerCase()
      filtered = filtered.filter(t =>
        t.nomeOriginal?.toLowerCase().includes(q) ||
        t.descricao?.toLowerCase().includes(q)
      )
    }
    if (filtroConfianca === 'ALTA') filtered = filtered.filter(t => t.confianca === 'ALTA')
    if (filtroConfianca === 'SEM') filtered = filtered.filter(t => t.sugestoes.length === 0)
    return filtered
  }, [data, busca, filtroConfianca])

  const txAtual = transacoes.find(t => t.id === txSelecionada) ?? transacoes[0] ?? null

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conciliação Bancária</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Compare o extrato bancário com os títulos a pagar/receber e confirme as correspondências
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 bg-white border rounded-xl p-4">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">Conta Bancária</label>
          <select
            value={contaId}
            onChange={e => { setContaId(e.target.value); setTxSelecionada(null) }}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">— Selecionar —</option>
            {(contas?.dados ?? []).map(c => (
              <option key={c.id} value={c.id}>{c.nome}{c.isCaixa ? ' (Caixa)' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
          <div className="flex items-center gap-2">
            <input type="date" value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            <span className="text-gray-400 text-sm">até</span>
            <input type="date" value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={!contaId || isLoading}
          className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
        >
          {isLoading ? 'Carregando...' : 'Buscar'}
        </button>
      </div>

      {/* Stats bar */}
      {data && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'A conciliar', value: data.stats.total, color: 'text-gray-900' },
            { label: 'Débitos', value: data.stats.debitos, color: 'text-red-700' },
            { label: 'Créditos', value: data.stats.creditos, color: 'text-green-700' },
            { label: 'Match automático', value: data.stats.comSugestaoAlta, color: 'text-primary-700' },
          ].map(s => (
            <div key={s.label} className="bg-white border rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={clsx('text-2xl font-bold mt-0.5', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Layout dividido */}
      {!contaId ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 border-2 border-dashed rounded-xl py-16">
          <div className="text-center">
            <ArrowLeftRight size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Selecione uma conta bancária para iniciar</p>
          </div>
        </div>
      ) : data && data.transacoes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 border-2 border-dashed rounded-xl py-16">
          <div className="text-center">
            <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30 text-green-400" />
            <p className="font-medium text-green-600">Tudo conciliado!</p>
            <p className="text-sm mt-1">Não há transações pendentes de conciliação neste período</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0" style={{ minHeight: 500 }}>
          {/* Coluna esquerda — lista de transações */}
          <div className="w-2/5 flex flex-col bg-white border rounded-xl overflow-hidden">
            {/* Sub-filtros */}
            <div className="p-3 border-b space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Buscar transação..." value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
              <div className="flex gap-1.5">
                {[
                  { key: 'TODAS', label: 'Todas' },
                  { key: 'ALTA', label: 'Alta confiança' },
                  { key: 'SEM', label: 'Sem sugestão' },
                ].map(f => (
                  <button key={f.key}
                    onClick={() => setFiltroConfianca(f.key)}
                    className={clsx(
                      'px-2.5 py-1 text-xs rounded-full font-medium transition',
                      filtroConfianca === f.key
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    )}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {transacoes.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Nenhuma transação encontrada</p>
              ) : (
                transacoes.map(tx => (
                  <TxRow
                    key={tx.id}
                    tx={tx}
                    selected={tx.id === (txAtual?.id ?? null)}
                    onClick={() => setTxSelecionada(tx.id)}
                  />
                ))
              )}
            </div>

            <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
              {transacoes.length} transação(ões) · clique para ver sugestões
            </div>
          </div>

          {/* Coluna direita — sugestões */}
          <div className="flex-1 bg-white border rounded-xl p-4 overflow-y-auto">
            {txAtual ? (
              <PainelSugestoes
                tx={txAtual}
                onConfirmar={handleConfirmar}
                confirmando={confirmando}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Selecione uma transação para ver as sugestões</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
