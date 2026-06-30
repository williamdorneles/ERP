import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  Plus, ArrowLeft, ArrowUp, Pencil, Eye, Ban, Trash2, Boxes, Wallet, RotateCcw,
  MoreHorizontal, FileText, Printer, Receipt, Search, X,
} from 'lucide-react'
import clsx from 'clsx'
import { PedidoVendaForm } from '../../components/forms/PedidoVendaForm'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

const TODOS_STATUS = ['ABERTO', 'CONFIRMADO', 'EM_PREPARO', 'ENTREGUE', 'CANCELADO'] as const
type StatusPedido = typeof TODOS_STATUS[number]

interface NotaResumida { id: string; modelo: string; status: string; numero: number }
interface PedidoVenda {
  id: string; numero: string; status: string
  total: number; formaPagamento: string; criadoEm: string; dataEmissao?: string
  estoqueElancado: boolean; financeiroLancado: boolean
  pessoa?: { nome: string }
  notasFiscais: NotaResumida[]
}

const statusCor: Record<string, string> = {
  ABERTO: 'bg-blue-100 text-blue-700',
  CONFIRMADO: 'bg-cyan-100 text-cyan-700',
  EM_PREPARO: 'bg-amber-100 text-amber-700',
  ENTREGUE: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-red-100 text-red-700',
}

// ── Item do menu de ações ────────────────────────────────────────────────────
function MenuItem({
  icon, label, onClick, disabled, hint, danger,
}: {
  icon: React.ReactNode; label: string; onClick?: () => void
  disabled?: boolean; hint?: string; danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={hint}
      className={clsx(
        'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition text-left',
        disabled
          ? 'text-gray-300 cursor-not-allowed'
          : danger
            ? 'text-red-600 hover:bg-red-50'
            : 'text-gray-700 hover:bg-gray-50',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
    </button>
  )
}

// ── Menu de ações da linha do pedido ─────────────────────────────────────────
function AcoesMenu({
  pedido, busy,
  onLancarEstoque, onEstornarEstoque, onLancarFinanceiro, onEstornarFinanceiro,
  onGerarNFe, onEditar, onCancelar, onExcluir,
}: {
  pedido: PedidoVenda
  busy: boolean
  onLancarEstoque: () => void
  onEstornarEstoque: () => void
  onLancarFinanceiro: () => void
  onEstornarFinanceiro: () => void
  onGerarNFe: () => void
  onEditar: () => void
  onCancelar: () => void
  onExcluir: () => void
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function abrir() {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      // Abre alinhado à direita do botão; menu tem ~256px de largura
      setCoords({ top: r.bottom + 6, left: Math.max(8, r.right - 256) })
    }
    setOpen(v => !v)
  }

  const cancelado = pedido.status === 'CANCELADO'
  const temLancamento = pedido.estoqueElancado || pedido.financeiroLancado
  const wrap = (fn: () => void) => () => { setOpen(false); fn() }

  return (
    <>
      <button
        ref={btnRef}
        onClick={abrir}
        disabled={busy}
        title="Ações"
        className={clsx(
          'p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition',
          open && 'bg-gray-100 text-gray-700',
        )}
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: 256, zIndex: 50 }}
          className="rounded-xl border border-gray-200 bg-white shadow-xl py-1.5"
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100 mb-1">
            Nº {pedido.numero.padStart(6, '0')} — {pedido.pessoa?.nome ?? 'Consumidor Final'}
          </div>

          {/* Estoque */}
          {pedido.estoqueElancado ? (
            <MenuItem icon={<RotateCcw size={15} className="text-amber-500" />} label="Estornar estoque" onClick={wrap(onEstornarEstoque)} />
          ) : (
            <MenuItem icon={<Boxes size={15} className="text-blue-600" />} label="Lançar estoque" onClick={wrap(onLancarEstoque)} disabled={cancelado} />
          )}

          {/* Financeiro */}
          {pedido.financeiroLancado ? (
            <MenuItem icon={<RotateCcw size={15} className="text-amber-500" />} label="Estornar contas" onClick={wrap(onEstornarFinanceiro)} />
          ) : (
            <MenuItem icon={<Wallet size={15} className="text-green-600" />} label="Lançar contas" onClick={wrap(onLancarFinanceiro)} disabled={cancelado} />
          )}

          <div className="my-1 border-t border-gray-100" />

          {/* Fiscal */}
          <MenuItem icon={<FileText size={15} className="text-indigo-600" />} label="Gerar NF-e" onClick={wrap(onGerarNFe)} disabled={cancelado} />
          <MenuItem icon={<FileText size={15} className="text-gray-400" />} label="Gerar NFC-e" disabled hint="em breve" />
          <MenuItem icon={<Printer size={15} className="text-gray-400" />} label="Imprimir" disabled hint="em breve" />

          <div className="my-1 border-t border-gray-100" />

          {/* Gestão */}
          <MenuItem
            icon={temLancamento ? <Eye size={15} className="text-gray-500" /> : <Pencil size={15} className="text-gray-500" />}
            label={temLancamento ? 'Visualizar' : 'Editar'}
            onClick={wrap(onEditar)}
          />
          {!cancelado && (
            <MenuItem icon={<Ban size={15} className="text-amber-600" />} label="Cancelar pedido" onClick={wrap(onCancelar)} />
          )}
          {!temLancamento && (
            <MenuItem icon={<Trash2 size={15} />} label="Excluir" onClick={wrap(onExcluir)} danger />
          )}
        </div>
      )}
    </>
  )
}

export function PedidosVendaPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [panelOpen, setPanelOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editNumero, setEditNumero] = useState<string | null>(null)
  const [editReadOnly, setEditReadOnly] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState<PedidoVenda | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState<PedidoVenda | null>(null)
  const [confirmEstornoEstoque, setConfirmEstornoEstoque] = useState<PedidoVenda | null>(null)
  const [confirmEstornoFinanceiro, setConfirmEstornoFinanceiro] = useState<PedidoVenda | null>(null)
  const [erro, setErro] = useState('')

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<Set<StatusPedido>>(new Set())

  function mesAtual() {
    const hoje = new Date()
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10)
    return { ini, fim }
  }
  const [dataInicio, setDataInicio] = useState(() => mesAtual().ini)
  const [dataFim, setDataFim] = useState(() => mesAtual().fim)

  function toggleStatus(s: StatusPedido) {
    setStatusFiltro(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  function limparFiltros() {
    setBusca('')
    setStatusFiltro(new Set())
    const { ini, fim } = mesAtual()
    setDataInicio(ini)
    setDataFim(fim)
  }

  const { data: pedidos = [], isLoading } = useQuery<PedidoVenda[]>({
    queryKey: ['pedidos-venda'],
    queryFn: () => api.get('/vendas/pedidos').then(r => r.data),
  })

  const pedidosFiltrados = pedidos.filter(p => {
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      const matchNum = p.numero.padStart(6, '0').includes(q)
      const matchCliente = (p.pessoa?.nome ?? 'consumidor final').toLowerCase().includes(q)
      if (!matchNum && !matchCliente) return false
    }
    if (statusFiltro.size > 0 && !statusFiltro.has(p.status as StatusPedido)) return false
    if (dataInicio || dataFim) {
      const data = new Date(p.dataEmissao ?? p.criadoEm).toISOString().slice(0, 10)
      if (dataInicio && data < dataInicio) return false
      if (dataFim && data > dataFim) return false
    }
    return true
  })

  const { ini: iniPadrao, fim: fimPadrao } = mesAtual()
  const filtroAtivo = busca.trim() !== '' || statusFiltro.size > 0 || dataInicio !== iniPadrao || dataFim !== fimPadrao

  const cancelarMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/vendas/pedidos/${id}/status`, { status: 'CANCELADO' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] }); setConfirmCancel(null) },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      setErro(e.response?.data?.error ?? 'Erro ao cancelar.'); setConfirmCancel(null)
    },
  })

  const excluirMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vendas/pedidos/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] }); setConfirmExcluir(null); setErro('') },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      setErro(e.response?.data?.error ?? 'Erro ao excluir.'); setConfirmExcluir(null)
    },
  })

  const lancarEstoqueMutation = useMutation({
    mutationFn: (id: string) => api.post(`/vendas/pedidos/${id}/lancar-estoque`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] }); setErro('') },
    onError: (e: { response?: { data?: { error?: string } } }) => setErro(e.response?.data?.error ?? 'Erro ao lançar estoque.'),
  })

  const estornarEstoqueMutation = useMutation({
    mutationFn: (id: string) => api.post(`/vendas/pedidos/${id}/estornar-estoque`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] }); setConfirmEstornoEstoque(null); setErro('') },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      setErro(e.response?.data?.error ?? 'Erro ao estornar estoque.'); setConfirmEstornoEstoque(null)
    },
  })

  const lancarFinanceiroMutation = useMutation({
    mutationFn: (id: string) => api.post(`/vendas/pedidos/${id}/lancar-financeiro`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] }); setErro('') },
    onError: (e: { response?: { data?: { error?: string } } }) => setErro(e.response?.data?.error ?? 'Erro ao lançar financeiro.'),
  })

  const estornarFinanceiroMutation = useMutation({
    mutationFn: (id: string) => api.post(`/vendas/pedidos/${id}/estornar-financeiro`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] }); setConfirmEstornoFinanceiro(null); setErro('') },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      setErro(e.response?.data?.error ?? 'Erro ao estornar financeiro.'); setConfirmEstornoFinanceiro(null)
    },
  })

  const gerarNfeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/fiscal/nfe/from-pedido/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] })
      setErro('')
      navigate(`/fiscal/nfe?nfe=${data.data.id}`)
    },
    onError: (e: { response?: { data?: { error?: string } } }) => setErro(e.response?.data?.error ?? 'Erro ao gerar NF-e.'),
  })

  const totalDia = pedidosFiltrados
    .filter(p => p.status !== 'CANCELADO')
    .reduce((a, p) => a + Number(p.total), 0)

  function novoPedido() { setEditId(null); setEditNumero(null); setEditReadOnly(false); setPanelOpen(true) }
  function editarPedido(p: PedidoVenda) {
    setEditId(p.id); setEditNumero(p.numero)
    setEditReadOnly(p.estoqueElancado || p.financeiroLancado)
    setPanelOpen(true)
  }
  function fechar() { setPanelOpen(false); setEditId(null); setEditNumero(null); setEditReadOnly(false) }

  if (panelOpen) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={fechar} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {editId
                ? `${editReadOnly ? 'Visualizar' : 'Editar'} Pedido Nº ${editNumero?.padStart(6, '0')}`
                : 'Novo Pedido de Venda'}
            </h2>
            <p className="text-xs text-gray-400">Pedidos de Venda</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <PedidoVendaForm
            pedidoId={editId ?? undefined}
            readOnly={editReadOnly}
            onSuccess={fechar}
            onCancel={fechar}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pedidos de Venda</h2>
          <p className="text-gray-500 text-sm">Gestão de pedidos de venda</p>
        </div>
        <button
          onClick={novoPedido}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Novo Pedido
        </button>
      </div>

      {/* ── Barra de filtros ── */}
      <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
        {/* Busca texto */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Número ou cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Período */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="text-xs text-gray-400">até</span>
          <input
            type="date"
            value={dataFim}
            onChange={e => setDataFim(e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Pills de status */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {TODOS_STATUS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={clsx(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition',
                statusFiltro.has(s)
                  ? clsx(statusCor[s], 'border-current')
                  : 'text-gray-500 border-gray-200 hover:border-gray-400',
              )}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Limpar */}
        {filtroAtivo && (
          <button
            type="button"
            onClick={limparFiltros}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition"
          >
            <X size={13} /> limpar
          </button>
        )}
      </div>

      {erro && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>}

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Nº Pedido</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Lançamentos</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pedidosFiltrados.map(p => (
                <tr key={p.id} onClick={() => editarPedido(p)} className="hover:bg-gray-50 transition cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700">{p.numero.padStart(6, '0')}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(p.dataEmissao ?? p.criadoEm).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{p.pessoa?.nome ?? 'Consumidor Final'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    R$ {Number(p.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Estoque */}
                      <span title={p.estoqueElancado ? 'Estoque lançado' : 'Estoque não lançado'}>
                        <Boxes size={15} className={p.estoqueElancado ? 'text-blue-500' : 'text-gray-200'} />
                      </span>
                      {/* Financeiro */}
                      <span title={p.financeiroLancado ? 'Financeiro lançado' : 'Financeiro não lançado'}>
                        <Wallet size={15} className={p.financeiroLancado ? 'text-green-500' : 'text-gray-200'} />
                      </span>
                      {/* Nota fiscal */}
                      {p.notasFiscais.length > 0 ? (() => {
                        const nf = p.notasFiscais[0]
                        const cor = nf.status === 'AUTORIZADA' ? 'text-emerald-600'
                          : nf.status === 'CANCELADA' ? 'text-red-400'
                          : 'text-amber-500'
                        const label = `${nf.modelo === 'NFCE' ? 'NFC-e' : 'NF-e'} ${nf.numero} — ${nf.status}`
                        return (
                          <span title={label}>
                            <Receipt size={15} className={cor} />
                          </span>
                        )
                      })() : (
                        <span title="Sem nota fiscal">
                          <Receipt size={15} className="text-gray-200" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', statusCor[p.status])}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                      <AcoesMenu
                        pedido={p}
                        busy={lancarEstoqueMutation.isPending || lancarFinanceiroMutation.isPending || gerarNfeMutation.isPending}
                        onLancarEstoque={() => { setErro(''); lancarEstoqueMutation.mutate(p.id) }}
                        onEstornarEstoque={() => { setErro(''); setConfirmEstornoEstoque(p) }}
                        onLancarFinanceiro={() => { setErro(''); lancarFinanceiroMutation.mutate(p.id) }}
                        onEstornarFinanceiro={() => { setErro(''); setConfirmEstornoFinanceiro(p) }}
                        onGerarNFe={() => { setErro(''); gerarNfeMutation.mutate(p.id) }}
                        onEditar={() => editarPedido(p)}
                        onCancelar={() => { setErro(''); setConfirmCancel(p) }}
                        onExcluir={() => { setErro(''); setConfirmExcluir(p) }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {pedidosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {filtroAtivo ? 'Nenhum pedido corresponde aos filtros.' : 'Nenhum pedido encontrado.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Totalizadores no rodapé da página */}
      {pedidos.length > 0 && (
        <div className="mt-auto -mx-6 -mb-6 flex items-center justify-end gap-8 border-t border-gray-200 bg-white px-6 py-3">
          <div className="text-right leading-tight">
            <div className="text-base text-gray-800 tabular-nums">
              {filtroAtivo
                ? `${String(pedidosFiltrados.length).padStart(2, '0')} / ${String(pedidos.length).padStart(2, '0')}`
                : String(pedidos.length).padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-400">quantidade</div>
          </div>
          <div className="text-right leading-tight">
            <div className="text-base text-gray-800 tabular-nums">{totalDia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-xs text-gray-400">valor total (R$)</div>
          </div>
          <button
            type="button"
            title="Voltar ao topo"
            onClick={e => e.currentTarget.closest('main')?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancelar Pedido"
        message={`Cancelar o pedido Nº ${confirmCancel?.numero}? Ele continuará na lista, marcado como cancelado, e sai dos totais.`}
        confirmLabel="Cancelar Pedido"
        variant="warning"
        loading={cancelarMutation.isPending}
        onConfirm={() => confirmCancel && cancelarMutation.mutate(confirmCancel.id)}
        onCancel={() => setConfirmCancel(null)}
      />

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir Pedido"
        message={`Excluir permanentemente o pedido Nº ${confirmExcluir?.numero}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={excluirMutation.isPending}
        onConfirm={() => confirmExcluir && excluirMutation.mutate(confirmExcluir.id)}
        onCancel={() => setConfirmExcluir(null)}
      />

      <ConfirmDialog
        open={!!confirmEstornoEstoque}
        title="Estornar Estoque"
        message={`Estornar os lançamentos de estoque do pedido Nº ${confirmEstornoEstoque?.numero}? As baixas de quantidade serão revertidas.`}
        confirmLabel="Estornar Estoque"
        variant="warning"
        loading={estornarEstoqueMutation.isPending}
        onConfirm={() => confirmEstornoEstoque && estornarEstoqueMutation.mutate(confirmEstornoEstoque.id)}
        onCancel={() => setConfirmEstornoEstoque(null)}
      />

      <ConfirmDialog
        open={!!confirmEstornoFinanceiro}
        title="Estornar Financeiro"
        message={`Estornar os títulos a receber do pedido Nº ${confirmEstornoFinanceiro?.numero}? Os títulos abertos serão excluídos.`}
        confirmLabel="Estornar Financeiro"
        variant="warning"
        loading={estornarFinanceiroMutation.isPending}
        onConfirm={() => confirmEstornoFinanceiro && estornarFinanceiroMutation.mutate(confirmEstornoFinanceiro.id)}
        onCancel={() => setConfirmEstornoFinanceiro(null)}
      />
    </div>
  )
}
