import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Power, PowerOff, Landmark, Wallet, ExternalLink } from 'lucide-react'
import { api } from '../../lib/api'
import { FormField, Input } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import clsx from 'clsx'

interface ContaBancaria {
  id: string
  nome: string
  banco: string | null
  agencia: string | null
  conta: string | null
  isCaixa: boolean
  saldoInicial: number
  saldoAtual: number
  ativo: boolean
}

interface FormState {
  nome: string
  banco: string
  agencia: string
  conta: string
  isCaixa: boolean
  saldoInicial: string
}

const EMPTY_FORM: FormState = { nome: '', banco: '', agencia: '', conta: '', isCaixa: false, saldoInicial: '0' }

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Formulário ───────────────────────────────────────────────────────────────

function ContaForm({
  editando,
  onCancel,
  onSuccess,
}: {
  editando: ContaBancaria | null
  onCancel: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState<FormState>(
    editando
      ? { nome: editando.nome, banco: editando.banco ?? '', agencia: editando.agencia ?? '', conta: editando.conta ?? '', isCaixa: editando.isCaixa, saldoInicial: String(editando.saldoInicial) }
      : EMPTY_FORM
  )
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const mutation = useMutation({
    mutationFn: (data: object) =>
      editando ? api.put(`/financeiro/contas-bancarias/${editando.id}`, data) : api.post('/financeiro/contas-bancarias', data),
    onSuccess,
  })

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validate() {
    const errs: typeof errors = {}
    if (!form.nome.trim()) errs.nome = 'Obrigatório'
    if (isNaN(Number(form.saldoInicial))) errs.saldoInicial = 'Valor inválido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    mutation.mutate({
      nome: form.nome.trim(),
      banco: form.banco.trim() || undefined,
      agencia: form.agencia.trim() || undefined,
      conta: form.conta.trim() || undefined,
      isCaixa: form.isCaixa,
      saldoInicial: Number(form.saldoInicial),
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {editando ? 'Editar Conta' : 'Nova Conta'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input
            type="checkbox" id="isCaixa" checked={form.isCaixa}
            onChange={e => set('isCaixa', e.target.checked)}
            className="h-4 w-4 accent-primary-600"
            disabled={!!editando}
          />
          <label htmlFor="isCaixa" className="text-sm text-gray-700 cursor-pointer">
            <span className="font-medium">Caixa físico</span>
            <span className="text-gray-400 ml-1">(sem dados bancários)</span>
          </label>
        </div>

        <FormField label="Nome" required error={errors.nome}>
          <Input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder={form.isCaixa ? 'Caixa Loja' : 'Conta Corrente Itaú'} error={!!errors.nome} />
        </FormField>

        {!form.isCaixa && (
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Banco">
              <Input value={form.banco} onChange={e => set('banco', e.target.value)} placeholder="Itaú" />
            </FormField>
            <FormField label="Agência">
              <Input value={form.agencia} onChange={e => set('agencia', e.target.value)} placeholder="0001" />
            </FormField>
            <FormField label="Conta">
              <Input value={form.conta} onChange={e => set('conta', e.target.value)} placeholder="12345-6" />
            </FormField>
          </div>
        )}

        <FormField label="Saldo Inicial (R$)" error={errors.saldoInicial} hint={editando ? 'Altere via ajuste de saldo no extrato' : undefined}>
          <Input
            type="number" step="0.01" value={form.saldoInicial}
            onChange={e => set('saldoInicial', e.target.value)}
            disabled={!!editando}
            error={!!errors.saldoInicial}
          />
        </FormField>

        {mutation.isError && <p className="text-sm text-red-600">Erro ao salvar. Tente novamente.</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" loading={mutation.isPending}>
            {editando ? 'Salvar' : <><Plus size={16} /> Criar</>}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ContasBancariasPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<ContaBancaria | null>(null)
  const [mostrarInativas, setMostrarInativas] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<ContaBancaria | null>(null)

  const { data: contas = [], isLoading } = useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias', mostrarInativas],
    queryFn: () => api.get(`/financeiro/contas-bancarias${mostrarInativas ? '?mostrarInativas=true' : ''}`).then(r => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/financeiro/contas-bancarias/${id}/toggle-ativo`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contas-bancarias'] }); setToggleTarget(null) },
  })

  function handleFormSuccess() {
    qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
    setShowForm(false)
    setEditando(null)
  }

  const totalAtivo = contas.filter(c => c.ativo).reduce((acc, c) => acc + c.saldoAtual, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas Bancárias & Caixa</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie contas bancárias e caixas físicos</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={mostrarInativas} onChange={e => setMostrarInativas(e.target.checked)} className="h-4 w-4 accent-primary-600" />
            Mostrar inativas
          </label>
          <Button onClick={() => { setEditando(null); setShowForm(true) }}>
            <Plus size={16} /> Nova Conta
          </Button>
        </div>
      </div>

      {/* Saldo total */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-sm text-gray-500">Saldo total (contas ativas)</span>
        <span className={clsx('text-xl font-bold', totalAtivo >= 0 ? 'text-green-700' : 'text-red-700')}>{fmt(totalAtivo)}</span>
      </div>

      {showForm && (
        <ContaForm editando={editando} onCancel={() => { setShowForm(false); setEditando(null) }} onSuccess={handleFormSuccess} />
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : contas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-gray-500 font-medium">Nenhuma conta cadastrada</p>
          <Button size="sm" onClick={() => setShowForm(true)}><Plus size={14} /> Criar primeira conta</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contas.map(conta => (
            <div key={conta.id}
              onClick={() => { setEditando(conta); setShowForm(true) }}
              className={clsx('bg-white rounded-xl border border-gray-200 p-5 space-y-4 cursor-pointer hover:border-primary-300 hover:shadow-sm transition', !conta.ativo && 'opacity-60')}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', conta.isCaixa ? 'bg-amber-100' : 'bg-blue-100')}>
                    {conta.isCaixa ? <Wallet size={20} className="text-amber-600" /> : <Landmark size={20} className="text-blue-600" />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{conta.nome}</p>
                    {!conta.isCaixa && conta.banco && (
                      <p className="text-xs text-gray-400">{conta.banco}{conta.agencia ? ` • Ag ${conta.agencia}` : ''}{conta.conta ? ` • CC ${conta.conta}` : ''}</p>
                    )}
                    {!conta.ativo && <span className="text-xs text-red-500 font-medium">Inativa</span>}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Saldo atual</p>
                <p className={clsx('text-xl font-bold', conta.saldoAtual >= 0 ? 'text-green-700' : 'text-red-700')}>{fmt(conta.saldoAtual)}</p>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/financeiro/extrato/${conta.id}`) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium transition"
                >
                  <ExternalLink size={13} /> Ver Extrato
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setEditando(conta); setShowForm(true) }}
                  className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setToggleTarget(conta) }}
                  className={clsx('p-1.5 rounded transition', conta.ativo ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-green-600')}
                  title={conta.ativo ? 'Inativar' : 'Reativar'}
                >
                  {conta.ativo ? <PowerOff size={14} /> : <Power size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toggleTarget}
        title={toggleTarget?.ativo ? 'Inativar conta?' : 'Reativar conta?'}
        message={toggleTarget ? `A conta "${toggleTarget.nome}" será ${toggleTarget.ativo ? 'inativada' : 'reativada'}.` : ''}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Reativar'}
        variant={toggleTarget?.ativo ? 'danger' : 'default'}
        onConfirm={() => toggleTarget && toggleMutation.mutate(toggleTarget.id)}
        onCancel={() => setToggleTarget(null)}
        loading={toggleMutation.isPending}
      />
    </div>
  )
}
