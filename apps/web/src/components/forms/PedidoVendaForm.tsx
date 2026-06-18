import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { FormField, Input, Select, Textarea, CurrencyInput } from '../ui/FormField'
import { Button } from '../ui/Button'

const itemSchema = z.object({
  produtoId: z.string().min(1, 'Selecione o produto'),
  quantidade: z.coerce.number().positive('Deve ser maior que 0'),
  precoUnitario: z.coerce.number().positive('Deve ser maior que 0'),
  desconto: z.coerce.number().min(0),
})

const schema = z.object({
  canal: z.enum(['BALCAO', 'ATACADO', 'DELIVERY', 'ONLINE']),
  pessoaId: z.string().optional(),
  formaPagamento: z.enum(['DINHEIRO', 'CREDITO', 'DEBITO', 'PIX', 'PRAZO']),
  desconto: z.coerce.number().min(0),
  observacao: z.string().optional(),
  itens: z.array(itemSchema).min(1, 'Adicione ao menos 1 item'),
})

type FormData = z.infer<typeof schema>

interface Produto { id: string; nome: string; precoVenda: number }
interface Pessoa { id: string; nome: string }

interface PedidoVendaFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function PedidoVendaForm({ onSuccess, onCancel }: PedidoVendaFormProps) {
  const queryClient = useQueryClient()

  const { data: produtos = [] } = useQuery<Produto[]>({
    queryKey: ['produtos-acabados-select'],
    queryFn: () => api.get('/produtos', {
      params: { tipo: 'PRODUTO_ACABADO' },
    }).then(r => r.data),
  })

  const { data: pessoas = [] } = useQuery<Pessoa[]>({
    queryKey: ['clientes-select'],
    queryFn: () => api.get('/pessoas', { params: { tipo: 'CLIENTE' } }).then(r => r.data),
  })

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      canal: 'BALCAO',
      formaPagamento: 'DINHEIRO',
      desconto: 0,
      itens: [{ produtoId: '', quantidade: 1, precoUnitario: 0, desconto: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })

  const watchItens = watch('itens')
  const watchDesconto = watch('desconto') ?? 0

  const subtotal = watchItens?.reduce((acc, item) => {
    return acc + (Number(item.quantidade) * Number(item.precoUnitario)) - Number(item.desconto ?? 0)
  }, 0) ?? 0

  const total = subtotal - Number(watchDesconto)

  function onProdutoChange(index: number, produtoId: string) {
    const produto = produtos.find(p => p.id === produtoId)
    if (produto) {
      setValue(`itens.${index}.precoUnitario`, Number(produto.precoVenda))
    }
  }

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/vendas/pedidos', {
      ...data,
      pessoaId: data.pessoaId || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onSuccess()
    },
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">
      {/* Cabeçalho do pedido */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Canal de Venda" error={errors.canal?.message} required>
          <Select {...register('canal')}>
            <option value="BALCAO">🏪 Balcão</option>
            <option value="ATACADO">📦 Atacado</option>
            <option value="DELIVERY">🛵 Delivery</option>
            <option value="ONLINE">💻 Online</option>
          </Select>
        </FormField>

        <FormField label="Forma de Pagamento" error={errors.formaPagamento?.message} required>
          <Select {...register('formaPagamento')}>
            <option value="DINHEIRO">💵 Dinheiro</option>
            <option value="CREDITO">💳 Cartão de Crédito</option>
            <option value="DEBITO">💳 Cartão de Débito</option>
            <option value="PIX">⚡ PIX</option>
            <option value="PRAZO">📄 A Prazo</option>
          </Select>
        </FormField>
      </div>

      <FormField label="Cliente" error={errors.pessoaId?.message}
        hint="Deixe em branco para consumidor final">
        <Select {...register('pessoaId')}>
          <option value="">Consumidor Final</option>
          {pessoas.map(p => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </Select>
      </FormField>

      {/* Itens */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">Itens do Pedido</h3>
          {errors.itens?.root && (
            <p className="text-xs text-red-500">{errors.itens.root.message}</p>
          )}
        </div>

        {/* Cabeçalho da tabela de itens */}
        <div className="grid grid-cols-12 gap-2 px-1 mb-1 text-xs text-gray-400 font-medium">
          <div className="col-span-5">Produto</div>
          <div className="col-span-2 text-center">Qtd</div>
          <div className="col-span-2 text-right">Preço Unit.</div>
          <div className="col-span-2 text-right">Desconto</div>
          <div className="col-span-1"></div>
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => {
            const item = watchItens?.[index]
            const subtotalLinha = (Number(item?.quantidade ?? 0) * Number(item?.precoUnitario ?? 0)) - Number(item?.desconto ?? 0)

            return (
              <div key={field.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex gap-2 items-center">
                  <div className="flex-1 grid grid-cols-12 gap-2">
                    {/* Produto */}
                    <div className="col-span-5">
                      <Controller
                        control={control}
                        name={`itens.${index}.produtoId`}
                        render={({ field: f }) => (
                          <Select
                            value={f.value}
                            onChange={e => {
                              f.onChange(e)
                              onProdutoChange(index, e.target.value)
                            }}
                            error={!!errors.itens?.[index]?.produtoId}
                          >
                            <option value="">Selecione...</option>
                            {produtos.map(p => (
                              <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                          </Select>
                        )}
                      />
                    </div>

                    {/* Quantidade */}
                    <div className="col-span-2">
                      <Input
                        {...register(`itens.${index}.quantidade`)}
                        type="number"
                        step="0.001"
                        min="0.001"
                        placeholder="1"
                        error={!!errors.itens?.[index]?.quantidade}
                      />
                    </div>

                    {/* Preço unitário */}
                    <div className="col-span-2">
                      <Controller control={control} name={`itens.${index}.precoUnitario`} render={({ field }) => (
                        <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={!!errors.itens?.[index]?.precoUnitario} />
                      )} />
                    </div>

                    {/* Desconto linha */}
                    <div className="col-span-2">
                      <Controller control={control} name={`itens.${index}.desconto`} render={({ field }) => (
                        <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                      )} />
                    </div>

                    {/* Subtotal linha */}
                    <div className="col-span-1 flex items-center justify-end">
                      <span className="text-xs font-semibold text-gray-700 whitespace-nowrap tabular-nums">
                        {subtotalLinha > 0 ? `R$ ${subtotalLinha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => append({ produtoId: '', quantidade: 1, precoUnitario: 0, desconto: 0 })}
          className="mt-2 w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition"
        >
          <Plus size={15} /> Adicionar Item
        </button>
      </div>

      {/* Totais */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span className="font-medium tabular-nums">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Desconto geral</span>
          <div className="w-36">
            <Controller control={control} name="desconto" render={({ field }) => (
              <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )} />
          </div>
        </div>

        <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
          <span>Total</span>
          <span className="text-primary-700 tabular-nums">R$ {Math.max(total, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <FormField label="Observação" error={errors.observacao?.message}>
        <Textarea {...register('observacao')} placeholder="Informações adicionais sobre o pedido..." />
      </FormField>

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          Erro ao criar pedido. Verifique os dados e tente novamente.
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={mutation.isPending}>
          Criar Pedido — R$ {Math.max(total, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Button>
      </div>
    </form>
  )
}
