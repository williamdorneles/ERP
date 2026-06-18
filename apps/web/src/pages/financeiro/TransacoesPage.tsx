import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { api } from '../../lib/api'
import { Select } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContaBancaria {
  id: string
  nome: string
}

interface ContaFinanceira {
  id: string
  codigo: string
  nome: string
}

interface Transacao {
  id: string
  fitid: string
  data: string
  valor: string
  tipo: 'DEBITO' | 'CREDITO'
  descricao: string | null
  nomeOriginal: string | null
  status: 'PENDENTE' | 'SUGERIDO' | 'CLASSIFICADO' | 'REVISADO'
  fonteClassificacao: string | null
  contaBancaria: { id: string; nome: string }
  contaFinanceira: ContaFinanceira | null
}

interface TransacoesResponse {
  dados: Transacao[]
  total: number
  pagina: number
  limite: number
  paginas: number
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
  SUGERIDO: { label: 'Sugerido', color: 'bg-blue-100 text-blue-700' },
  CLASSIFICADO: { label: 'Classificado', color: 'bg-green-100 text-green-700' },
  REVISADO: { label: 'Revisado', color: 'bg-gray-100 text-gray-600' },
}

// ─── Classify Panel ───────────────────────────────────────────────────────────

function ClassificaPanel({
  tx,
  contas,
  onClose,
  onSave,
  loading,
}: {
  tx: Transacao
  contas: ContaFinanceira[]
  onClose: () => void
  onSave: (contaFinanceiraId: string, aplicarSimilares: boolean) => void
  loading: boolean
}) {
  const [busca, setBusca] = useState('')
  const [contaSelecionada, setContaSelecionada] = useState(tx.contaFinanceira?.id ?? '')
  const [aplicarSimilares, setAplicarSimilares] = useState(false)

  const contasFiltradas = busca.trim()
    ? contas.filter(c =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        c.codigo.includes(busca)
      )
    : contas

  return (
    <div className="mt-2 mb-1 mx-2 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-blue-800">Classificar transação</span>
        <button onClick={onClose} className="text-blue-400 hover:text-blue-600">
          <X size={14} />
        </button>
      </div>

      {/* Busca de conta */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar conta..."
          className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Lista de contas */}
      <div className="max-h-40 overflow-y-auto space-y-0.5">
        {contasFiltradas.slice(0, 20).map(conta => (
          <button
            key={conta.id}
            onClick={() => setContaSelecionada(conta.id)}
            className={clsx(
              'w-full text-left px-2 py-1.5 rounded text-xs transition',
              contaSelecionada === conta.id
                ? 'bg-primary-600 text-white'
                : 'hover:bg-white text-gray-700',
            )}
          >
            <span className="font-mono text-gray-400 mr-2">{conta.codigo}</span>
            {conta.nome}
          </button>
        ))}
        {contasFiltradas.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">Nenhuma conta encontrada</p>
        )}
      </div>

      {/* Aplicar similares */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={aplicarSimilares}
          onChange={e => setAplicarSimilares(e.target.checked)}
          className="h-3.5 w-3.5 accent-primary-600"
        />
        <span className="text-xs text-gray-600">Aplicar a transações similares pendentes</span>
      </label>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button
          size="sm"
          disabled={!contaSelecionada}
          loading={loading}
          onClick={() => contaSelecionada && onSave(contaSelecionada, aplicarSimilares)}
        >
          Salvar
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TransacoesPage() {
  const qc = useQueryClient()
  const [statusFiltro, setStatusFiltro] = useState<string>('')
  const [contaBancariaId, setContaBancariaId] = useState('')
  const [pagina, setPagina] = useState(1)
  const [classificandoId, setClassificandoId] = useState<string | null>(null)

  const { data: contasBancarias = [] } = useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias'],
    queryFn: () => api.get('/financeiro/contas-bancarias').then(r => r.data),
  })

  const { data: contas = [] } = useQuery<ContaFinanceira[]>({
    queryKey: ['contas-flat'],
    queryFn: () => api.get('/financeiro/contas').then(r => r.data),
  })

  const { data, isLoading } = useQuery<TransacoesResponse>({
    queryKey: ['transacoes', statusFiltro, contaBancariaId, pagina],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFiltro) params.set('status', statusFiltro)
      if (contaBancariaId) params.set('contaBancariaId', contaBancariaId)
      params.set('pagina', String(pagina))
      params.set('limite', '50')
      return api.get(`/financeiro/transacoes?${params}`).then(r => r.data)
    },
  })

  const aprovarMutation = useMutation({
    mutationFn: (id: string) => api.put(`/financeiro/transacoes/${id}/aprovar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transacoes'] }),
  })

  const classificarMutation = useMutation({
    mutationFn: ({ id, contaFinanceiraId, aplicarSimilares }: { id: string; contaFinanceiraId: string; aplicarSimilares: boolean }) =>
      api.put(`/financeiro/transacoes/${id}/classificar`, { contaFinanceiraId, aplicarSimilares }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transacoes'] })
      setClassificandoId(null)
    },
  })

  const aprovarLoteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/financeiro/transacoes/aprovar-lote', { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transacoes'] }),
  })

  const transacoes = data?.dados ?? []
  const sugestoes = transacoes.filter(t => t.status === 'SUGERIDO')

  const fmt = (v: string | number) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  const statusPills = [
    { value: '', label: 'Todas' },
    { value: 'PENDENTE', label: 'Pendente' },
    { value: 'SUGERIDO', label: 'Sugerido' },
    { value: 'CLASSIFICADO', label: 'Classificado' },
    { value: 'REVISADO', label: 'Revisado' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transações</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data ? `${data.total} transações encontradas` : 'Carregando...'}
          </p>
        </div>
        {sugestoes.length > 0 && (
          <Button
            variant="secondary"
            loading={aprovarLoteMutation.isPending}
            onClick={() => aprovarLoteMutation.mutate(sugestoes.map(t => t.id))}
          >
            <CheckCircle size={16} className="text-green-500" />
            Aprovar {sugestoes.length} sugestão{sugestoes.length > 1 ? 'ões' : ''}
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-4">
        {/* Status pills */}
        <div className="flex gap-1.5 flex-wrap">
          {statusPills.map(pill => (
            <button
              key={pill.value}
              onClick={() => { setStatusFiltro(pill.value); setPagina(1) }}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-medium transition',
                statusFiltro === pill.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Conta bancária */}
        <div className="w-52">
          <Select
            value={contaBancariaId}
            onChange={e => { setContaBancariaId(e.target.value); setPagina(1) }}
          >
            <option value="">Todas as contas</option>
            {contasBancarias.map(cb => (
              <option key={cb.id} value={cb.id}>{cb.nome}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Carregando transações...
          </div>
        ) : transacoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-gray-500 font-medium">Nenhuma transação encontrada</p>
            <p className="text-sm text-gray-400">Importe um arquivo OFX para começar.</p>
          </div>
        ) : (
          <div>
            {/* Header da tabela */}
            <div className="grid grid-cols-[120px_1fr_130px_1fr_120px_80px] gap-3 px-4 py-2 border-b border-gray-100 text-xs text-gray-400 font-medium">
              <span>Data</span>
              <span>Descrição</span>
              <span className="text-right">Valor</span>
              <span>Conta</span>
              <span className="text-center">Status</span>
              <span className="text-center">Ações</span>
            </div>

            {transacoes.map(tx => (
              <div key={tx.id}>
                <div className={clsx(
                  'grid grid-cols-[120px_1fr_130px_1fr_120px_80px] gap-3 px-4 py-3 items-center border-b border-gray-50 hover:bg-gray-50 transition',
                  tx.status === 'REVISADO' && 'opacity-60',
                )}>
                  {/* Data */}
                  <span className="text-sm text-gray-500">{fmtDate(tx.data)}</span>

                  {/* Descrição */}
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{tx.descricao || tx.nomeOriginal || '—'}</p>
                    <p className="text-xs text-gray-400 truncate">{tx.contaBancaria.nome}</p>
                  </div>

                  {/* Valor */}
                  <span className={clsx(
                    'text-sm font-medium text-right tabular-nums',
                    tx.tipo === 'CREDITO' ? 'text-green-600' : 'text-red-600',
                  )}>
                    {tx.tipo === 'CREDITO' ? '+' : '-'}{fmt(tx.valor)}
                  </span>

                  {/* Conta classificada */}
                  <div className="min-w-0">
                    {tx.contaFinanceira ? (
                      <div>
                        <p className="text-xs font-medium text-gray-700 truncate">{tx.contaFinanceira.nome}</p>
                        <p className="text-xs text-gray-400">{tx.contaFinanceira.codigo}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">Não classificada</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="text-center">
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      STATUS_CONFIG[tx.status].color,
                    )}>
                      {STATUS_CONFIG[tx.status].label}
                    </span>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-center gap-1">
                    {tx.status === 'SUGERIDO' && (
                      <button
                        onClick={() => aprovarMutation.mutate(tx.id)}
                        title="Aprovar sugestão"
                        className="p-1.5 rounded-lg hover:bg-green-50 text-green-500 transition"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {tx.status !== 'REVISADO' && (
                      <button
                        onClick={() => setClassificandoId(classificandoId === tx.id ? null : tx.id)}
                        title="Classificar"
                        className={clsx(
                          'p-1.5 rounded-lg transition text-xs font-medium',
                          classificandoId === tx.id
                            ? 'bg-blue-100 text-blue-700'
                            : 'hover:bg-gray-100 text-gray-500',
                        )}
                      >
                        <Search size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Painel de classificação inline */}
                {classificandoId === tx.id && (
                  <ClassificaPanel
                    tx={tx}
                    contas={contas}
                    onClose={() => setClassificandoId(null)}
                    onSave={(contaFinanceiraId, aplicarSimilares) =>
                      classificarMutation.mutate({ id: tx.id, contaFinanceiraId, aplicarSimilares })
                    }
                    loading={classificarMutation.isPending}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paginação */}
      {data && data.paginas > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Página {data.pagina} de {data.paginas} · {data.total} transações
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagina <= 1}
              onClick={() => setPagina(p => p - 1)}
            >
              <ChevronLeft size={16} />
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagina >= data.paginas}
              onClick={() => setPagina(p => p + 1)}
            >
              Próxima
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
