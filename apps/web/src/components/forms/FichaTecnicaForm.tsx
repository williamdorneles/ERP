import { useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Calculator } from 'lucide-react'
import { api } from '../../lib/api'
import { FormField, Input, Select, Textarea } from '../ui/FormField'
import { Button } from '../ui/Button'
import { Form } from '../ui/Form'

const ingredienteSchema = z.object({
  produtoId: z.string().min(1, 'Selecione o ingrediente'),
  quantidade: z.coerce.number().positive('Deve ser maior que 0'),
  unidadeMedida: z.enum(['KG', 'G', 'L', 'ML', 'UN']),
  observacao: z.string().optional(),
})

const schema = z.object({
  produtoId: z.string().min(1, 'Selecione o produto acabado'),
  categoriaId: z.string().optional().nullable(),
  rendimento: z.coerce.number().positive('Deve ser maior que 0'),
  unidadeRendimento: z.enum(['KG', 'G', 'UN']),
  tempoPreparo: z.coerce.number().int().positive().optional().or(z.literal('')),
  tempoFermentacao: z.coerce.number().int().positive().optional().or(z.literal('')),
  temperaturaForno: z.coerce.number().int().positive().optional().or(z.literal('')),
  instrucoes: z.string().optional(),
  ingredientes: z.array(ingredienteSchema).min(1, 'Adicione ao menos 1 ingrediente'),
})

type FormData = z.infer<typeof schema>

interface ProdutoSelect { id: string; nome: string; unidadeMedida: string; custoUnitario: number }
interface ProdutoAcabadoSelect { id: string; nome: string; codigo: string }

export interface FichaTecnicaData {
  id: string
  codigo: string
  produtoId: string
  produto: { id: string; nome: string; codigo: string }
  categoriaId?: string | null
  categoria?: { id: string; nome: string } | null
  rendimento: number
  unidadeRendimento: string
  tempoPreparo?: number
  tempoFermentacao?: number
  temperaturaForno?: number
  instrucoes?: string
  ativo: boolean
  ingredientes: Array<{
    produtoId: string
    quantidade: number
    unidadeMedida: string
    observacao?: string
    produto: { nome: string; custoUnitario: number }
  }>
}

interface FichaTecnicaFormProps {
  initialData?: FichaTecnicaData
  onSuccess: () => void
  onCancel: () => void
}

export function FichaTecnicaForm({ initialData, onSuccess, onCancel }: FichaTecnicaFormProps) {
  const queryClient = useQueryClient()
  const isEditing = !!initialData

  const { data: insumos = [] } = useQuery<ProdutoSelect[]>({
    queryKey: ['produtos-insumos-select'],
    queryFn: () => api.get('/produtos', { params: { tipo: 'INSUMO' } }).then(r => r.data),
  })

  const { data: produtosAcabados = [] } = useQuery<ProdutoAcabadoSelect[]>({
    queryKey: ['produtos-acabados-select'],
    queryFn: () => api.get('/produtos', { params: { tipo: 'PRODUTO_ACABADO' } }).then(r => r.data),
  })

  const { data: categorias = [] } = useQuery<{ id: string; nome: string; ativo: boolean }[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then(r => r.data),
  })

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ingredientes: [{ produtoId: '', quantidade: 0, unidadeMedida: 'KG' }] },
  })

  useEffect(() => {
    if (initialData) {
      reset({
        produtoId: initialData.produtoId,
        categoriaId: initialData.categoriaId ?? '',
        rendimento: Number(initialData.rendimento),
        unidadeRendimento: initialData.unidadeRendimento as FormData['unidadeRendimento'],
        tempoPreparo: initialData.tempoPreparo ?? '',
        tempoFermentacao: initialData.tempoFermentacao ?? '',
        temperaturaForno: initialData.temperaturaForno ?? '',
        instrucoes: initialData.instrucoes ?? '',
        ingredientes: initialData.ingredientes.map(ing => ({
          produtoId: ing.produtoId,
          quantidade: Number(ing.quantidade),
          unidadeMedida: ing.unidadeMedida as 'KG' | 'G' | 'L' | 'ML' | 'UN',
          observacao: ing.observacao ?? '',
        })),
      })
    }
  }, [initialData, reset])

  const { fields, append, remove } = useFieldArray({ control, name: 'ingredientes' })

  const watchIngredientes = watch('ingredientes')
  const custTotal = watchIngredientes?.reduce((acc, ing) => {
    const insumo = insumos.find(i => i.id === ing.produtoId)
    return acc + (insumo ? Number(ing.quantidade) * Number(insumo.custoUnitario) : 0)
  }, 0) ?? 0

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        categoriaId: data.categoriaId || null,
        tempoPreparo: data.tempoPreparo || undefined,
        tempoFermentacao: data.tempoFermentacao || undefined,
        temperaturaForno: data.temperaturaForno || undefined,
      }
      return isEditing
        ? api.put(`/producao/fichas/${initialData.id}`, payload)
        : api.post('/producao/fichas', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fichas-tecnicas'] })
      onSuccess()
    },
  })

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Código">
          <input
            readOnly
            value={initialData?.codigo ?? ''}
            placeholder="Gerado automaticamente"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-500 cursor-default select-none"
          />
        </FormField>
        <FormField label="Produto Acabado" error={errors.produtoId?.message} required>
          <Select {...register('produtoId')} error={!!errors.produtoId}>
            <option value="">Selecione o produto...</option>
            {produtosAcabados.map(p => (
              <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Categoria">
          <Select {...register('categoriaId')}>
            <option value="">—</option>
            {categorias.filter(c => c.ativo).map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Rendimento" error={errors.rendimento?.message} required
          hint="Quantidade produzida">
          <Input {...register('rendimento')} type="number" step="0.001" min="0.001"
            placeholder="50" error={!!errors.rendimento} />
        </FormField>
        <FormField label="Unidade" error={errors.unidadeRendimento?.message} required>
          <Select {...register('unidadeRendimento')} error={!!errors.unidadeRendimento}>
            <option value="KG">KG — Quilograma</option>
            <option value="G">G — Grama</option>
            <option value="UN">UN — Unidades</option>
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Tempo Preparo (min)" error={errors.tempoPreparo?.message}>
          <Input {...register('tempoPreparo')} type="number" min="1" placeholder="30" />
        </FormField>
        <FormField label="Fermentação (min)" error={errors.tempoFermentacao?.message}>
          <Input {...register('tempoFermentacao')} type="number" min="1" placeholder="60" />
        </FormField>
        <FormField label="Temp. Forno (°C)" error={errors.temperaturaForno?.message}>
          <Input {...register('temperaturaForno')} type="number" min="1" placeholder="180" />
        </FormField>
      </div>

      {/* Ingredientes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Ingredientes</h3>
            {errors.ingredientes?.root && (
              <p className="text-xs text-red-500">{errors.ingredientes.root.message}</p>
            )}
          </div>
          {custTotal > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-primary-700 bg-primary-50 px-3 py-1 rounded-lg">
              <Calculator size={14} />
              Custo total: <span className="font-bold tabular-nums">R$ {custTotal.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => {
            const insumoSel = insumos.find(i => i.id === watchIngredientes?.[index]?.produtoId)
            const custoLinha = insumoSel
              ? Number(watchIngredientes?.[index]?.quantidade ?? 0) * Number(insumoSel.custoUnitario)
              : 0

            return (
              <div key={field.id} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1 grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <Controller
                      control={control}
                      name={`ingredientes.${index}.produtoId`}
                      render={({ field: f }) => (
                        <Select
                          {...f}
                          error={!!errors.ingredientes?.[index]?.produtoId}
                          onChange={e => {
                            f.onChange(e)
                            const prod = insumos.find(i => i.id === e.target.value)
                            if (prod) setValue(`ingredientes.${index}.unidadeMedida`, prod.unidadeMedida as 'KG' | 'G' | 'L' | 'ML' | 'UN')
                          }}
                        >
                          <option value="">Selecione o ingrediente...</option>
                          {insumos.map(i => (
                            <option key={i.id} value={i.id}>{i.nome}</option>
                          ))}
                        </Select>
                      )}
                    />
                    {errors.ingredientes?.[index]?.produtoId && (
                      <p className="text-xs text-red-500 mt-0.5">{errors.ingredientes[index].produtoId?.message}</p>
                    )}
                  </div>
                  <div className="col-span-3">
                    <Input
                      {...register(`ingredientes.${index}.quantidade`)}
                      type="number" step="0.001" min="0.001" placeholder="0.000"
                      error={!!errors.ingredientes?.[index]?.quantidade}
                    />
                  </div>
                  <div className="col-span-2">
                    <Select {...register(`ingredientes.${index}.unidadeMedida`)}>
                      <option value="KG">KG</option>
                      <option value="G">G</option>
                      <option value="L">L</option>
                      <option value="ML">ML</option>
                      <option value="UN">UN</option>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center justify-end">
                    <span className="text-xs text-gray-500 font-mono">
                      {custoLinha > 0 ? `R$ ${custoLinha.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}` : '—'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-30 mt-0.5"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => append({ produtoId: '', quantidade: 0, unidadeMedida: 'KG' })}
          className="mt-2 w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition"
        >
          <Plus size={15} /> Adicionar Ingrediente
        </button>
      </div>

      <FormField label="Modo de Preparo" error={errors.instrucoes?.message} hint="Passo a passo opcional">
        <Textarea {...register('instrucoes')} placeholder="Descreva as etapas de preparo..." rows={3} />
      </FormField>

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          Erro ao salvar ficha técnica. Verifique os dados e tente novamente.
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={mutation.isPending}>
          {isEditing ? 'Salvar Alterações' : 'Salvar Ficha Técnica'}
        </Button>
      </div>
    </Form>
  )
}
