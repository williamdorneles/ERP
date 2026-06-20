import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '../../lib/api'
import { AlertTriangle, TrendingDown, TrendingUp, Minus, Plus, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { Form } from '../../components/ui/Form'

interface Produto {
  id: string; codigo: string; nome: string
  tipo: string; unidadeMedida: string; categoria?: string
  estoqueAtual: number; estoqueMinimo: number; custoUnitario: number
}

interface Movimentacao {
  id: string; produtoId: string; tipo: string; quantidade: number; lote?: string
  observacao?: string; criadoEm: string
  produto: { nome: string; codigo: string; unidadeMedida: string }
}

const prodTipoCor: Record<string, string> = {
  INSUMO: 'bg-blue-100 text-blue-700',
  INSUMO_PRODUTO: 'bg-purple-100 text-purple-700',
  PRODUTO_ACABADO: 'bg-green-100 text-green-700',
}

const prodTipoLabel: Record<string, string> = {
  INSUMO: 'Insumo',
  INSUMO_PRODUTO: 'Insumo + Produto',
  PRODUTO_ACABADO: 'Produto Acabado',
}

const movTipoCor: Record<string, string> = {
  ENTRADA: 'bg-green-100 text-green-700',
  SAIDA: 'bg-red-100 text-red-700',
  AJUSTE: 'bg-blue-100 text-blue-700',
  PERDA: 'bg-orange-100 text-orange-700',
}

const movSinal: Record<string, string> = {
  ENTRADA: '+',
  SAIDA: '−',
  AJUSTE: '±',
  PERDA: '−',
}

const movSchema = z.object({
  produtoId: z.string().min(1, 'Selecione o produto'),
  tipo: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA']),
  quantidade: z.coerce.number().positive('Deve ser maior que 0'),
  lote: z.string().optional(),
  dataVencimento: z.string().optional(),
  observacao: z.string().optional(),
})
type MovFormData = z.infer<typeof movSchema>

function MovimentacaoForm({
  onSuccess,
  onCancel,
  defaultProdutoId,
  produtos,
}: {
  onSuccess: () => void
  onCancel: () => void
  defaultProdutoId?: string
  produtos: Produto[]
}) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<MovFormData>({
    resolver: zodResolver(movSchema),
    defaultValues: { tipo: 'ENTRADA', produtoId: defaultProdutoId ?? '' },
  })

  const produtoSel = produtos.find(p => p.id === watch('produtoId'))
  const tipo = watch('tipo')

  const mutation = useMutation({
    mutationFn: (data: MovFormData) => api.post('/estoque/movimentacoes', {
      ...data,
      dataVencimento: data.dataVencimento || undefined,
      lote: data.lote || undefined,
      observacao: data.observacao || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-estoque'] })
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] })
      onSuccess()
    },
  })

  const produtosOrdenados = [...produtos].sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Produto / Insumo" error={errors.produtoId?.message} required>
          {defaultProdutoId ? (
            <>
              <input type="hidden" {...register('produtoId')} />
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-800">
                {produtos.find(p => p.id === defaultProdutoId)?.nome ?? '—'}
              </div>
            </>
          ) : (
            <Select {...register('produtoId')} error={!!errors.produtoId}>
              <option value="">Selecione o produto...</option>
              {produtosOrdenados.map(p => (
                <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>
              ))}
            </Select>
          )}
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

      {tipo === 'ENTRADA' && (
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
    </Form>
  )
}

function StatusEstoque({ atual, minimo }: { atual: number; minimo: number }) {
  if (atual <= 0) return (
    <div className="flex items-center gap-1.5 text-red-600 font-medium text-xs">
      <TrendingDown size={14} /> Zerado
    </div>
  )
  if (atual <= minimo) return (
    <div className="flex items-center gap-1.5 text-amber-600 font-medium text-xs">
      <AlertTriangle size={14} /> Abaixo do mínimo
    </div>
  )
  if (atual <= minimo * 1.5) return (
    <div className="flex items-center gap-1.5 text-yellow-600 font-medium text-xs">
      <Minus size={14} /> Atenção
    </div>
  )
  return (
    <div className="flex items-center gap-1.5 text-green-600 font-medium text-xs">
      <TrendingUp size={14} /> Normal
    </div>
  )
}

function BarraEstoque({ atual, minimo }: { atual: number; minimo: number }) {
  if (minimo === 0) return <div className="text-xs text-gray-400">Sem mínimo</div>
  const pct = Math.min((atual / (minimo * 2)) * 100, 100)
  const cor = atual <= 0 ? 'bg-red-500' : atual <= minimo ? 'bg-amber-500' : atual <= minimo * 1.5 ? 'bg-yellow-400' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={clsx('h-2 rounded-full transition-all', cor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-6 text-right">{Math.round(pct)}%</span>
    </div>
  )
}

type View = 'posicao' | 'movimentacoes' | 'nova-mov'

export function PosicaoEstoquePage() {
  const [view, setView] = useState<View>('posicao')
  const [produtoSel, setProdutoSel] = useState<Produto | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroAlerta, setFiltroAlerta] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')

  const { data: produtos = [], isLoading } = useQuery<Produto[]>({
    queryKey: ['produtos-estoque'],
    queryFn: () => api.get('/produtos', { params: { mostrarInativos: false } })
      .then(r => (r.data as Produto[]).filter(p => p.tipo !== 'SERVICO')),
  })

  const { data: movs = [], isLoading: loadingMovs } = useQuery<Movimentacao[]>({
    queryKey: ['movimentacoes', produtoSel?.id, filtroTipo],
    queryFn: () => api.get('/estoque/movimentacoes', {
      params: { produtoId: produtoSel?.id, tipo: filtroTipo || undefined },
    }).then(r => r.data),
    enabled: !!produtoSel,
  })

  function abrirProduto(p: Produto) {
    setProdutoSel(p)
    setFiltroTipo('')
    setView('movimentacoes')
  }

  function voltarParaPosicao() {
    setView('posicao')
    setProdutoSel(null)
  }

  /* ── Formulário de nova movimentação ────────────────────────── */

  if (view === 'nova-mov') {
    const voltarApos = produtoSel ? 'movimentacoes' : 'posicao'
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView(voltarApos as View)}
            className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Nova Movimentação</h2>
            <p className="text-xs text-gray-400">
              {produtoSel ? produtoSel.nome : 'Estoque'}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
          <MovimentacaoForm
            defaultProdutoId={produtoSel?.id}
            produtos={produtos}
            onSuccess={() => setView(voltarApos as View)}
            onCancel={() => setView(voltarApos as View)}
          />
        </div>
      </div>
    )
  }

  /* ── Movimentações do produto selecionado ───────────────────── */

  if (view === 'movimentacoes' && produtoSel) {
    const atual = Number(produtoSel.estoqueAtual)
    const minimo = Number(produtoSel.estoqueMinimo)
    const emAlerta = atual <= minimo

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={voltarParaPosicao} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{produtoSel.nome}</h2>
            <p className="text-xs text-gray-400">Posição de Estoque › Movimentações</p>
          </div>
          <button
            onClick={() => setView('nova-mov')}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} /> Registrar Movimentação
          </button>
        </div>

        {/* Card do produto */}
        <div className={clsx(
          'bg-white rounded-xl border p-5',
          emAlerta ? 'border-amber-300' : 'border-gray-200',
        )}>
          <div className="grid grid-cols-5 gap-4 items-center">
            <div>
              <p className="text-xs text-gray-500 mb-1">Código</p>
              <p className="font-mono text-sm font-bold text-gray-700">{produtoSel.codigo}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Tipo</p>
              <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', prodTipoCor[produtoSel.tipo])}>
                {prodTipoLabel[produtoSel.tipo]}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Estoque Atual</p>
              <p className={clsx('font-bold tabular-nums', emAlerta ? 'text-amber-700' : 'text-gray-900')}>
                {atual.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {produtoSel.unidadeMedida}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Estoque Mínimo</p>
              <p className="text-sm tabular-nums text-gray-600">
                {minimo.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {produtoSel.unidadeMedida}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <StatusEstoque atual={atual} minimo={minimo} />
            </div>
          </div>
          {minimo > 0 && (
            <div className="mt-4">
              <BarraEstoque atual={atual} minimo={minimo} />
            </div>
          )}
        </div>

        {/* Filtro tipo */}
        <div className="flex gap-3 items-center">
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
          <span className="text-sm text-gray-400">{movs.length} registro(s)</span>
        </div>

        {/* Tabela de movimentações */}
        <div className="bg-white rounded-xl border border-gray-200">
          {loadingMovs ? (
            <div className="p-8 text-center text-gray-400">Carregando...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Tipo</th>
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
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', movTipoCor[m.tipo])}>
                        {movSinal[m.tipo]} {m.tipo}
                      </span>
                    </td>
                    <td className={clsx(
                      'px-4 py-3 text-right font-bold tabular-nums',
                      m.tipo === 'ENTRADA' ? 'text-green-700' : 'text-red-700',
                    )}>
                      {movSinal[m.tipo]}{Number(m.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {m.produto.unidadeMedida}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.lote ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-sm truncate">{m.observacao ?? '—'}</td>
                  </tr>
                ))}
                {movs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      Nenhuma movimentação registrada para este produto.
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

  /* ── Posição de Estoque (view principal) ────────────────────── */

  const filtrados = produtos.filter(p => {
    const matchBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase()) || p.codigo.includes(busca)
    const matchAlerta = !filtroAlerta || Number(p.estoqueAtual) <= Number(p.estoqueMinimo)
    return matchBusca && matchAlerta
  }).sort((a, b) => {
    const aAlert = Number(a.estoqueAtual) <= Number(a.estoqueMinimo)
    const bAlert = Number(b.estoqueAtual) <= Number(b.estoqueMinimo)
    if (aAlert && !bAlert) return -1
    if (!aAlert && bAlert) return 1
    return a.nome.localeCompare(b.nome)
  })

  const totaisAlerta = produtos.filter(p => Number(p.estoqueAtual) <= Number(p.estoqueMinimo)).length
  const zerados = produtos.filter(p => Number(p.estoqueAtual) <= 0).length
  const valorTotal = produtos.reduce((acc, p) => acc + Number(p.estoqueAtual) * Number(p.custoUnitario), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Posição de Estoque</h2>
          <p className="text-gray-500 text-sm">{produtos.length} produto(s) monitorado(s)</p>
        </div>
        <button
          onClick={() => { setProdutoSel(null); setView('nova-mov') }}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Nova Movimentação
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Valor em Estoque</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
            R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">custo total dos produtos</p>
        </div>
        <div className={clsx('bg-white rounded-xl border p-4', totaisAlerta > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200')}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Abaixo do Mínimo</p>
          <p className={clsx('text-2xl font-bold mt-1', totaisAlerta > 0 ? 'text-amber-600' : 'text-gray-900')}>
            {totaisAlerta}
          </p>
          <p className="text-xs text-gray-400 mt-1">produto(s) em alerta</p>
        </div>
        <div className={clsx('bg-white rounded-xl border p-4', zerados > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200')}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Zerados</p>
          <p className={clsx('text-2xl font-bold mt-1', zerados > 0 ? 'text-red-600' : 'text-gray-900')}>
            {zerados}
          </p>
          <p className="text-xs text-gray-400 mt-1">produto(s) sem estoque</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center flex-wrap">
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou código..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[240px]"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filtroAlerta}
            onChange={e => setFiltroAlerta(e.target.checked)}
            className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
          />
          Apenas em alerta
        </label>
        <span className="text-sm text-gray-400 ml-auto">{filtrados.length} produto(s)</span>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Nenhum produto encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Estoque Atual</th>
                <th className="px-4 py-3 text-right">Mínimo</th>
                <th className="px-4 py-3 w-40">Nível</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(p => {
                const atual = Number(p.estoqueAtual)
                const minimo = Number(p.estoqueMinimo)
                const emAlerta = atual <= minimo
                return (
                  <tr
                    key={p.id}
                    onClick={() => abrirProduto(p)}
                    className={clsx(
                      'hover:bg-primary-50 transition cursor-pointer',
                      atual <= 0 && 'bg-red-50/40',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.codigo}</td>
                    <td className="px-4 py-3">
                      <p className={clsx('font-medium', emAlerta ? 'text-gray-900' : 'text-gray-800')}>
                        {emAlerta && <AlertTriangle size={12} className="inline mr-1 text-amber-500" />}
                        {p.nome}
                      </p>
                      {p.categoria && <p className="text-xs text-gray-400">{p.categoria}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', prodTipoCor[p.tipo] ?? 'bg-gray-100 text-gray-600')}>
                        {prodTipoLabel[p.tipo] ?? p.tipo}
                      </span>
                    </td>
                    <td className={clsx(
                      'px-4 py-3 text-right font-bold tabular-nums',
                      atual <= 0 ? 'text-red-600' : emAlerta ? 'text-amber-600' : 'text-gray-800',
                    )}>
                      {atual.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {p.unidadeMedida}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums text-xs">
                      {minimo.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {p.unidadeMedida}
                    </td>
                    <td className="px-4 py-3">
                      <BarraEstoque atual={atual} minimo={minimo} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums text-xs">
                      R$ {(atual * Number(p.custoUnitario)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusEstoque atual={atual} minimo={minimo} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
