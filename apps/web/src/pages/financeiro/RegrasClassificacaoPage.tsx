import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ArrowLeft, Edit2, Trash2, Zap, ChevronUp, ChevronDown, ToggleLeft, ToggleRight, X } from 'lucide-react'
import { api } from '../../lib/api'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

type CampoRegra = 'NOME' | 'MEMO' | 'NOME_OU_MEMO' | 'VALOR'
type TipoCorrespondencia = 'CONTEM' | 'COMECA_COM' | 'TERMINA_COM' | 'IGUAL' | 'REGEX' | 'INTERVALO'
type TipoTransacao = 'QUALQUER' | 'DEBITO' | 'CREDITO'

interface Regra {
  id: string
  nome: string
  prioridade: number
  ativo: boolean
  campo: CampoRegra
  tipoCorrespondencia: TipoCorrespondencia
  valorCorrespondencia: string | null
  valorMin: number | null
  valorMax: number | null
  tipoTransacao: TipoTransacao
  contaFinanceiraId: string
  totalMatchs: number
  contaFinanceira: { id: string; codigo: string; nome: string }
}

interface ContaFinanceira {
  id: string
  codigo: string
  nome: string
  isAnalitica: boolean
}

interface FormState {
  nome: string
  prioridade: number
  ativo: boolean
  campo: CampoRegra
  tipoCorrespondencia: TipoCorrespondencia
  valorCorrespondencia: string
  valorMin: string
  valorMax: string
  tipoTransacao: TipoTransacao
  contaFinanceiraId: string
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const CAMPO_LABELS: Record<CampoRegra, string> = {
  NOME: 'Nome do lançamento',
  MEMO: 'Memo',
  NOME_OU_MEMO: 'Nome ou Memo',
  VALOR: 'Valor',
}

const CORRESPONDENCIA_LABELS: Record<TipoCorrespondencia, string> = {
  CONTEM: 'Contém',
  COMECA_COM: 'Começa com',
  TERMINA_COM: 'Termina com',
  IGUAL: 'Igual a',
  REGEX: 'Regex',
  INTERVALO: 'Intervalo de valor',
}

const TIPO_TX_LABELS: Record<TipoTransacao, string> = {
  QUALQUER: 'Qualquer',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
}

const CORRESPONDENCIAS_POR_CAMPO: Record<CampoRegra, TipoCorrespondencia[]> = {
  NOME: ['CONTEM', 'COMECA_COM', 'TERMINA_COM', 'IGUAL', 'REGEX'],
  MEMO: ['CONTEM', 'COMECA_COM', 'TERMINA_COM', 'IGUAL', 'REGEX'],
  NOME_OU_MEMO: ['CONTEM', 'COMECA_COM', 'TERMINA_COM', 'IGUAL', 'REGEX'],
  VALOR: ['INTERVALO', 'IGUAL'],
}

const EMPTY_FORM: FormState = {
  nome: '',
  prioridade: 0,
  ativo: true,
  campo: 'NOME_OU_MEMO',
  tipoCorrespondencia: 'CONTEM',
  valorCorrespondencia: '',
  valorMin: '',
  valorMax: '',
  tipoTransacao: 'QUALQUER',
  contaFinanceiraId: '',
}

function describeRegra(regra: Regra): string {
  if (regra.campo === 'VALOR') {
    const min = regra.valorMin != null ? `R$ ${Number(regra.valorMin).toFixed(2)}` : '0'
    const max = regra.valorMax != null ? `R$ ${Number(regra.valorMax).toFixed(2)}` : '∞'
    return `Valor entre ${min} e ${max}`
  }
  const campo = CAMPO_LABELS[regra.campo]
  const tipo = CORRESPONDENCIA_LABELS[regra.tipoCorrespondencia].toLowerCase()
  return `${campo} ${tipo} "${regra.valorCorrespondencia ?? ''}"`
}

// ─── Form (inline) ────────────────────────────────────────────────────────────

function RegraForm({
  regra,
  contas,
  onClose,
  onSave,
  loading,
}: {
  regra: Regra | null
  contas: ContaFinanceira[]
  onClose: () => void
  onSave: (data: object) => void
  loading: boolean
}) {
  const [form, setForm] = useState<FormState>(() =>
    regra
      ? {
          nome: regra.nome,
          prioridade: regra.prioridade,
          ativo: regra.ativo,
          campo: regra.campo,
          tipoCorrespondencia: regra.tipoCorrespondencia,
          valorCorrespondencia: regra.valorCorrespondencia ?? '',
          valorMin: regra.valorMin?.toString() ?? '',
          valorMax: regra.valorMax?.toString() ?? '',
          tipoTransacao: regra.tipoTransacao,
          contaFinanceiraId: regra.contaFinanceiraId,
        }
      : EMPTY_FORM
  )
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const isValorField = form.campo === 'VALOR'
  const correspondenciasDisponiveis = CORRESPONDENCIAS_POR_CAMPO[form.campo]

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'campo') {
        const tipos = CORRESPONDENCIAS_POR_CAMPO[value as CampoRegra]
        if (!tipos.includes(next.tipoCorrespondencia)) next.tipoCorrespondencia = tipos[0]
      }
      return next
    })
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: typeof errors = {}
    if (!form.nome.trim()) errs.nome = 'Obrigatório'
    if (!form.contaFinanceiraId) errs.contaFinanceiraId = 'Obrigatório'
    if (!isValorField && !form.valorCorrespondencia.trim()) errs.valorCorrespondencia = 'Obrigatório'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const payload: Record<string, unknown> = {
      nome: form.nome.trim(),
      prioridade: Number(form.prioridade),
      ativo: form.ativo,
      campo: form.campo,
      tipoCorrespondencia: form.tipoCorrespondencia,
      tipoTransacao: form.tipoTransacao,
      contaFinanceiraId: form.contaFinanceiraId,
    }

    if (isValorField) {
      payload.valorCorrespondencia = null
      payload.valorMin = form.valorMin ? parseFloat(form.valorMin) : null
      payload.valorMax = form.valorMax ? parseFloat(form.valorMax) : null
    } else {
      payload.valorCorrespondencia = form.valorCorrespondencia.trim()
      payload.valorMin = null
      payload.valorMax = null
    }

    onSave(payload)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{regra ? 'Editar Regra' : 'Nova Regra'}</h2>
          <p className="text-sm text-gray-500">Regras são testadas em ordem de prioridade</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <FormField label="Nome da regra" required error={errors.nome}>
              <Input
                value={form.nome}
                onChange={e => set('nome', e.target.value)}
                placeholder="Ex: Salários e encargos"
                error={!!errors.nome}
              />
            </FormField>
          </div>
          <FormField label="Prioridade" hint="Menor = executada primeiro">
            <Input
              type="number"
              value={form.prioridade}
              onChange={e => set('prioridade', parseInt(e.target.value) || 0)}
            />
          </FormField>
        </div>

        {/* Tipo de transação */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Tipo de transação</label>
          <div className="flex gap-2">
            {(['QUALQUER', 'DEBITO', 'CREDITO'] as TipoTransacao[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set('tipoTransacao', t)}
                className={clsx(
                  'flex-1 py-2 text-sm font-medium rounded-lg border transition',
                  form.tipoTransacao === t
                    ? t === 'DEBITO'
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : t === 'CREDITO'
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-primary-300 bg-primary-50 text-primary-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50',
                )}
              >
                {TIPO_TX_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Campo */}
        <FormField label="Campo para verificar">
          <Select value={form.campo} onChange={e => set('campo', e.target.value as CampoRegra)}>
            {(Object.entries(CAMPO_LABELS) as [CampoRegra, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </Select>
        </FormField>

        {/* Condição e valor */}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Tipo de correspondência">
            <Select
              value={form.tipoCorrespondencia}
              onChange={e => set('tipoCorrespondencia', e.target.value as TipoCorrespondencia)}
            >
              {correspondenciasDisponiveis.map(t => (
                <option key={t} value={t}>{CORRESPONDENCIA_LABELS[t]}</option>
              ))}
            </Select>
          </FormField>

          {isValorField ? (
            <FormField label={form.tipoCorrespondencia === 'INTERVALO' ? 'Valor mínimo (R$)' : 'Valor exato (R$)'} error={errors.valorCorrespondencia}>
              <Input
                type="number"
                step="0.01"
                value={form.valorMin}
                onChange={e => set('valorMin', e.target.value)}
                placeholder="0.00"
              />
            </FormField>
          ) : (
            <FormField label="Valor a buscar" required error={errors.valorCorrespondencia}>
              <Input
                value={form.valorCorrespondencia}
                onChange={e => set('valorCorrespondencia', e.target.value)}
                placeholder={form.tipoCorrespondencia === 'REGEX' ? '^FOLHA\\s' : 'Ex: FOLHA, ADOBE, PIX'}
                error={!!errors.valorCorrespondencia}
              />
            </FormField>
          )}
        </div>

        {/* Valor máximo para INTERVALO */}
        {isValorField && form.tipoCorrespondencia === 'INTERVALO' && (
          <FormField label="Valor máximo (R$)" hint="Deixe vazio para sem limite">
            <Input
              type="number"
              step="0.01"
              value={form.valorMax}
              onChange={e => set('valorMax', e.target.value)}
              placeholder="Sem limite"
            />
          </FormField>
        )}

        {/* Preview */}
        {!isValorField && form.valorCorrespondencia && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
            Condição: <code className="font-mono">{CAMPO_LABELS[form.campo]} {CORRESPONDENCIA_LABELS[form.tipoCorrespondencia].toLowerCase()} &quot;{form.valorCorrespondencia}&quot;</code>
          </div>
        )}

        {/* Conta destino */}
        <FormField label="Classificar na conta" required error={errors.contaFinanceiraId}>
          <Select
            value={form.contaFinanceiraId}
            onChange={e => set('contaFinanceiraId', e.target.value)}
            error={!!errors.contaFinanceiraId}
          >
            <option value="">Selecione uma conta...</option>
            {contas.map(c => (
              <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
            ))}
          </Select>
        </FormField>

        {/* Ativo */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ativo"
            checked={form.ativo}
            onChange={e => set('ativo', e.target.checked)}
            className="h-4 w-4 accent-primary-600"
          />
          <label htmlFor="ativo" className="text-sm text-gray-700">Regra ativa</label>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>
            {regra ? 'Salvar alterações' : 'Criar regra'}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RegrasClassificacaoPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Regra | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null)

  const { data: regras = [], isLoading } = useQuery<Regra[]>({
    queryKey: ['regras-classificacao'],
    queryFn: () => api.get('/financeiro/regras').then(r => r.data),
  })

  const { data: contas = [] } = useQuery<ContaFinanceira[]>({
    queryKey: ['contas-flat'],
    queryFn: () => api.get('/financeiro/contas').then(r => r.data),
  })

  const contasAnaliticas = contas.filter(c => c.isAnalitica)

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post('/financeiro/regras', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regras-classificacao'] })
      setShowForm(false)
      setEditando(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => api.put(`/financeiro/regras/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regras-classificacao'] })
      setShowForm(false)
      setEditando(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/financeiro/regras/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regras-classificacao'] })
      setDeleteTarget(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      api.put(`/financeiro/regras/${id}`, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regras-classificacao'] }),
  })

  const moverPrioridade = useMutation({
    mutationFn: ({ id, prioridade }: { id: string; prioridade: number }) =>
      api.put(`/financeiro/regras/${id}`, { prioridade }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regras-classificacao'] }),
  })

  function openEdit(regra: Regra) {
    setEditando(regra)
    setShowForm(true)
  }

  function openCreate() {
    setEditando(null)
    setShowForm(true)
  }

  function handleMoveUp(regra: Regra, idx: number) {
    if (idx === 0) return
    const prev = regras[idx - 1]
    moverPrioridade.mutate({ id: regra.id, prioridade: prev.prioridade - 1 })
  }

  function handleMoveDown(regra: Regra, idx: number) {
    if (idx === regras.length - 1) return
    const next = regras[idx + 1]
    moverPrioridade.mutate({ id: regra.id, prioridade: next.prioridade + 1 })
  }

  if (showForm) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regras de Classificação</h1>
        </div>
        <RegraForm
          regra={editando}
          contas={contasAnaliticas}
          onClose={() => { setShowForm(false); setEditando(null) }}
          onSave={(data) => {
            if (editando) {
              updateMutation.mutate({ id: editando.id, data })
            } else {
              createMutation.mutate(data)
            }
          }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regras de Classificação</h1>
          <p className="text-sm text-gray-500 mt-1">Executadas em ordem de prioridade ao importar transações</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Nova Regra
        </Button>
      </div>

      {/* Info */}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-xs text-blue-700">
        <Zap size={14} className="shrink-0" />
        As regras são testadas na ordem de prioridade. A primeira que corresponder classifica a transação. Menor número = maior prioridade.
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Carregando regras...
          </div>
        ) : regras.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Zap size={24} className="text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-700">Nenhuma regra cadastrada</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm">
                Crie regras para classificar transações automaticamente ao importar extratos OFX.
              </p>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} />
              Criar primeira regra
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="w-10 px-3 py-3 text-xs text-gray-400 font-medium">Pri.</th>
                <th className="px-4 py-3 text-xs text-gray-400 font-medium">Nome</th>
                <th className="px-4 py-3 text-xs text-gray-400 font-medium">Condição</th>
                <th className="px-4 py-3 text-xs text-gray-400 font-medium">Tipo</th>
                <th className="px-4 py-3 text-xs text-gray-400 font-medium">Conta destino</th>
                <th className="px-4 py-3 text-xs text-gray-400 font-medium text-right">Matches</th>
                <th className="px-4 py-3 text-xs text-gray-400 font-medium text-center">Ativo</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {regras.map((regra, idx) => (
                <tr
                  key={regra.id}
                  className={clsx(
                    'border-b border-gray-50',
                    !regra.ativo ? 'opacity-50' : 'hover:bg-gray-50',
                  )}
                >
                  {/* Prioridade + arrows */}
                  <td className="px-2 py-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => handleMoveUp(regra, idx)}
                        disabled={idx === 0}
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <span className="text-xs font-mono text-gray-400">{regra.prioridade}</span>
                      <button
                        onClick={() => handleMoveDown(regra, idx)}
                        disabled={idx === regras.length - 1}
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{regra.nome}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                      {describeRegra(regra)}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      regra.tipoTransacao === 'DEBITO' && 'bg-red-100 text-red-700',
                      regra.tipoTransacao === 'CREDITO' && 'bg-green-100 text-green-700',
                      regra.tipoTransacao === 'QUALQUER' && 'bg-gray-100 text-gray-600',
                    )}>
                      {TIPO_TX_LABELS[regra.tipoTransacao]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {regra.contaFinanceira
                      ? `${regra.contaFinanceira.codigo} — ${regra.contaFinanceira.nome}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {regra.totalMatchs > 0 ? (
                      <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                        {regra.totalMatchs}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleMutation.mutate({ id: regra.id, ativo: !regra.ativo })}
                      title={regra.ativo ? 'Desativar' : 'Ativar'}
                      className="text-gray-400 hover:text-gray-600 transition"
                    >
                      {regra.ativo
                        ? <ToggleRight size={20} className="text-primary-600" />
                        : <ToggleLeft size={20} />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(regra)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: regra.id, nome: regra.nome })}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir regra?"
        message={deleteTarget ? `A regra "${deleteTarget.nome}" será excluída permanentemente. Transações já classificadas por ela não serão afetadas.` : ''}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
