import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ArrowLeft, ChevronRight, ChevronDown, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContaFinanceira {
  id: string
  codigo: string
  nome: string
  tipo: 'RECEITA' | 'CUSTO' | 'DESPESA' | 'NAO_OPERACIONAL'
  natureza: 'DEBITO' | 'CREDITO'
  contaPaiId: string | null
  isAnalitica: boolean
  ativo: boolean
  nivel: number
  codigoCompleto: string | null
  subcontas?: ContaFinanceira[]
}

interface FormState {
  codigo: string
  nome: string
  tipo: string
  natureza: string
  contaPaiId: string
  isAnalitica: boolean
}

// ─── Labels e Cores ───────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  RECEITA: 'Receita',
  CUSTO: 'Custo',
  DESPESA: 'Despesa',
  NAO_OPERACIONAL: 'Não Operacional',
}

const TIPO_COLORS: Record<string, string> = {
  RECEITA: 'bg-green-100 text-green-700',
  CUSTO: 'bg-red-100 text-red-700',
  DESPESA: 'bg-orange-100 text-orange-700',
  NAO_OPERACIONAL: 'bg-purple-100 text-purple-700',
}

const EMPTY_FORM: FormState = {
  codigo: '',
  nome: '',
  tipo: 'RECEITA',
  natureza: 'CREDITO',
  contaPaiId: '',
  isAnalitica: true,
}

// ─── Account Tree Node ────────────────────────────────────────────────────────

function AccountNode({
  conta,
  allContas,
  onDelete,
  depth = 0,
}: {
  conta: ContaFinanceira
  allContas: ContaFinanceira[]
  onDelete: (id: string, nome: string) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = conta.subcontas && conta.subcontas.length > 0

  return (
    <div>
      <div
        className={clsx(
          'flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 transition group',
          depth > 0 && 'ml-6',
        )}
      >
        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(e => !e)}
          className={clsx(
            'w-5 h-5 flex items-center justify-center text-gray-400',
            !hasChildren && 'invisible',
          )}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Código */}
        <span className="text-xs font-mono text-gray-400 w-24 shrink-0">
          {conta.codigoCompleto ?? conta.codigo}
        </span>

        {/* Nome */}
        <span className={clsx('flex-1 text-sm', !conta.isAnalitica && 'font-semibold text-gray-700')}>
          {conta.nome}
        </span>

        {/* Tipo badge */}
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', TIPO_COLORS[conta.tipo])}>
          {TIPO_LABELS[conta.tipo]}
        </span>

        {/* Natureza */}
        <span className="text-xs text-gray-400 w-16 text-center">
          {conta.natureza === 'CREDITO' ? 'Crédito' : 'Débito'}
        </span>

        {/* Tipo analítica/sintética */}
        <span className="text-xs text-gray-400 w-20 text-center">
          {conta.isAnalitica ? 'Analítica' : 'Sintética'}
        </span>

        {/* Delete */}
        <button
          onClick={() => onDelete(conta.id, conta.nome)}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition p-1 rounded"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {hasChildren && expanded && (
        <div>
          {conta.subcontas!.map(sub => (
            <AccountNode
              key={sub.id}
              conta={sub}
              allContas={allContas}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PlanoContasPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null)

  const { data: arvore = [], isLoading } = useQuery<ContaFinanceira[]>({
    queryKey: ['contas-arvore'],
    queryFn: () => api.get('/financeiro/contas/arvore').then(r => r.data),
  })

  const { data: contasFlat = [] } = useQuery<ContaFinanceira[]>({
    queryKey: ['contas-flat'],
    queryFn: () => api.get('/financeiro/contas').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post('/financeiro/contas', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-arvore'] })
      qc.invalidateQueries({ queryKey: ['contas-flat'] })
      setShowForm(false)
      setForm(EMPTY_FORM)
      setErrors({})
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/financeiro/contas/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-arvore'] })
      qc.invalidateQueries({ queryKey: ['contas-flat'] })
      setDeleteTarget(null)
    },
  })

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: typeof errors = {}
    if (!form.codigo.trim()) errs.codigo = 'Obrigatório'
    if (!form.nome.trim()) errs.nome = 'Obrigatório'
    if (!form.tipo) errs.tipo = 'Obrigatório'
    if (!form.natureza) errs.natureza = 'Obrigatório'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    createMutation.mutate({
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      tipo: form.tipo,
      natureza: form.natureza,
      contaPaiId: form.contaPaiId || undefined,
      isAnalitica: form.isAnalitica,
    })
  }

  if (showForm) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setErrors({}) }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Nova Conta</h1>
            <p className="text-sm text-gray-500">Adicionar ao plano de contas financeiro</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Código" required error={errors.codigo}>
                <Input
                  value={form.codigo}
                  onChange={e => set('codigo', e.target.value)}
                  placeholder="Ex: 1, 1.1, 1.1.1"
                  error={!!errors.codigo}
                />
              </FormField>
              <FormField label="Nome" required error={errors.nome}>
                <Input
                  value={form.nome}
                  onChange={e => set('nome', e.target.value)}
                  placeholder="Nome da conta"
                  error={!!errors.nome}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Tipo" required error={errors.tipo}>
                <Select
                  value={form.tipo}
                  onChange={e => set('tipo', e.target.value)}
                  error={!!errors.tipo}
                >
                  <option value="RECEITA">Receita</option>
                  <option value="CUSTO">Custo</option>
                  <option value="DESPESA">Despesa</option>
                  <option value="NAO_OPERACIONAL">Não Operacional</option>
                </Select>
              </FormField>
              <FormField label="Natureza" required error={errors.natureza}>
                <Select
                  value={form.natureza}
                  onChange={e => set('natureza', e.target.value)}
                  error={!!errors.natureza}
                >
                  <option value="CREDITO">Crédito</option>
                  <option value="DEBITO">Débito</option>
                </Select>
              </FormField>
            </div>

            <FormField label="Conta Pai (opcional)">
              <Select
                value={form.contaPaiId}
                onChange={e => set('contaPaiId', e.target.value)}
              >
                <option value="">Nenhuma (conta raiz)</option>
                {contasFlat.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.codigoCompleto ?? c.codigo} — {c.nome}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isAnalitica"
                checked={form.isAnalitica}
                onChange={e => set('isAnalitica', e.target.checked)}
                className="h-4 w-4 accent-primary-600"
              />
              <label htmlFor="isAnalitica" className="text-sm text-gray-700">
                Conta analítica (recebe lançamentos)
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setErrors({}) }}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                <Plus size={16} />
                Criar Conta
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plano de Contas</h1>
          <p className="text-sm text-gray-500 mt-1">Estrutura hierárquica de contas financeiras</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} />
          Nova Conta
        </Button>
      </div>

      {/* Legenda de colunas */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 text-xs text-gray-400 font-medium">
          <span className="w-5" />
          <span className="w-24">Código</span>
          <span className="flex-1">Nome</span>
          <span className="w-28 text-center">Tipo</span>
          <span className="w-16 text-center">Natureza</span>
          <span className="w-20 text-center">Classe</span>
          <span className="w-6" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Carregando plano de contas...
          </div>
        ) : arvore.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <p className="text-gray-500 font-medium">Nenhuma conta cadastrada</p>
            <p className="text-sm text-gray-400">Crie o plano de contas para classificar as transações financeiras.</p>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              Criar primeira conta
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 px-1 py-1">
            {arvore.map(conta => (
              <AccountNode
                key={conta.id}
                conta={conta}
                allContas={contasFlat}
                onDelete={(id, nome) => setDeleteTarget({ id, nome })}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir conta?"
        message={deleteTarget ? `A conta "${deleteTarget.nome}" será desativada. Transações já lançadas nela não serão afetadas.` : ''}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
