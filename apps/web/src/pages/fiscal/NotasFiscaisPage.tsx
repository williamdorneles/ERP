import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { api } from '../../lib/api'
import {
  Plus, FileText, CheckCircle2, XCircle, AlertTriangle, Clock,
  Download, RefreshCw, Ban, ExternalLink, Search,
} from 'lucide-react'
import clsx from 'clsx'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'

interface NotaFiscal {
  id: string; numero: number; serie: number; modelo: string
  chave?: string; protocolo?: string; status: string
  naturezaOperacao: string; dataEmissao: string
  destNome: string; destCpfCnpj?: string
  vNF: number; vDesconto: number
  formaPagamento: string; mensagemSefaz?: string
  pedidoVendaId?: string
}

interface Pedido { id: string; numero: string; total: number; pessoa?: { nome: string } }

const STATUS_CONF: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDENTE:     { label: 'Pendente',     color: 'bg-gray-100 text-gray-600',   icon: <Clock size={12} /> },
  PROCESSANDO:  { label: 'Processando',  color: 'bg-blue-100 text-blue-700',   icon: <RefreshCw size={12} className="animate-spin" /> },
  AUTORIZADA:   { label: 'Autorizada',   color: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={12} /> },
  REJEITADA:    { label: 'Rejeitada',    color: 'bg-red-100 text-red-700',     icon: <XCircle size={12} /> },
  CANCELADA:    { label: 'Cancelada',    color: 'bg-gray-100 text-gray-500',   icon: <Ban size={12} /> },
  DENEGADA:     { label: 'Denegada',     color: 'bg-red-100 text-red-800',     icon: <AlertTriangle size={12} /> },
  INUTILIZADA:  { label: 'Inutilizada',  color: 'bg-gray-100 text-gray-400',   icon: <Ban size={12} /> },
}

export function NotasFiscaisPage() {
  const queryClient = useQueryClient()
  const [filtroStatus, setFiltroStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [modalEmitir, setModalEmitir] = useState(false)
  const [cancelando, setCancelando] = useState<NotaFiscal | null>(null)
  const [justificativa, setJustificativa] = useState('')

  const { data: notas = [], isLoading } = useQuery<NotaFiscal[]>({
    queryKey: ['notas-fiscais', filtroStatus],
    queryFn: () => api.get('/fiscal/nfe', {
      params: { status: filtroStatus || undefined },
    }).then(r => r.data),
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notas Fiscais Eletrônicas</h2>
          <p className="text-gray-500 text-sm">NF-e modelo 55 e NFC-e modelo 65</p>
        </div>
        <button
          onClick={() => setModalEmitir(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Emitir NF-e
        </button>
      </div>

      {/* KPIs */}
      {estatisticas && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Emitidas', value: estatisticas.total, color: 'text-gray-800' },
            { label: 'Autorizadas', value: estatisticas.autorizadas, color: 'text-green-700' },
            { label: 'Rejeitadas', value: estatisticas.rejeitadas, color: 'text-red-600' },
            { label: 'Valor Hoje', value: `R$ ${Number(estatisticas.totalHoje?.valor ?? 0).toFixed(2)}`, color: 'text-primary-700' },
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
              placeholder="Buscar por destinatário, número, chave..."
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
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {notasFiltradas.map(n => {
                  const sc = STATUS_CONF[n.status] ?? STATUS_CONF.PENDENTE
                  return (
                    <tr key={n.id} className={clsx(
                      'hover:bg-gray-50 transition',
                      n.status === 'CANCELADA' && 'opacity-50',
                    )}>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700 whitespace-nowrap">
                        {String(n.numero).padStart(9, '0')}-{n.serie}
                        <span className="block text-gray-400 font-normal">{n.modelo === 'NFE' ? 'NF-e 55' : 'NFC-e 65'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {new Date(n.dataEmissao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[180px]">{n.destNome}</p>
                        {n.destCpfCnpj && <p className="text-xs text-gray-400 font-mono">{n.destCpfCnpj}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 truncate max-w-[160px]">
                        {n.chave ? `${n.chave.slice(0, 4)}...${n.chave.slice(-4)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        R$ {Number(n.vNF).toFixed(2)}
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
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {n.status === 'AUTORIZADA' && (
                            <>
                              <a
                                href={`/api/fiscal/nfe/${n.id}/danfe`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Baixar DANFE"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition"
                              >
                                <Download size={14} />
                              </a>
                              <a
                                href={`/api/fiscal/nfe/${n.id}/xml`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Baixar XML"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                              >
                                <ExternalLink size={14} />
                              </a>
                              <button
                                onClick={() => setCancelando(n)}
                                title="Cancelar NF-e"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                              >
                                <Ban size={14} />
                              </button>
                            </>
                          )}
                          {n.status === 'REJEITADA' && (
                            <button
                              onClick={() => retryMutation.mutate(n.id)}
                              disabled={retryMutation.isPending}
                              title="Tentar novamente"
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition"
                            >
                              <RefreshCw size={12} /> Retry
                            </button>
                          )}
                          {(n.status === 'PENDENTE' || n.status === 'PROCESSANDO') && (
                            <span className="text-xs text-gray-300">aguardando...</span>
                          )}
                          {(n.status === 'CANCELADA' || n.status === 'INUTILIZADA') && (
                            <span className="text-xs text-gray-300">—</span>
                          )}
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

      {/* Modal emissão */}
      <Modal open={modalEmitir} onClose={() => setModalEmitir(false)} title="Emitir NF-e" size="lg">
        <EmitirNFeModal onSuccess={() => {
          setModalEmitir(false)
          queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
          queryClient.invalidateQueries({ queryKey: ['nfe-estatisticas'] })
        }} onCancel={() => setModalEmitir(false)} />
      </Modal>

      {/* Confirm cancelamento */}
      <ConfirmDialog
        open={!!cancelando}
        title="Cancelar NF-e"
        message={
          <div className="space-y-3">
            <p>Informe a justificativa do cancelamento para a NF-e <strong>{cancelando?.numero}</strong>:</p>
            <textarea
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              rows={3}
              maxLength={255}
              minLength={15}
              placeholder="Mínimo 15 caracteres..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <p className="text-xs text-gray-400">{justificativa.length}/255 — mínimo 15</p>
          </div>
        }
        confirmLabel="Cancelar NF-e"
        variant="danger"
        loading={cancelarMutation.isPending}
        onConfirm={() => cancelando && cancelarMutation.mutate({ id: cancelando.id, just: justificativa })}
        onCancel={() => { setCancelando(null); setJustificativa('') }}
      />
    </div>
  )
}

// ─── Modal Emitir NF-e ───────────────────────────────────────────────────────

function EmitirNFeModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [modo, setModo] = useState<'pedido' | 'avulsa'>('pedido')
  const { register, handleSubmit } = useForm({
    defaultValues: { pedidoId: '', naturezaOperacao: 'Venda de Produto', infCpl: '' },
  })

  const { data: pedidos = [] } = useQuery<Pedido[]>({
    queryKey: ['pedidos-para-nfe'],
    queryFn: () => api.get('/vendas/pedidos', { params: { status: 'CONFIRMADO' } })
      .then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data: { pedidoId?: string; naturezaOperacao: string; infCpl?: string }) => {
      if (modo === 'pedido' && data.pedidoId) {
        return api.post(`/fiscal/nfe/from-pedido/${data.pedidoId}`, {
          naturezaOperacao: data.naturezaOperacao,
          infCpl: data.infCpl,
        })
      }
      throw new Error('Selecione um pedido')
    },
    onSuccess,
  })

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(['pedido', 'avulsa'] as const).map(m => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition',
              modo === m ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {m === 'pedido' ? 'A partir de Pedido de Venda' : 'Nota Avulsa'}
          </button>
        ))}
      </div>

      {modo === 'pedido' && (
        <form onSubmit={handleSubmit(d => mutation.mutate(d as never))} className="space-y-4">
          <FormField label="Pedido de Venda" required hint="Somente pedidos Confirmados são listados">
            <Select {...register('pedidoId', { required: true })}>
              <option value="">Selecione o pedido...</option>
              {pedidos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.numero} — {p.pessoa?.nome ?? 'Consumidor Final'} — R$ {Number(p.total).toFixed(2)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Natureza da Operação">
            <Input {...register('naturezaOperacao')} />
          </FormField>

          <FormField label="Informações Complementares (infCpl)" hint="Aparece no DANFE">
            <textarea
              {...register('infCpl')}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Dados adicionais, referência ao pedido, etc."
            />
          </FormField>

          {mutation.isError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              {String((mutation.error as Error)?.message ?? 'Erro ao emitir NF-e')}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending}>Emitir NF-e</Button>
          </div>
        </form>
      )}

      {modo === 'avulsa' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          Para emissão de NF-e avulsa com itens manuais, acesse a API diretamente em{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">POST /api/fiscal/nfe</code>.
          A interface completa de emissão avulsa está em desenvolvimento.
        </div>
      )}
    </div>
  )
}
