import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '../../lib/api'
import { Plus, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'

interface Movimentacao {
  id: string; produtoId: string; tipo: string; quantidade: number; lote?: string
  observacao?: string; criadoEm: string
  produto: { nome: string; codigo: string; unidadeMedida: string }
}

interface ProdutoSelect {
  id: string; codigo: string; nome: string; unidadeMedida: string
}

const tipoCor: Record<string, string> = {
  ENTRADA: 'bg-green-100 text-green-700',
  SAIDA: 'bg-red-100 text-red-700',
  AJUSTE: 'bg-blue-100 text-blue-700',
  PERDA: 'bg-orange-100 text-orange-700',
}

const tipoSinal: Record<string, string> = {
  ENTRADA: '+',
  SAIDA: '−',
  AJUSTE: '±',
  PERDA: '−',
}

const schema = z.object({
  produtoId: z.string().min(1, 'Selecione o produto'),
  tipo: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA']),
  quantidade: z.coerce.number().positive('Deve ser maior que 0'),
  lote: z.string().optional(),
  dataVencimento: z.string().optional(),
  observacao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function MovimentacaoForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const queryClient = useQueryClient()

  const { data: insumos = [] } = useQuery<ProdutoSelect[]>({
    queryKey: ['produtos-insumos-mov'],
    queryFn: () => Promise.all([
      api.get('/produtos', { params: { tipo: 'INSUMO' } }).then(r => r.data),
      api.get('/produtos', { params: { tipo: 'INSUMO_PRODUTO' } }).then(r => r.data),
    ]).then(([a, b]) => [...a, ...b].sort((x: ProdutoSelect, y: ProdutoSelect) => x.nome.localeCompare(y.nome))),
  })

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'ENTRADA' },
  })

  const produtoSel = insumos.find(i => i.id === watch('produtoId'))
  const tipo = watch('tipo')

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/estoque/movimentacoes', {
      ...data,
      dataVencimento: data.dataVencimento || undefined,
      lote: data.lote || undefined,
      observacao: data.observacao || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-estoque'] })
      queryClient.invalidateQueries({ queryKey: ['produtos-estoque-ip'] })
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      onSuccess()
    },
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Produto / Insumo" error={errors.produtoId?.message} required>
          <Select {...register('produtoId')} error={!!errors.produtoId}>
            <option value="">Selecione o produto...</option>
            {insumos.map(p => (
              <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Tipo de Movimentação" error={errors.tipo?.message} required>
          <Select {...register('tipo')} error={!!errors.tipo}>
            <option value="ENTRADA">Entrada — compra ou devolução</option>
            <option value="SAIDA">Saída — consumo ou venda</option>
            <option value="AJUSTE">Ajuste — acerto de inventário</option>
            <option value="PERDA">Perda — descarte ou vencimento</option>
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label={`Quantidade${produtoSel ? ` (${produtoSel.unidadeMedida})` : ''}`}
          error={errors.quantidade?.message}
          required
        >
          <Input
            {...register('quantidade')}
            type="number"
            step="0.001"
            min="0.001"
            placeholder="0.000"
            error={!!errors.quantidade}
          />
        </FormField>
        <FormField label="Lote" hint="Opcional — para rastreabilidade">
          <Input {...register('lote')} placeholder="LOT-2026-001" />
        </FormField>
      </div>

      {(tipo === 'ENTRADA') && (
        <FormField label="Data de Vencimento" hint="Opcional">
          <Input {...register('dataVencimento')} type="date" />
        </FormField>
      )}

      <FormField label="Observação">
        <Textarea {...register('observacao')} placeholder="Ex: Compra NF 1234, fornecedor X..." rows={2} />
      </FormField>

      {tipo === 'SAIDA' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          A saída manual reduz o estoque diretamente. Use para consumo não vinculado a uma Ordem de Produção.
        </div>
      )}

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          Erro ao registrar movimentação. Verifique os dados e tente novamente.
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={mutation.isPending}>Registrar</Button>
      </div>
    </form>
  )
}

export function MovimentacoesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [panelOpen, setPanelOpen] = useState(false)
  const produtoId = searchParams.get('produtoId') ?? ''
  const [filtroTipo, setFiltroTipo] = useState('')

  const { data: movs = [], isLoading } = useQuery<Movimentacao[]>({
    queryKey: ['movimentacoes', produtoId, filtroTipo],
    queryFn: () => api.get('/estoque/movimentacoes', {
      params: {
        produtoId: produtoId || undefined,
        tipo: filtroTipo || undefined,
      },
    }).then(r => r.data),
  })

  const nomeFromMovs = movs.find(m => m.produtoId === produtoId)?.produto.nome

  const { data: produtoFiltro } = useQuery<{ nome: string }>({
    queryKey: ['produto-nome', produtoId],
    queryFn: () => api.get(`/produtos/${produtoId}`).then(r => r.data),
    enabled: !!produtoId && !nomeFromMovs,
  })

  const produtoNomeFiltro = nomeFromMovs ?? produtoFiltro?.nome

  if (panelOpen) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setPanelOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Nova Movimentação</h2>
            <p className="text-xs text-gray-400">Movimentações de Estoque</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <MovimentacaoForm
            onSuccess={() => setPanelOpen(false)}
            onCancel={() => setPanelOpen(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Movimentações de Estoque</h2>
          <p className="text-gray-500 text-sm">{movs.length} registro(s)</p>
        </div>
        <button
          onClick={() => setPanelOpen(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Nova Movimentação
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        {produtoId ? (
          <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 text-sm text-primary-700">
            <span>Produto: <strong>{produtoNomeFiltro ?? '...'}</strong></span>
            <button
              onClick={() => setSearchParams({})}
              className="ml-1 text-primary-400 hover:text-primary-700 font-bold leading-none"
              title="Remover filtro"
            >×</button>
          </div>
        ) : null}
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos os tipos</option>
          <option value="ENTRADA">Entrada</option>
          <option value="SAIDA">Saída</option>
          <option value="AJUSTE">Ajuste</option>
          <option value="PERDA">Perda</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Data / Hora</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Quantidade</th>
                <th className="px-4 py-3">Lote</th>
                <th className="px-4 py-3">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {movs.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(m.criadoEm).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', tipoCor[m.tipo])}>
                      {tipoSinal[m.tipo]} {m.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{m.produto.nome}</p>
                    <p className="text-xs text-gray-400 font-mono">{m.produto.codigo}</p>
                  </td>
                  <td className={clsx(
                    'px-4 py-3 text-right font-bold tabular-nums',
                    m.tipo === 'ENTRADA' ? 'text-green-700' : 'text-red-700',
                  )}>
                    {tipoSinal[m.tipo]}{Number(m.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {m.produto.unidadeMedida}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.lote ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{m.observacao ?? '—'}</td>
                </tr>
              ))}
              {movs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
