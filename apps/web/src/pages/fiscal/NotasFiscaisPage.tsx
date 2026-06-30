import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  Plus, FileText, CheckCircle2, XCircle, AlertTriangle, Clock,
  Download, RefreshCw, Ban, ExternalLink, Search, Send, MoreHorizontal,
  Boxes, Wallet, ArrowLeft,
} from 'lucide-react'
import clsx from 'clsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Button } from '../../components/ui/Button'
import { NfeForm } from '../../components/forms/NfeForm'
import { NovaNfeForm } from '../../components/forms/NovaNfeForm'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PedidoResumo {
  estoqueElancado: boolean
  financeiroLancado: boolean
  numero: string
}

interface NotaFiscal {
  id: string; numero: number; serie: number; modelo: string
  chave?: string; protocolo?: string; status: string
  naturezaOperacao: string; dataEmissao: string
  destNome: string; destCpfCnpj?: string
  vNF: number; vDesconto: number
  formaPagamento: string; mensagemSefaz?: string
  pedidoVendaId?: string
  pedidoVenda?: PedidoResumo
}

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_CONF: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDENTE:    { label: 'Pendente',    color: 'bg-gray-100 text-gray-600',   icon: <Clock size={12} /> },
  PROCESSANDO: { label: 'Processando', color: 'bg-blue-100 text-blue-700',   icon: <RefreshCw size={12} className="animate-spin" /> },
  AUTORIZADA:  { label: 'Autorizada',  color: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={12} /> },
  REJEITADA:   { label: 'Rejeitada',   color: 'bg-red-100 text-red-700',     icon: <XCircle size={12} /> },
  CANCELADA:   { label: 'Cancelada',   color: 'bg-gray-100 text-gray-500',   icon: <Ban size={12} /> },
  DENEGADA:    { label: 'Denegada',    color: 'bg-red-100 text-red-800',     icon: <AlertTriangle size={12} /> },
  INUTILIZADA: { label: 'Inutilizada', color: 'bg-gray-100 text-gray-400',   icon: <Ban size={12} /> },
}

// ── Menu de ações por nota ────────────────────────────────────────────────────

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

function AcoesMenu({
  nota, busy,
  onAbrir, onTransmitir, onReenviar, onCancelar,
}: {
  nota: NotaFiscal; busy: boolean
  onAbrir: () => void
  onTransmitir: () => void
  onReenviar: () => void
  onCancelar: () => void
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function abrir() {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setCoords({ top: r.bottom + 6, left: Math.max(8, r.right - 220) })
    setOpen(v => !v)
  }

  const wrap = (fn: () => void) => () => { setOpen(false); fn() }
  const isPendente = nota.status === 'PENDENTE'
  const isAutorizada = nota.status === 'AUTORIZADA'
  const isRejeitada = nota.status === 'REJEITADA'

  return (
    <>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); abrir() }}
        disabled={busy}
        className={clsx(
          'p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition',
          open && 'bg-gray-100 text-gray-700',
        )}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: 220, zIndex: 50 }}
          className="rounded-xl border border-gray-200 bg-white shadow-xl py-1.5"
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100 mb-1">
            NF-e {String(nota.numero).padStart(9, '0')}-{nota.serie}
          </div>

          <MenuItem icon={<FileText size={14} />} label="Abrir / Visualizar" onClick={wrap(onAbrir)} />

          {isPendente && (
            <MenuItem icon={<Send size={14} className="text-primary-600" />} label="Transmitir à SEFAZ" onClick={wrap(onTransmitir)} />
          )}

          {isRejeitada && (
            <MenuItem icon={<RefreshCw size={14} className="text-amber-600" />} label="Reenviar" onClick={wrap(onReenviar)} />
          )}

          {isAutorizada && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <MenuItem
                icon={<Download size={14} className="text-primary-600" />}
                label="Gerar DANFE (PDF)"
                onClick={wrap(() => window.open(`/api/fiscal/nfe/${nota.id}/danfe`, '_blank'))}
              />
              <MenuItem
                icon={<ExternalLink size={14} className="text-blue-600" />}
                label="Baixar XML autorizado"
                onClick={wrap(() => window.open(`/api/fiscal/nfe/${nota.id}/xml`, '_blank'))}
              />
              <div className="my-1 border-t border-gray-100" />
              <MenuItem
                icon={<Ban size={14} />}
                label="Cancelar NF-e"
                onClick={wrap(onCancelar)}
                danger
              />
            </>
          )}
        </div>
      )}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function NotasFiscaisPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtroStatus, setFiltroStatus] = useState('')
  const [busca, setBusca] = useState('')
  // null = lista, 'nova' = formulário nova, string = id da nota aberta
  const [view, setView] = useState<null | 'nova' | string>(() => searchParams.get('nfe'))

  useEffect(() => {
    const nfeId = searchParams.get('nfe')
    if (nfeId) {
      setView(nfeId)
      setSearchParams({}, { replace: true })
    }
  }, [])
  const [cancelando, setCancelando] = useState<NotaFiscal | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [transmitindo, setTransmitindo] = useState<NotaFiscal | null>(null)

  const { data: notas = [], isLoading } = useQuery<NotaFiscal[]>({
    queryKey: ['notas-fiscais', filtroStatus],
    queryFn: () => api.get('/fiscal/nfe', { params: { status: filtroStatus || undefined } }).then(r => r.data),
    refetchInterval: (q) => (q.state.data ?? []).some(n => n.status === 'PROCESSANDO') ? 5000 : false,
  })

  const { data: estatisticas } = useQuery({
    queryKey: ['nfe-estatisticas'],
    queryFn: () => api.get('/fiscal/nfe/estatisticas').then(r => r.data),
  })

  const cancelarMutation = useMutation({
    mutationFn: ({ id, just }: { id: string; just: string }) =>
      api.post(`/fiscal/nfe/${id}/cancelar`, { justificativa: just }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
      queryClient.invalidateQueries({ queryKey: ['nfe-estatisticas'] })
      setCancelando(null)
      setJustificativa('')
    },
  })

  const transmitirMutation = useMutation({
    mutationFn: (id: string) => api.post(`/fiscal/nfe/${id}/transmitir`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
      queryClient.invalidateQueries({ queryKey: ['nfe-estatisticas'] })
      queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] })
      setTransmitindo(null)
    },
  })

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/fiscal/nfe/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
      queryClient.invalidateQueries({ queryKey: ['nfe-estatisticas'] })
    },
  })

  const notasFiltradas = notas.filter(n =>
    !busca || n.destNome.toLowerCase().includes(busca.toLowerCase()) ||
    String(n.numero).includes(busca) || (n.chave ?? '').includes(busca),
  )

  const busy = cancelarMutation.isPending || transmitirMutation.isPending || retryMutation.isPending

  // ── Vista inline: Nova NF-e ───────────────────────────────────────────────
  if (view === 'nova') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView(null)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Nova NF-e Avulsa</h2>
            <p className="text-xs text-gray-400">Notas Fiscais Eletrônicas</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <NovaNfeForm
            onClose={() => setView(null)}
            onSuccess={(id) => {
              queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
              queryClient.invalidateQueries({ queryKey: ['nfe-estatisticas'] })
              setView(id)
            }}
          />
        </div>
      </div>
    )
  }

  // ── Vista inline: Detalhes / edição de NF-e ───────────────────────────────
  if (view) {
    const notaVista = notas.find(n => n.id === view)
    const scVista = notaVista ? (STATUS_CONF[notaVista.status] ?? STATUS_CONF.PENDENTE) : null
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setView(null)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900">
                {notaVista
                  ? `${notaVista.modelo === 'NFCE' ? 'NFC-e' : 'NF-e'} ${String(notaVista.numero).padStart(9, '0')}-${notaVista.serie}`
                  : 'NF-e'}
              </h2>
              {scVista && (
                <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', scVista.color)}>
                  {scVista.icon} {scVista.label}
                </span>
              )}
              {notaVista?.pedidoVenda && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  Pedido {notaVista.pedidoVenda.numero}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">Notas Fiscais Eletrônicas</p>
          </div>
          {notaVista?.pedidoVenda && (
            <div className="flex items-center gap-1.5">
              <span title={notaVista.pedidoVenda.estoqueElancado ? 'Estoque lançado' : 'Estoque não lançado'}>
                <Boxes size={16} className={notaVista.pedidoVenda.estoqueElancado ? 'text-blue-500' : 'text-gray-200'} />
              </span>
              <span title={notaVista.pedidoVenda.financeiroLancado ? 'Financeiro lançado' : 'Financeiro não lançado'}>
                <Wallet size={16} className={notaVista.pedidoVenda.financeiroLancado ? 'text-green-500' : 'text-gray-200'} />
              </span>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <NfeForm
            notaId={view}
            onClose={() => setView(null)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
              queryClient.invalidateQueries({ queryKey: ['nfe-estatisticas'] })
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notas Fiscais Eletrônicas</h2>
          <p className="text-gray-500 text-sm">NF-e modelo 55 — emissão, transmissão e controle</p>
        </div>
        <button
          onClick={() => setView('nova')}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Nova NF-e
        </button>
      </div>

      {/* KPIs */}
      {estatisticas && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Emitidas', value: estatisticas.total, color: 'text-gray-800' },
            { label: 'Autorizadas', value: estatisticas.autorizadas, color: 'text-green-700' },
            { label: 'Rejeitadas', value: estatisticas.rejeitadas, color: 'text-red-600' },
            {
              label: 'Valor Hoje',
              value: Number(estatisticas.totalHoje?.valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
              color: 'text-primary-700',
            },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{k.label}</p>
              <p className={clsx('text-2xl font-bold mt-1', k.color)}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por destinatário, número ou chave..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_CONF).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : notasFiltradas.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Nenhuma NF-e encontrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Nº / Série</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Destinatário</th>
                  <th className="px-4 py-3 font-mono">Chave</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Integrações</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {notasFiltradas.map(n => {
                  const sc = STATUS_CONF[n.status] ?? STATUS_CONF.PENDENTE
                  return (
                    <tr
                      key={n.id}
                      onClick={() => setView(n.id)}
                      className={clsx(
                        'hover:bg-gray-50 transition cursor-pointer',
                        n.status === 'CANCELADA' && 'opacity-50',
                      )}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700 whitespace-nowrap">
                        {String(n.numero).padStart(9, '0')}-{n.serie}
                        <span className="block text-gray-400 font-normal">{n.modelo === 'NFE' ? 'NF-e 55' : 'NFC-e 65'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-xs">
                        {new Date(n.dataEmissao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[160px]">{n.destNome}</p>
                        {n.destCpfCnpj && <p className="text-xs text-gray-400 font-mono">{n.destCpfCnpj}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 truncate max-w-[130px]">
                        {n.chave ? `${n.chave.slice(0, 4)}...${n.chave.slice(-4)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums">
                        {Number(n.vNF).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      {/* Ícones de integração */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {n.pedidoVenda ? (
                            <>
                              <span title={n.pedidoVenda.estoqueElancado ? 'Estoque lançado' : 'Estoque não lançado'}>
                                <Boxes size={14} className={n.pedidoVenda.estoqueElancado ? 'text-blue-500' : 'text-gray-200'} />
                              </span>
                              <span title={n.pedidoVenda.financeiroLancado ? 'Financeiro lançado' : 'Financeiro não lançado'}>
                                <Wallet size={14} className={n.pedidoVenda.financeiroLancado ? 'text-green-500' : 'text-gray-200'} />
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-300">avulsa</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', sc.color)}>
                          {sc.icon} {sc.label}
                        </span>
                        {n.mensagemSefaz && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[120px]" title={n.mensagemSefaz}>
                            {n.mensagemSefaz}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {/* Transmitir rápido para PENDENTE */}
                          {n.status === 'PENDENTE' && (
                            <button
                              onClick={e => { e.stopPropagation(); setView(n.id) }}
                              disabled={busy}
                              title="Transmitir à SEFAZ"
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg transition disabled:opacity-50"
                            >
                              <Send size={11} /> Transmitir
                            </button>
                          )}
                          <AcoesMenu
                            nota={n}
                            busy={busy}
                            onAbrir={() => setView(n.id)}
                            onTransmitir={() => setTransmitindo(n)}
                            onReenviar={() => retryMutation.mutate(n.id)}
                            onCancelar={() => setCancelando(n)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Confirm: Transmitir ── */}
      <ConfirmDialog
        open={!!transmitindo}
        title="Transmitir NF-e à SEFAZ"
        message={
          <div className="space-y-2">
            <p>
              Confirma o envio da NF-e <strong>{transmitindo?.numero}</strong> para autorização na SEFAZ?
            </p>
            {transmitindo?.pedidoVenda && (
              <ul className="text-sm text-gray-500 list-disc pl-4 space-y-0.5">
                {!transmitindo.pedidoVenda.estoqueElancado && (
                  <li>Estoque do pedido será lançado automaticamente.</li>
                )}
                {!transmitindo.pedidoVenda.financeiroLancado && (
                  <li>Financeiro (contas a receber) será lançado automaticamente.</li>
                )}
              </ul>
            )}
            {transmitirMutation.isError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                {String((transmitirMutation.error as Error)?.message ?? 'Erro ao transmitir')}
              </p>
            )}
          </div>
        }
        confirmLabel="Transmitir"
        loading={transmitirMutation.isPending}
        onConfirm={() => transmitindo && transmitirMutation.mutate(transmitindo.id)}
        onCancel={() => setTransmitindo(null)}
      />

      {/* ── Confirm: Cancelar ── */}
      <ConfirmDialog
        open={!!cancelando}
        title="Cancelar NF-e"
        message={
          <div className="space-y-3">
            <p>Justificativa do cancelamento para a NF-e <strong>{cancelando?.numero}</strong>:</p>
            <textarea
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              rows={3}
              maxLength={255}
              placeholder="Mínimo 15 caracteres..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <p className="text-xs text-gray-400">{justificativa.length}/255 — mínimo 15</p>
          </div>
        }
        confirmLabel="Cancelar NF-e"
        variant="danger"
        loading={cancelarMutation.isPending}
        onConfirm={() => cancelando && justificativa.length >= 15 && cancelarMutation.mutate({ id: cancelando.id, just: justificativa })}
        onCancel={() => { setCancelando(null); setJustificativa('') }}
      />
    </div>
  )
}
