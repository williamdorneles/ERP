import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '../../lib/api'
import { Plus, Play, XCircle, ArrowLeft, Pencil, ClipboardCheck, History, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { OrdemProducaoForm, type OrdemProducaoData } from '../../components/forms/OrdemProducaoForm'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input, Textarea } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { Form } from '../../components/ui/Form'

interface OrdemProducao {
  id: string; numero: string; status: string; turno: string
  quantidade: number; quantidadeProduzida: number; dataProducao: string
  produtoId: string; observacao?: string
  produto: { nome: string }
  responsavel?: { nome: string }
}

interface MovimentacaoApt {
  id: string; tipo: string; quantidade: number; produto: { nome: string }
}

interface Apontamento {
  id: string; quantidade: number; observacao?: string
  estornado: boolean; estornadoEm?: string; observacaoEstorno?: string
  criadoEm: string; movimentacoes: MovimentacaoApt[]
}

const statusCor: Record<string, string> = {
  PLANEJADA: 'bg-blue-100 text-blue-700',
  EM_PRODUCAO: 'bg-amber-100 text-amber-700',
  CONCLUIDA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-red-100 text-red-700',
}

const turnoCor: Record<string, string> = {
  MANHA: 'bg-yellow-50 text-yellow-700',
  TARDE: 'bg-orange-50 text-orange-700',
  NOITE: 'bg-indigo-50 text-indigo-700',
}

const apontamentoSchema = z.object({
  quantidade: z.coerce.number().positive('Deve ser maior que 0'),
  observacao: z.string().optional(),
})
type ApontamentoData = z.infer<typeof apontamentoSchema>

function ApontamentoForm({ ordem, onSuccess, onCancel }: {
  ordem: OrdemProducao
  onSuccess: () => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const planejada = Number(ordem.quantidade)
  const produzida = Number(ordem.quantidadeProduzida)
  const restante = planejada - produzida
  const pct = planejada > 0 ? (produzida / planejada) * 100 : 0

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ApontamentoData>({
    resolver: zodResolver(apontamentoSchema),
    defaultValues: { quantidade: restante },
  })

  const qtdForm = Number(watch('quantidade') ?? 0)
  const novoTotal = Math.min(produzida + qtdForm, planejada)
  const novoTotalPct = planejada > 0 ? (novoTotal / planejada) * 100 : 0
  const seraTotal = novoTotal >= planejada

  const mutation = useMutation({
    mutationFn: (data: ApontamentoData) =>
      api.post(`/producao/ordens/${ordem.id}/apontar`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-producao'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-estoque'] })
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] })
      onSuccess()
    },
  })

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">
      {/* Cabeçalho da OP */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Produto</span>
          <span className="font-semibold text-gray-900">{ordem.produto.nome}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Quantidade planejada</span>
          <span className="font-semibold tabular-nums">{planejada.toFixed(3)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Já produzido</span>
          <span className="font-semibold tabular-nums text-green-700">{produzida.toFixed(3)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Restante</span>
          <span className="font-bold tabular-nums text-amber-700">{restante.toFixed(3)}</span>
        </div>

        {/* Barra de progresso atual */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progresso atual</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-2 bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <FormField
        label="Quantidade a Apontar"
        error={errors.quantidade?.message}
        hint={`Máximo: ${restante.toFixed(3)}`}
        required
      >
        <Input
          {...register('quantidade')}
          type="number"
          step="0.001"
          min="0.001"
          max={restante}
          placeholder={restante.toFixed(3)}
          error={!!errors.quantidade}
        />
      </FormField>

      {/* Preview do resultado */}
      {qtdForm > 0 && (
        <div className={clsx(
          'rounded-lg border px-4 py-3 text-sm space-y-2',
          seraTotal ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200',
        )}>
          <div className="flex justify-between">
            <span className={seraTotal ? 'text-green-700' : 'text-blue-700'}>
              {seraTotal ? '✓ Apontamento total — OP será concluída' : 'Apontamento parcial — OP continuará EM PRODUÇÃO'}
            </span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Após apontamento</span>
              <span>{novoTotalPct.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={clsx('h-2 rounded-full transition-all', seraTotal ? 'bg-green-500' : 'bg-blue-500')}
                style={{ width: `${novoTotalPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <FormField label="Observação">
        <Textarea {...register('observacao')} placeholder="Turno, operador, observações de qualidade..." rows={2} />
      </FormField>

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao registrar apontamento.'}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={mutation.isPending}>
          Registrar Apontamento
        </Button>
      </div>
    </Form>
  )
}

type PanelMode = 'none' | 'novo' | 'editar' | 'apontar' | 'historico'

export function OrdensProducaoPage() {
  const queryClient = useQueryClient()
  const [panelMode, setPanelMode] = useState<PanelMode>('none')
  const [ordemSel, setOrdemSel] = useState<OrdemProducao | null>(null)
  const [confirmCancelamento, setConfirmCancelamento] = useState<OrdemProducao | null>(null)
  const [confirmEstorno, setConfirmEstorno] = useState<Apontamento | null>(null)
  const [estornoObs, setEstornoObs] = useState('')
  const [busca, setBusca] = useState('')
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false)

  const { data: ordens = [], isLoading } = useQuery<OrdemProducao[]>({
    queryKey: ['ordens-producao'],
    queryFn: () => api.get('/producao/ordens').then(r => r.data),
  })

  const { data: apontamentos = [], isLoading: loadingApts } = useQuery<Apontamento[]>({
    queryKey: ['apontamentos', ordemSel?.id],
    queryFn: () => api.get(`/producao/ordens/${ordemSel!.id}/apontamentos`).then(r => r.data),
    enabled: !!ordemSel && panelMode === 'historico',
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/producao/ordens/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-producao'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-estoque'] })
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] })
      setConfirmCancelamento(null)
    },
  })

  const estornoMutation = useMutation({
    mutationFn: ({ apontamentoId, observacao }: { apontamentoId: string; observacao?: string }) =>
      api.post(`/producao/ordens/${ordemSel!.id}/apontamentos/${apontamentoId}/estornar`, { observacao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-producao'] })
      queryClient.invalidateQueries({ queryKey: ['apontamentos', ordemSel?.id] })
      queryClient.invalidateQueries({ queryKey: ['produtos-estoque'] })
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] })
      setConfirmEstorno(null)
      setEstornoObs('')
    },
  })

  function fechar() {
    setPanelMode('none')
    setOrdemSel(null)
  }

  /* ── Painéis inline ─────────────────────────────────────────── */

  if (panelMode === 'novo' || panelMode === 'editar') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={fechar} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {panelMode === 'editar' ? `Editar Ordem ${ordemSel?.numero}` : 'Nova Ordem de Produção'}
            </h2>
            <p className="text-xs text-gray-400">Ordens de Produção</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <OrdemProducaoForm
            initialData={panelMode === 'editar' ? (ordemSel as OrdemProducaoData) : undefined}
            onSuccess={fechar}
            onCancel={fechar}
          />
        </div>
      </div>
    )
  }

  if (panelMode === 'apontar' && ordemSel) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={fechar} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Apontamento — Ordem {ordemSel.numero}
            </h2>
            <p className="text-xs text-gray-400">Ordens de Produção</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl">
          <ApontamentoForm
            ordem={ordemSel}
            onSuccess={fechar}
            onCancel={fechar}
          />
        </div>
      </div>
    )
  }

  if (panelMode === 'historico' && ordemSel) {
    const planejada = Number(ordemSel.quantidade)
    const produzida = Number(ordemSel.quantidadeProduzida)
    const pct = planejada > 0 ? Math.min((produzida / planejada) * 100, 100) : 0
    const aptAtivos = apontamentos.filter(a => !a.estornado)
    const aptEstornados = apontamentos.filter(a => a.estornado)

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={fechar} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Histórico de Apontamentos — OP {ordemSel.numero}
            </h2>
            <p className="text-xs text-gray-400">{ordemSel.produto.nome}</p>
          </div>
        </div>

        {/* Resumo da OP */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', statusCor[ordemSel.status])}>
                {ordemSel.status.replace('_', ' ')}
              </span>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Planejado</p>
              <p className="font-bold tabular-nums">{planejada.toFixed(3)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Produzido</p>
              <p className="font-bold tabular-nums text-green-700">{produzida.toFixed(3)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Progresso</p>
              <p className="font-bold tabular-nums">{pct.toFixed(0)}%</p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={clsx('h-2 rounded-full', pct >= 100 ? 'bg-green-500' : 'bg-primary-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Lista de apontamentos */}
        {loadingApts ? (
          <div className="p-8 text-center text-gray-400">Carregando apontamentos...</div>
        ) : apontamentos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            Nenhum apontamento registrado para esta ordem.
          </div>
        ) : (
          <div className="space-y-3">
            {aptAtivos.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Apontamentos Ativos ({aptAtivos.length})
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-4 py-2">Data/Hora</th>
                      <th className="px-4 py-2 text-right">Quantidade</th>
                      <th className="px-4 py-2">Observação</th>
                      <th className="px-4 py-2">Movimentações</th>
                      <th className="px-4 py-2 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {aptAtivos.map(apt => (
                      <tr key={apt.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {new Date(apt.criadoEm).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">
                          {Number(apt.quantidade).toFixed(3)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {apt.observacao ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {apt.movimentacoes.map(m => (
                              <div key={m.id} className="flex items-center gap-1.5 text-xs">
                                <span className={clsx(
                                  'px-1.5 py-0.5 rounded text-xs font-medium',
                                  m.tipo === 'ENTRADA' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                                )}>
                                  {m.tipo === 'ENTRADA' ? '+' : '−'}
                                </span>
                                <span className="text-gray-700">{Number(m.quantidade).toFixed(3)}</span>
                                <span className="text-gray-500 truncate max-w-[120px]">{m.produto.nome}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => { setConfirmEstorno(apt); setEstornoObs('') }}
                            title="Estornar apontamento"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition mx-auto"
                          >
                            <RotateCcw size={12} />
                            Estornar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {aptEstornados.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-60">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-500">
                    Estornados ({aptEstornados.length})
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-4 py-2">Data Apontamento</th>
                      <th className="px-4 py-2 text-right">Quantidade</th>
                      <th className="px-4 py-2">Observação</th>
                      <th className="px-4 py-2">Estornado em</th>
                      <th className="px-4 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {aptEstornados.map(apt => (
                      <tr key={apt.id} className="line-through text-gray-400">
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {new Date(apt.criadoEm).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {Number(apt.quantidade).toFixed(3)}
                        </td>
                        <td className="px-4 py-3 text-xs">{apt.observacao ?? '—'}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {apt.estornadoEm ? new Date(apt.estornadoEm).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs">{apt.observacaoEstorno ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Confirm estorno */}
        {confirmEstorno && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Estornar Apontamento</h3>
              <p className="text-sm text-gray-600">
                Serão criadas movimentações inversas para o apontamento de{' '}
                <strong>{Number(confirmEstorno.quantidade).toFixed(3)}</strong> unidades registrado em{' '}
                <strong>{new Date(confirmEstorno.criadoEm).toLocaleString('pt-BR')}</strong>.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo do estorno</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={2}
                  placeholder="Erro de lançamento, quantidade incorreta..."
                  value={estornoObs}
                  onChange={e => setEstornoObs(e.target.value)}
                />
              </div>
              {estornoMutation.isError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  {(estornoMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao estornar.'}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setConfirmEstorno(null); setEstornoObs('') }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  loading={estornoMutation.isPending}
                  onClick={() => estornoMutation.mutate({
                    apontamentoId: confirmEstorno.id,
                    observacao: estornoObs || undefined,
                  })}
                >
                  Confirmar Estorno
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ── Lista ──────────────────────────────────────────────────── */

  const ordensFiltradas = ordens.filter(o => {
    if (!mostrarCanceladas && o.status === 'CANCELADA') return false
    if (!busca) return true
    const q = busca.toLowerCase()
    return o.numero.includes(q) || o.produto.nome.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ordens de Produção</h2>
          <p className="text-gray-500 text-sm">{ordensFiltradas.length} ordem(ns)</p>
        </div>
        <button
          onClick={() => { setOrdemSel(null); setPanelMode('novo') }}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Nova Ordem
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center flex-wrap">
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nº da OS ou produto..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[260px]"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mostrarCanceladas}
            onChange={e => setMostrarCanceladas(e.target.checked)}
            className="rounded border-gray-300 text-gray-500 focus:ring-gray-400"
          />
          Mostrar canceladas
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Nº Ordem</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Planejado</th>
                <th className="px-4 py-3 w-36">Progresso</th>
                <th className="px-4 py-3">Turno</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ordensFiltradas.map(o => {
                const planejada = Number(o.quantidade)
                const produzida = Number(o.quantidadeProduzida)
                const pct = planejada > 0 ? Math.min((produzida / planejada) * 100, 100) : 0
                const podeApontar = o.status === 'EM_PRODUCAO'
                const podeIniciar = o.status === 'PLANEJADA'
                const podeCancelar = o.status === 'PLANEJADA' || o.status === 'EM_PRODUCAO' || o.status === 'CONCLUIDA'
                const temHistorico = o.status !== 'PLANEJADA'

                return (
                  <tr key={o.id}
                    onClick={() => o.status === 'PLANEJADA' && (setOrdemSel(o), setPanelMode('editar'))}
                    className={clsx(
                      'hover:bg-gray-50 transition',
                      o.status === 'PLANEJADA' && 'cursor-pointer',
                      o.status === 'CANCELADA' && 'opacity-50',
                    )}>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700">{o.numero}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{o.produto.nome}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {planejada.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {planejada > 0 ? (
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span className="tabular-nums">{produzida.toFixed(2)}</span>
                            <span>{pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={clsx('h-1.5 rounded-full', pct >= 100 ? 'bg-green-500' : 'bg-primary-500')}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', turnoCor[o.turno])}>
                        {o.turno}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {new Date(o.dataProducao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', statusCor[o.status])}>
                        {o.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {o.status === 'PLANEJADA' && (
                          <button
                            onClick={() => { setOrdemSel(o); setPanelMode('editar') }}
                            title="Editar ordem"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {podeIniciar && (
                          <button
                            onClick={() => statusMutation.mutate({ id: o.id, status: 'EM_PRODUCAO' })}
                            title="Iniciar produção"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition"
                          >
                            <Play size={14} />
                          </button>
                        )}
                        {podeApontar && (
                          <button
                            onClick={() => { setOrdemSel(o); setPanelMode('apontar') }}
                            title="Apontar produção"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-primary-50 text-primary-700 hover:bg-primary-100 transition"
                          >
                            <ClipboardCheck size={14} />
                            Apontar
                          </button>
                        )}
                        {temHistorico && (
                          <button
                            onClick={() => { setOrdemSel(o); setPanelMode('historico') }}
                            title="Histórico de apontamentos"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                          >
                            <History size={14} />
                          </button>
                        )}
                        {podeCancelar && (
                          <button
                            onClick={() => setConfirmCancelamento(o)}
                            title="Cancelar ordem"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition"
                          >
                            <XCircle size={13} />
                            Cancelar
                          </button>
                        )}
                        {!podeApontar && !podeCancelar && !temHistorico && (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {ordensFiltradas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    {busca ? 'Nenhuma ordem encontrada para esta busca.' : 'Nenhuma ordem de produção.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmCancelamento}
        title="Cancelar Ordem de Produção"
        message={`Deseja cancelar a ordem ${confirmCancelamento?.numero}?${confirmCancelamento?.status !== 'PLANEJADA' ? ' Todos os apontamentos serão estornados automaticamente.' : ''} Esta ação não pode ser desfeita.`}
        confirmLabel="Cancelar Ordem"
        variant="danger"
        loading={statusMutation.isPending}
        onConfirm={() => confirmCancelamento && statusMutation.mutate({
          id: confirmCancelamento.id,
          status: 'CANCELADA',
        })}
        onCancel={() => setConfirmCancelamento(null)}
      />
    </div>
  )
}
