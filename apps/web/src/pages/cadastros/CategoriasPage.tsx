import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Tag, Pencil, PowerOff, Power, Trash2, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormField, Input } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { Form } from '../../components/ui/Form'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Categoria {
  id: string
  nome: string
  ativo: boolean
  criadoEm: string
  _count: { produtos: number }
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres'),
})

type FormData = z.infer<typeof schema>

// ─── Formulário ───────────────────────────────────────────────────────────────

function CategoriaForm({
  initialData,
  onSuccess,
  onCancel,
}: {
  initialData?: Categoria
  onSuccess: () => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const isEditing = !!initialData

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData ? { nome: initialData.nome } : {},
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEditing
        ? api.put(`/categorias/${initialData.id}`, data)
        : api.post('/categorias', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
      onSuccess()
    },
  })

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <FormField label="Nome da Categoria" error={errors.nome?.message} required>
        <Input
          {...register('nome')}
          placeholder="Ex: Farinha, Pão, Recheio..."
          error={!!errors.nome}
          autoFocus
        />
      </FormField>

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error
            ?? 'Erro ao salvar. Verifique os dados e tente novamente.'}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={mutation.isPending}>
          {isEditing ? 'Salvar Alterações' : 'Salvar'}
        </Button>
      </div>
    </Form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CategoriasPage() {
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Categoria | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState<Categoria | null>(null)
  const [erroExcluir, setErroExcluir] = useState('')

  const { data: categorias = [], isLoading } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then(r => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/categorias/${id}/toggle-ativo`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
      setConfirmToggle(null)
    },
  })

  const excluirMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categorias/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
      setConfirmExcluir(null)
      setErroExcluir('')
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      setErroExcluir(e.response?.data?.error ?? 'Erro ao excluir categoria.')
      setConfirmExcluir(null)
    },
  })

  const categoriasFiltradas = categorias.filter(c => {
    if (!mostrarInativos && !c.ativo) return false
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  function fechar() {
    setPanelOpen(false)
    setEditando(null)
  }

  if (panelOpen) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={fechar} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {editando ? `Editar — ${editando.nome}` : 'Nova Categoria'}
            </h2>
            <p className="text-xs text-gray-400">Categorias</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
          <CategoriaForm
            initialData={editando ?? undefined}
            onSuccess={fechar}
            onCancel={fechar}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Categorias</h2>
          <p className="text-gray-500 text-sm">{categorias.length} categoria(s) cadastrada(s)</p>
        </div>
        <button
          onClick={() => { setEditando(null); setPanelOpen(true) }}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Nova Categoria
        </button>
      </div>

      {erroExcluir && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {erroExcluir}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[400px]"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mostrarInativos}
            onChange={e => setMostrarInativos(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Mostrar inativas
        </label>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : categoriasFiltradas.length === 0 ? (
          <div className="p-12 text-center">
            <Tag size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Nenhuma categoria encontrada.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Produtos</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categoriasFiltradas.map(c => (
                <tr
                  key={c.id}
                  onClick={() => { setEditando(c); setPanelOpen(true) }}
                  className={clsx(
                    'hover:bg-gray-50 cursor-pointer transition',
                    !c.ativo && 'opacity-50',
                  )}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.nome}
                    {!c.ativo && <span className="ml-2 text-xs text-red-400 font-normal">inativa</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums">
                    {c._count.produtos > 0
                      ? <span className="text-gray-700">{c._count.produtos}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      c.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500',
                    )}>
                      {c.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); setEditando(c); setPanelOpen(true) }}
                        title="Editar"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmToggle(c) }}
                        title={c.ativo ? 'Desativar' : 'Reativar'}
                        className={clsx(
                          'p-1.5 rounded-lg transition',
                          c.ativo
                            ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50',
                        )}
                      >
                        {c.ativo ? <PowerOff size={14} /> : <Power size={14} />}
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setErroExcluir('')
                          setConfirmExcluir(c)
                        }}
                        title="Excluir"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
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
        open={!!confirmToggle}
        title={confirmToggle?.ativo ? 'Desativar Categoria' : 'Reativar Categoria'}
        message={
          confirmToggle?.ativo
            ? `Deseja desativar "${confirmToggle?.nome}"? Ela não aparecerá mais nos formulários.`
            : `Deseja reativar "${confirmToggle?.nome}"?`
        }
        confirmLabel={confirmToggle?.ativo ? 'Desativar' : 'Reativar'}
        variant={confirmToggle?.ativo ? 'danger' : 'warning'}
        loading={toggleMutation.isPending}
        onConfirm={() => confirmToggle && toggleMutation.mutate(confirmToggle.id)}
        onCancel={() => setConfirmToggle(null)}
      />

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir Categoria"
        message={
          confirmExcluir && confirmExcluir._count.produtos > 0
            ? `Deseja excluir "${confirmExcluir.nome}"? Os ${confirmExcluir._count.produtos} produto(s) vinculados ficarão sem categoria.`
            : `Deseja excluir permanentemente "${confirmExcluir?.nome}"? Esta ação não pode ser desfeita.`
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={excluirMutation.isPending}
        onConfirm={() => confirmExcluir && excluirMutation.mutate(confirmExcluir.id)}
        onCancel={() => setConfirmExcluir(null)}
      />
    </div>
  )
}
