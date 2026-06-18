import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Package, Pencil, PowerOff, Power, AlertTriangle, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormField, Input, Select, CurrencyInput } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Produto {
  id: string; codigo: string; nome: string
  tipo: 'INSUMO' | 'PRODUTO_ACABADO' | 'INSUMO_PRODUTO'
  categoria?: string; ativo: boolean
  unidadeMedida: string; estoqueAtual: number; estoqueMinimo: number; custoUnitario: number
  precoVenda?: number
  ncm?: string; cfop?: string; csosn?: string; origem: number
  cstPIS?: string; cstCOFINS?: string; pICMS?: number; pPIS?: number; pCOFINS?: number
  unidadeComercial?: string; gtin?: string
}

// ─── Schema do formulário ─────────────────────────────────────────────────────

const schema = z.object({
  tipo: z.enum(['INSUMO', 'PRODUTO_ACABADO', 'INSUMO_PRODUTO']),
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  categoria: z.string().optional(),
  unidadeMedida: z.enum(['KG', 'G', 'L', 'ML', 'UN', 'CX', 'PCT']),
  estoqueMinimo: z.coerce.number().min(0),
  custoUnitario: z.coerce.number().min(0),
  precoVenda: z.coerce.number().min(0).optional(),
  ncm: z.string().max(8).optional(),
  cfop: z.string().max(4).optional(),
  origem: z.coerce.number().min(0).max(8),
  csosn: z.string().optional(),
  cstPIS: z.string().optional(),
  cstCOFINS: z.string().optional(),
  pICMS: z.coerce.number().min(0).optional(),
  pPIS: z.coerce.number().min(0).optional(),
  pCOFINS: z.coerce.number().min(0).optional(),
  unidadeComercial: z.string().max(6).optional(),
  gtin: z.string().max(14).optional(),
})

type FormData = z.infer<typeof schema>

// ─── Badges ───────────────────────────────────────────────────────────────────

const tipoCor: Record<string, string> = {
  INSUMO: 'bg-blue-100 text-blue-700',
  PRODUTO_ACABADO: 'bg-emerald-100 text-emerald-700',
  INSUMO_PRODUTO: 'bg-purple-100 text-purple-700',
}

const tipoLabel: Record<string, string> = {
  INSUMO: 'Insumo',
  PRODUTO_ACABADO: 'Produto',
  INSUMO_PRODUTO: 'Insumo + Produto',
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function ProdutoForm({
  initialData,
  onSuccess,
  onCancel,
}: {
  initialData?: Produto
  onSuccess: () => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const isEditing = !!initialData
  const [aba, setAba] = useState<'geral' | 'fiscal'>('geral')

  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData
      ? {
          tipo: initialData.tipo,
          nome: initialData.nome,
          categoria: initialData.categoria ?? '',
          unidadeMedida: initialData.unidadeMedida as FormData['unidadeMedida'],
          estoqueMinimo: Number(initialData.estoqueMinimo),
          custoUnitario: Number(initialData.custoUnitario),
          precoVenda: initialData.precoVenda ? Number(initialData.precoVenda) : undefined,
          ncm: initialData.ncm ?? '',
          cfop: initialData.cfop ?? '',
          origem: initialData.origem ?? 0,
          csosn: initialData.csosn ?? '',
          cstPIS: initialData.cstPIS ?? '',
          cstCOFINS: initialData.cstCOFINS ?? '',
          pICMS: initialData.pICMS ? Number(initialData.pICMS) : undefined,
          pPIS: initialData.pPIS ? Number(initialData.pPIS) : undefined,
          pCOFINS: initialData.pCOFINS ? Number(initialData.pCOFINS) : undefined,
          unidadeComercial: initialData.unidadeComercial ?? '',
          gtin: initialData.gtin ?? '',
        }
      : {
          tipo: 'INSUMO',
          unidadeMedida: 'KG',
          estoqueMinimo: 0,
          custoUnitario: 0,
          origem: 0,
        },
  })

  const tipo = watch('tipo')
  const mostraEstoque = tipo === 'INSUMO' || tipo === 'INSUMO_PRODUTO'
  const mostraVenda = tipo === 'PRODUTO_ACABADO' || tipo === 'INSUMO_PRODUTO'

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        precoVenda: data.precoVenda || undefined,
        ncm: data.ncm || undefined,
        cfop: data.cfop || undefined,
        csosn: data.csosn || undefined,
        cstPIS: data.cstPIS || undefined,
        cstCOFINS: data.cstCOFINS || undefined,
        unidadeComercial: data.unidadeComercial || undefined,
        gtin: data.gtin || undefined,
      }
      return isEditing
        ? api.put(`/produtos/${initialData.id}`, payload)
        : api.post('/produtos', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      onSuccess()
    },
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-0 -mt-1">
        {(['geral', 'fiscal'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setAba(t)}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
              aba === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t === 'geral' ? 'Dados Gerais' : 'Dados Fiscais'}
          </button>
        ))}
      </div>

      {aba === 'geral' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Código">
              <input
                readOnly
                value={initialData?.codigo ?? ''}
                placeholder="Gerado automaticamente"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-500 cursor-default select-none"
              />
            </FormField>
            <FormField label="Tipo" error={errors.tipo?.message} required>
              <Select {...register('tipo')}>
                <option value="INSUMO">Insumo (matéria-prima / ingrediente)</option>
                <option value="PRODUTO_ACABADO">Produto Acabado (para venda)</option>
                <option value="INSUMO_PRODUTO">Insumo + Produto (ingrediente e venda)</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Nome" error={errors.nome?.message} required>
            <Input {...register('nome')} placeholder="Ex: Farinha de Trigo" error={!!errors.nome} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Categoria">
              <Select {...register('categoria')}>
                <option value="">Sem categoria</option>
                {mostraEstoque && (
                  <optgroup label="Insumos">
                    <option value="FARINHA">Farinha</option>
                    <option value="GORDURA">Gordura</option>
                    <option value="ACUCAR">Açúcar</option>
                    <option value="FERMENTO">Fermento</option>
                    <option value="LATICINIOS">Laticínios</option>
                    <option value="OVOS">Ovos</option>
                    <option value="EMBALAGEM">Embalagem</option>
                  </optgroup>
                )}
                {mostraVenda && (
                  <optgroup label="Produtos Acabados">
                    <option value="PAO">Pão</option>
                    <option value="BOLO">Bolo</option>
                    <option value="DOCE">Doce</option>
                    <option value="SALGADO">Salgado</option>
                    <option value="MASSA">Massa</option>
                    <option value="RECHEIO">Recheio</option>
                  </optgroup>
                )}
                <option value="OUTROS">Outros</option>
              </Select>
            </FormField>
            <FormField label="Unidade de Medida" error={errors.unidadeMedida?.message} required>
              <Select {...register('unidadeMedida')}>
                <option value="KG">KG — Quilograma</option>
                <option value="G">G — Grama</option>
                <option value="L">L — Litro</option>
                <option value="ML">ML — Mililitro</option>
                <option value="UN">UN — Unidade</option>
                <option value="CX">CX — Caixa</option>
                <option value="PCT">PCT — Pacote</option>
              </Select>
            </FormField>
          </div>

          {mostraEstoque && (
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Estoque Mínimo" error={errors.estoqueMinimo?.message}>
                <Input {...register('estoqueMinimo')} type="number" step="0.001" min="0" placeholder="0" />
              </FormField>
              <FormField label="Custo Unitário" error={errors.custoUnitario?.message}>
                <Controller control={control} name="custoUnitario" render={({ field }) => (
                  <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} decimals={4} error={!!errors.custoUnitario} />
                )} />
              </FormField>
            </div>
          )}

          {mostraVenda && (
            <FormField label="Preço de Venda" error={errors.precoVenda?.message}>
              <Controller control={control} name="precoVenda" render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={!!errors.precoVenda} />
              )} />
            </FormField>
          )}
        </>
      )}

      {aba === 'fiscal' && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
            Dados necessários para emissão de NF-e. NCM e CFOP são obrigatórios para faturamento.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="NCM" hint="8 dígitos — ex: 19059090 (outros pães)">
              <Input {...register('ncm')} placeholder="19059090" maxLength={8} />
            </FormField>
            <FormField label="CFOP" hint="Natureza da operação">
              <Select {...register('cfop')}>
                <option value="">Selecione...</option>
                <option value="5101">5101 — Venda prod. de fabricação própria (estadual)</option>
                <option value="5102">5102 — Venda de mercadoria adquirida (estadual)</option>
                <option value="6101">6101 — Venda prod. de fabricação própria (interestadual)</option>
                <option value="6102">6102 — Venda de mercadoria adquirida (interestadual)</option>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Origem da Mercadoria">
              <Select {...register('origem')}>
                <option value={0}>0 — Nacional</option>
                <option value={1}>1 — Estrangeira (importação direta)</option>
                <option value={2}>2 — Estrangeira (adquirida no mercado interno)</option>
              </Select>
            </FormField>
            <FormField label="CSOSN (Simples Nacional)">
              <Select {...register('csosn')}>
                <option value="">Não se aplica</option>
                <option value="102">102 — Tributada sem permissão de crédito</option>
                <option value="400">400 — Não tributada (Simples Nacional)</option>
                <option value="500">500 — ICMS cobrado por substituição ou monofásico</option>
                <option value="900">900 — Outras (Simples Nacional)</option>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="CST PIS">
              <Select {...register('cstPIS')}>
                <option value="">Selecione...</option>
                <option value="07">07 — Operação isenta da contribuição</option>
                <option value="49">49 — Outras operações de saída</option>
                <option value="01">01 — Operação tributável (alíquota básica)</option>
              </Select>
            </FormField>
            <FormField label="CST COFINS">
              <Select {...register('cstCOFINS')}>
                <option value="">Selecione...</option>
                <option value="07">07 — Operação isenta da contribuição</option>
                <option value="49">49 — Outras operações de saída</option>
                <option value="01">01 — Operação tributável (alíquota básica)</option>
              </Select>
            </FormField>
            <FormField label="% ICMS">
              <Input {...register('pICMS')} type="number" step="0.01" min="0" placeholder="0.00" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="% PIS">
              <Input {...register('pPIS')} type="number" step="0.0001" min="0" placeholder="0.0000" />
            </FormField>
            <FormField label="% COFINS">
              <Input {...register('pCOFINS')} type="number" step="0.0001" min="0" placeholder="0.0000" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Unidade Comercial (NF-e)" hint="Máx. 6 caracteres">
              <Input {...register('unidadeComercial')} placeholder="KG" maxLength={6} />
            </FormField>
            <FormField label="GTIN / EAN" hint="Código de barras (14 dígitos) ou vazio">
              <Input {...register('gtin')} placeholder="SEM GTIN" maxLength={14} />
            </FormField>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-xs text-green-700">
            <strong>Simples Nacional (panificação típica):</strong> CSOSN 400 + CST PIS 07 + CST COFINS 07.
            NCM para pães: 1905.90.90. Para bolachas e biscoitos: 1905.31.00 / 1905.32.00.
          </div>
        </>
      )}

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          Erro ao salvar produto. Verifique os dados e tente novamente.
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={mutation.isPending}>
          {isEditing ? 'Salvar Alterações' : 'Salvar Produto'}
        </Button>
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProdutosPage() {
  const queryClient = useQueryClient()
  const [filtroTipo, setFiltroTipo] = useState('')
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Produto | null>(null)

  const { data: produtos = [], isLoading } = useQuery<Produto[]>({
    queryKey: ['produtos', filtroTipo, busca, mostrarInativos],
    queryFn: () => api.get('/produtos', {
      params: {
        tipo: filtroTipo || undefined,
        busca: busca || undefined,
        mostrarInativos: mostrarInativos || undefined,
      },
    }).then(r => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/produtos/${id}/toggle-ativo`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      setConfirmToggle(null)
    },
  })

  const alertas = produtos.filter(
    p => (p.tipo === 'INSUMO' || p.tipo === 'INSUMO_PRODUTO')
      && p.ativo
      && Number(p.estoqueAtual) <= Number(p.estoqueMinimo),
  )

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
              {editando ? `Editar — ${editando.nome}` : 'Novo Produto / Insumo'}
            </h2>
            <p className="text-xs text-gray-400">Produtos & Insumos</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <ProdutoForm
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
          <h2 className="text-2xl font-bold text-gray-900">Produtos & Insumos</h2>
          <p className="text-gray-500 text-sm">{produtos.length} item(s)</p>
        </div>
        <button
          onClick={() => { setEditando(null); setPanelOpen(true) }}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Novo Item
        </button>
      </div>

      {/* Alerta de estoque baixo */}
      {alertas.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="shrink-0 text-amber-500" />
          <span>
            <strong>{alertas.length} insumo(s)</strong> com estoque abaixo do mínimo:{' '}
            {alertas.map(a => a.nome).join(', ')}
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos os tipos</option>
          <option value="INSUMO">Apenas Insumos</option>
          <option value="PRODUTO_ACABADO">Apenas Produtos</option>
          <option value="INSUMO_PRODUTO">Insumo + Produto</option>
        </select>

        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[200px]"
        />

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mostrarInativos}
            onChange={e => setMostrarInativos(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Mostrar inativos
        </label>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : produtos.length === 0 ? (
          <div className="p-12 text-center">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3 text-right">Estoque Atual</th>
                <th className="px-4 py-3 text-right">Custo Unit.</th>
                <th className="px-4 py-3 text-right">Preço Venda</th>
                <th className="px-4 py-3 text-center">NCM</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {produtos.map(p => {
                const estoqueAlerta = (p.tipo === 'INSUMO' || p.tipo === 'INSUMO_PRODUTO')
                  && Number(p.estoqueAtual) <= Number(p.estoqueMinimo)

                return (
                  <tr key={p.id} className={clsx(
                    'hover:bg-gray-50 transition',
                    !p.ativo && 'opacity-50',
                  )}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.codigo}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.nome}
                      {!p.ativo && <span className="ml-2 text-xs text-red-400 font-normal">inativo</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', tipoCor[p.tipo])}>
                        {tipoLabel[p.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.categoria ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.unidadeMedida}</td>
                    <td className={clsx(
                      'px-4 py-3 text-right font-semibold',
                      estoqueAlerta ? 'text-amber-600' : 'text-gray-700',
                    )}>
                      {(p.tipo === 'INSUMO' || p.tipo === 'INSUMO_PRODUTO')
                        ? Number(p.estoqueAtual).toFixed(3)
                        : '—'}
                      {estoqueAlerta && <AlertTriangle size={12} className="inline ml-1 text-amber-500" />}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {(p.tipo === 'INSUMO' || p.tipo === 'INSUMO_PRODUTO')
                        ? `R$ ${Number(p.custoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {p.precoVenda ? `R$ ${Number(p.precoVenda).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.ncm
                        ? <span className="font-mono text-xs text-green-700">{p.ncm}</span>
                        : <span className="text-xs text-red-400">faltando</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => { setEditando(p); setPanelOpen(true) }}
                          title="Editar"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmToggle(p)}
                          title={p.ativo ? 'Desativar' : 'Reativar'}
                          className={clsx(
                            'p-1.5 rounded-lg transition',
                            p.ativo
                              ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50',
                          )}
                        >
                          {p.ativo ? <PowerOff size={14} /> : <Power size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.ativo ? 'Desativar Item' : 'Reativar Item'}
        message={
          confirmToggle?.ativo
            ? `Deseja desativar "${confirmToggle?.nome}"?`
            : `Deseja reativar "${confirmToggle?.nome}"?`
        }
        confirmLabel={confirmToggle?.ativo ? 'Desativar' : 'Reativar'}
        variant={confirmToggle?.ativo ? 'danger' : 'warning'}
        loading={toggleMutation.isPending}
        onConfirm={() => confirmToggle && toggleMutation.mutate(confirmToggle.id)}
        onCancel={() => setConfirmToggle(null)}
      />
    </div>
  )
}
