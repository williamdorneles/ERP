import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, UserRound, Pencil, PowerOff, Power, Trash2, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormField, Input } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { Form } from '../../components/ui/Form'

interface Vendedor {
  id: string
  codigo: string
  nome: string
  documento?: string | null
  email?: string | null
  telefone?: string | null
  comissaoPadrao?: number | string | null
  ativo: boolean
}

const schema = z.object({
  nome: z.string().min(2, 'Obrigatório').max(120),
  documento: z.string().optional(),
  email: z.string().optional(),
  telefone: z.string().optional(),
  comissaoPadrao: z.coerce.number().min(0).max(100).optional(),
})
type FormData = z.infer<typeof schema>

const numOrUndef = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === '' ? undefined : Number(v)

function VendedorForm({ initialData, onSuccess, onCancel }: {
  initialData?: Vendedor; onSuccess: () => void; onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const isEditing = !!initialData

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData ? {
      nome: initialData.nome,
      documento: initialData.documento ?? '',
      email: initialData.email ?? '',
      telefone: initialData.telefone ?? '',
      comissaoPadrao: numOrUndef(initialData.comissaoPadrao),
    } : {},
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const s = (v?: string) => (v && v.trim() ? v.trim() : undefined)
      const payload = {
        nome: data.nome,
        documento: s(data.documento),
        email: s(data.email),
        telefone: s(data.telefone),
        comissaoPadrao: data.comissaoPadrao,
      }
      return isEditing
        ? api.put(`/vendedores/${initialData.id}`, payload)
        : api.post('/vendedores', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] })
      onSuccess()
    },
  })

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <FormField label="Nome do vendedor" error={errors.nome?.message} required>
        <Input {...register('nome')} placeholder="Nome completo" error={!!errors.nome} autoFocus />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="CPF" error={errors.documento?.message}>
          <Input {...register('documento')} placeholder="000.000.000-00" />
        </FormField>
        <FormField label="Comissão padrão (%)" error={errors.comissaoPadrao?.message}>
          <Input {...register('comissaoPadrao')} type="number" step="0.01" min="0" max="100" placeholder="0" />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="E-mail" error={errors.email?.message}>
          <Input {...register('email')} type="email" placeholder="email@exemplo.com" />
        </FormField>
        <FormField label="Telefone" error={errors.telefone?.message}>
          <Input {...register('telefone')} placeholder="(00) 00000-0000" />
        </FormField>
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error
            ?? 'Erro ao salvar. Verifique os dados e tente novamente.'}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={mutation.isPending}>{isEditing ? 'Salvar Alterações' : 'Salvar'}</Button>
      </div>
    </Form>
  )
}

export function VendedoresPage() {
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editando, setEditando] = useState<Vendedor | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Vendedor | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState<Vendedor | null>(null)
  const [erro, setErro] = useState('')

  const { data: vendedores = [], isLoading } = useQuery<Vendedor[]>({
    queryKey: ['vendedores'],
    queryFn: () => api.get('/vendedores').then(r => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/vendedores/${id}/toggle-ativo`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendedores'] }); setConfirmToggle(null) },
  })

  const excluirMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vendedores/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendedores'] }); setConfirmExcluir(null); setErro('') },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      setErro(e.response?.data?.error ?? 'Erro ao excluir.'); setConfirmExcluir(null)
    },
  })

  const filtrados = vendedores.filter(v => {
    if (!mostrarInativos && !v.ativo) return false
    if (busca) {
      const q = busca.toLowerCase()
      if (!v.nome.toLowerCase().includes(q) && !(v.documento ?? '').includes(busca) && !v.codigo.includes(busca)) return false
    }
    return true
  })

  function fechar() { setPanelOpen(false); setEditando(null) }

  if (panelOpen) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={fechar} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600"><ArrowLeft size={18} /></button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{editando ? `Editar — ${editando.nome}` : 'Novo Vendedor'}</h2>
            <p className="text-xs text-gray-400">Vendedores</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
          <VendedorForm initialData={editando ?? undefined} onSuccess={fechar} onCancel={fechar} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vendedores</h2>
          <p className="text-gray-500 text-sm">{vendedores.length} cadastrado(s) · cadastro próprio, independente dos usuários do sistema</p>
        </div>
        <button onClick={() => { setEditando(null); setPanelOpen(true) }}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> Novo Vendedor
        </button>
      </div>

      {erro && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>}

      <div className="flex flex-wrap gap-3">
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, CPF ou código..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[360px]" />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          Mostrar inativos
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center">
            <UserRound size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Nenhum vendedor encontrado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-16">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3 text-right">Comissão</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(v => (
                <tr key={v.id} onClick={() => { setEditando(v); setPanelOpen(true) }}
                  className={clsx('hover:bg-gray-50 cursor-pointer transition', !v.ativo && 'opacity-50')}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{v.codigo}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{v.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{v.documento || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {v.telefone || v.email ? (
                      <span>{v.telefone}{v.telefone && v.email ? ' · ' : ''}{v.email}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {v.comissaoPadrao != null && Number(v.comissaoPadrao) > 0 ? `${Number(v.comissaoPadrao)}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', v.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                      {v.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={e => { e.stopPropagation(); setEditando(v); setPanelOpen(true) }} title="Editar"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition"><Pencil size={14} /></button>
                      <button onClick={e => { e.stopPropagation(); setConfirmToggle(v) }} title={v.ativo ? 'Desativar' : 'Reativar'}
                        className={clsx('p-1.5 rounded-lg transition', v.ativo ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50')}>
                        {v.ativo ? <PowerOff size={14} /> : <Power size={14} />}
                      </button>
                      <button onClick={e => { e.stopPropagation(); setErro(''); setConfirmExcluir(v) }} title="Excluir"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.ativo ? 'Desativar Vendedor' : 'Reativar Vendedor'}
        message={confirmToggle?.ativo
          ? `Deseja desativar "${confirmToggle?.nome}"? Ele não aparecerá mais na seleção do pedido.`
          : `Deseja reativar "${confirmToggle?.nome}"?`}
        confirmLabel={confirmToggle?.ativo ? 'Desativar' : 'Reativar'}
        variant={confirmToggle?.ativo ? 'danger' : 'warning'}
        loading={toggleMutation.isPending}
        onConfirm={() => confirmToggle && toggleMutation.mutate(confirmToggle.id)}
        onCancel={() => setConfirmToggle(null)}
      />

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir Vendedor"
        message={`Deseja excluir permanentemente "${confirmExcluir?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={excluirMutation.isPending}
        onConfirm={() => confirmExcluir && excluirMutation.mutate(confirmExcluir.id)}
        onCancel={() => setConfirmExcluir(null)}
      />
    </div>
  )
}
