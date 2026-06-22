import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { FormField, Input, Select, Textarea } from '../ui/FormField'
import { Button } from '../ui/Button'
import { Form } from '../ui/Form'
import { AlertTriangle, CheckCircle, X } from 'lucide-react'

const schema = z.object({
  produtoId: z.string().min(1, 'Selecione o produto'),
  quantidade: z.coerce.number().positive('Deve ser maior que 0'),
  turno: z.enum(['MANHA', 'TARDE', 'NOITE']),
  dataProducao: z.string().min(1, 'Obrigatório'),
  observacao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Produto {
  id: string
  nome: string
  codigo: string
  unidadeMedida: string
}

interface BomInfo {
  id: string
  qtdeProduzida: number
  unidadeProduzida: string
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
  produtoId: string
  quantidade: number
  turno: string
  dataProducao: string
  observacao?: string
  status: string
  produto: { nome: string }
}

interface OrdemProducaoFormProps {
  initialData?: OrdemProducaoData
  onSuccess: () => void
  onCancel: () => void
}

// ── Busca de produto por nome ──────────────────────────────────────────────────

function ProdutoInput({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (id: string, nome: string) => void
  error?: boolean
}) {
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: produtos = [] } = useQuery<Produto[]>({
    queryKey: ['produtos-select', busca],
    queryFn: () => api.get('/produtos', { params: { busca: busca || undefined, mostrarInativos: 'false' } }).then(r => r.data),
  })

  // Carrega o nome do produto selecionado ao editar
  const { data: produtoSelecionado } = useQuery<Produto>({
    queryKey: ['produto-item', value],
    queryFn: () => api.get(`/produtos/${value}`).then(r => r.data),
    enabled: !!value && !busca,
  })

  useEffect(() => {
    if (produtoSelecionado && !busca) setBusca(produtoSelecionado.nome)
  }, [produtoSelecionado]) // eslint-disable-line

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selecionar(p: Produto) {
    onChange(p.id, p.nome)
    setBusca(p.nome)
    setAberto(false)
  }

  function limpar() {
    onChange('', '')
    setBusca('')
    setAberto(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={busca}
          onChange={e => { setBusca(e.target.value); setAberto(true); if (!e.target.value) onChange('', '') }}
          onFocus={() => setAberto(true)}
          placeholder="Digite o nome do produto..."
          className={`w-full px-3 py-2 pr-8 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
            error ? 'border-red-300 focus:ring-red-400' : 'border-gray-300 focus:ring-primary-500 focus:border-transparent'
          }`}
        />
        {value && (
          <button type="button" onClick={limpar} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>
      {aberto && produtos.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {produtos.map(p => (
            <li
              key={p.id}
              onMouseDown={() => selecionar(p)}
              className="px-3 py-2 cursor-pointer hover:bg-primary-50 text-sm"
            >
              <span className="font-medium text-gray-900">{p.nome}</span>
              <span className="ml-2 text-xs text-gray-400">{p.codigo}</span>
            </li>
          ))}
        </ul>
      )}
      {aberto && busca.trim() !== '' && produtos.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
          Nenhum produto encontrado
        </div>
      )}
    </div>
  )
}

// ── Form principal ─────────────────────────────────────────────────────────────

export function OrdemProducaoForm({ initialData, onSuccess, onCancel }: OrdemProducaoFormProps) {
  const queryClient = useQueryClient()
  const isEditing = !!initialData
  const [explosao, setExplosao] = useState<ItemExplosao[] | null>(null)
  const [loadingExplosao, setLoadingExplosao] = useState(false)
  const [bomInfo, setBomInfo] = useState<BomInfo | null | false>(null)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      dataProducao: new Date().toISOString().split('T')[0],
      turno: 'MANHA',
    },
  })

  useEffect(() => {
    if (initialData) {
      reset({
        produtoId: initialData.produtoId,
        quantidade: Number(initialData.quantidade),
        turno: initialData.turno as FormData['turno'],
        dataProducao: new Date(initialData.dataProducao).toISOString().split('T')[0],
        observacao: initialData.observacao ?? '',
      })
    }
  }, [initialData, reset])

  const produtoId = watch('produtoId')
  const quantidade = watch('quantidade')

  // Busca BOM do produto selecionado para mostrar hint de lote base
  useEffect(() => {
    if (!produtoId) { setBomInfo(null); return }
    api.get(`/producao/bom/${produtoId}`)
      .then(r => setBomInfo(r.data))
      .catch(() => setBomInfo(false))
  }, [produtoId])

  async function verificarExplosao() {
    if (!produtoId || !quantidade) return
    setLoadingExplosao(true)
    try {
      const res = await api.get(`/producao/bom/${produtoId}/explosao`, { params: { quantidade } })
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

      <FormField label="Produto" error={errors.produtoId?.message} required>
        <ProdutoInput
          value={produtoId ?? ''}
          onChange={(id) => {
            setValue('produtoId', id, { shouldValidate: true })
            setExplosao(null)
            setBomInfo(null)
          }}
          error={!!errors.produtoId}
        />
        {produtoId && bomInfo === false && (
          <p className="text-xs text-amber-600 mt-1">⚠ Este produto não possui composição BOM — a ordem não poderá ser criada.</p>
        )}
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Quantidade a Produzir"
          error={errors.quantidade?.message}
          required
          hint={bomInfo ? `Lote BOM: ${Number(bomInfo.qtdeProduzida).toFixed(3)} ${bomInfo.unidadeProduzida}` : undefined}
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

      {bomInfo && quantidade > 0 && (
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
          {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao salvar ordem de produção.'}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={mutation.isPending} disabled={!!produtoId && bomInfo === false}>
          {isEditing ? 'Salvar Alterações' : 'Criar Ordem'}
        </Button>
      </div>
    </Form>
  )
}
