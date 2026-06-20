import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { FormField, Input, Select, Textarea } from '../ui/FormField'
import { Button } from '../ui/Button'
import { Form } from '../ui/Form'
import { useState } from 'react'
import { AlertTriangle, CheckCircle } from 'lucide-react'

const schema = z.object({
  fichaTecnicaId: z.string().min(1, 'Selecione a receita'),
  quantidade: z.coerce.number().positive('Deve ser maior que 0'),
  turno: z.enum(['MANHA', 'TARDE', 'NOITE']),
  dataProducao: z.string().min(1, 'Obrigatório'),
  observacao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface FichaTecnica {
  id: string
  codigo: string
  produto: { nome: string }
  rendimento: number
  unidadeRendimento: string
}

interface ItemExplosao {
  insumo: string
  necessario: number
  unidade: string
  disponivel: number
  suficiente: boolean
}

export interface OrdemProducaoData {
  id: string
  numero: string
  fichaTecnicaId: string
  quantidade: number
  turno: string
  dataProducao: string
  observacao?: string
  status: string
  fichaTecnica: { codigo: string; produto: { nome: string } }
}

interface OrdemProducaoFormProps {
  initialData?: OrdemProducaoData
  onSuccess: () => void
  onCancel: () => void
}

export function OrdemProducaoForm({ initialData, onSuccess, onCancel }: OrdemProducaoFormProps) {
  const queryClient = useQueryClient()
  const isEditing = !!initialData
  const [explosao, setExplosao] = useState<ItemExplosao[] | null>(null)
  const [loadingExplosao, setLoadingExplosao] = useState(false)

  const { data: fichas = [] } = useQuery<FichaTecnica[]>({
    queryKey: ['fichas-select'],
    queryFn: () => api.get('/producao/fichas').then(r => r.data),
  })

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      dataProducao: new Date().toISOString().split('T')[0],
      turno: 'MANHA',
    },
  })

  useEffect(() => {
    if (initialData) {
      reset({
        fichaTecnicaId: initialData.fichaTecnicaId,
        quantidade: Number(initialData.quantidade),
        turno: initialData.turno as FormData['turno'],
        dataProducao: new Date(initialData.dataProducao).toISOString().split('T')[0],
        observacao: initialData.observacao ?? '',
      })
    }
  }, [initialData, reset])

  const fichaTecnicaId = watch('fichaTecnicaId')
  const quantidade = watch('quantidade')
  const fichaSelecionada = fichas.find(f => f.id === fichaTecnicaId)

  async function verificarExplosao() {
    if (!fichaTecnicaId || !quantidade) return
    setLoadingExplosao(true)
    try {
      const res = await api.get(`/producao/fichas/${fichaTecnicaId}/explosao`, {
        params: { quantidade },
      })
      setExplosao(res.data.explosao)
    } finally {
      setLoadingExplosao(false)
    }
  }

  const mutation = useMutation({
    mutationFn: (data: FormData) => isEditing
      ? api.put(`/producao/ordens/${initialData.id}`, data)
      : api.post('/producao/ordens', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-producao'] })
      onSuccess()
    },
  })

  const temEstoqueInsuficiente = explosao?.some(e => !e.suficiente)

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <FormField label="Nº Ordem">
        <input
          readOnly
          value={initialData?.numero ?? ''}
          placeholder="Gerado automaticamente"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-500 cursor-default select-none"
        />
      </FormField>

      <FormField label="Receita / Ficha Técnica" error={errors.fichaTecnicaId?.message} required>
        <Select {...register('fichaTecnicaId')} error={!!errors.fichaTecnicaId}>
          <option value="">Selecione a receita...</option>
          {fichas.map(f => (
            <option key={f.id} value={f.id}>
              {f.codigo} — {f.produto.nome} (Rend.: {Number(f.rendimento).toFixed(2)} {f.unidadeRendimento})
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Quantidade a Produzir" error={errors.quantidade?.message} required
          hint={fichaSelecionada ? `Rendimento base: ${Number(fichaSelecionada.rendimento).toFixed(2)} ${fichaSelecionada.unidadeRendimento}` : undefined}>
          <Input
            {...register('quantidade')}
            type="number"
            step="0.001"
            min="0.001"
            placeholder="0.000"
            error={!!errors.quantidade}
          />
        </FormField>

        <FormField label="Turno" error={errors.turno?.message} required>
          <Select {...register('turno')} error={!!errors.turno}>
            <option value="MANHA">🌅 Manhã</option>
            <option value="TARDE">☀️ Tarde</option>
            <option value="NOITE">🌙 Noite</option>
          </Select>
        </FormField>
      </div>

      <FormField label="Data de Produção" error={errors.dataProducao?.message} required>
        <Input {...register('dataProducao')} type="date" error={!!errors.dataProducao} />
      </FormField>

      {fichaTecnicaId && quantidade > 0 && (
        <div>
          <button
            type="button"
            onClick={verificarExplosao}
            disabled={loadingExplosao}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium underline underline-offset-2"
          >
            {loadingExplosao ? 'Verificando...' : '🔍 Verificar disponibilidade de insumos'}
          </button>

          {explosao && (
            <div className="mt-3 rounded-lg border border-gray-200 overflow-hidden">
              <div className={`px-3 py-2 text-xs font-semibold flex items-center gap-2 ${temEstoqueInsuficiente ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {temEstoqueInsuficiente
                  ? <><AlertTriangle size={13} /> Estoque insuficiente para alguns insumos</>
                  : <><CheckCircle size={13} /> Todos os insumos disponíveis</>}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="px-3 py-2 text-left">Insumo</th>
                    <th className="px-3 py-2 text-right">Necessário</th>
                    <th className="px-3 py-2 text-right">Disponível</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {explosao.map((item, i) => (
                    <tr key={i} className={item.suficiente ? '' : 'bg-red-50'}>
                      <td className="px-3 py-2 font-medium text-gray-800">{item.insumo}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{item.necessario.toFixed(3)} {item.unidade}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{item.disponivel.toFixed(3)}</td>
                      <td className="px-3 py-2 text-center">
                        {item.suficiente
                          ? <span className="text-green-600">✓</span>
                          : <span className="text-red-600 font-bold">✗</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <FormField label="Observação" error={errors.observacao?.message}>
        <Textarea {...register('observacao')} placeholder="Informações adicionais sobre esta produção..." />
      </FormField>

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          Erro ao salvar ordem de produção. Tente novamente.
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={mutation.isPending}>
          {isEditing ? 'Salvar Alterações' : 'Criar Ordem'}
        </Button>
      </div>
    </Form>
  )
}
