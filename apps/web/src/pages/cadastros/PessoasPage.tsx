import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Users, Pencil, PowerOff, Power, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormField, Input, Select, CurrencyInput } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { Form } from '../../components/ui/Form'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Pessoa {
  id: string
  codigo: string
  tipo: 'CLIENTE' | 'FORNECEDOR' | 'AMBOS'
  tipoLegal: 'PF' | 'PJ'
  nome: string
  nomeFantasia?: string
  documento?: string
  email?: string
  telefone?: string
  ativo: boolean
  limiteCredito: number
  ie?: string
  indicadorIE?: number
  cep?: string; logradouro?: string; numero?: string
  complemento?: string; bairro?: string; municipio?: string; uf?: string; codigoIBGE?: string
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  tipo: z.enum(['CLIENTE', 'FORNECEDOR', 'AMBOS']),
  tipoLegal: z.enum(['PF', 'PJ']),
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  nomeFantasia: z.string().optional(),
  documento: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  limiteCredito: z.coerce.number().min(0),
  ie: z.string().optional(),
  indicadorIE: z.coerce.number(),
  cep: z.string().max(8).optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  municipio: z.string().optional(),
  uf: z.string().max(2).optional(),
  codigoIBGE: z.string().max(7).optional(),
})

type FormData = z.infer<typeof schema>

// ─── Badges ───────────────────────────────────────────────────────────────────

const tipoCor: Record<string, string> = {
  CLIENTE: 'bg-blue-100 text-blue-700',
  FORNECEDOR: 'bg-orange-100 text-orange-700',
  AMBOS: 'bg-purple-100 text-purple-700',
}

const tipoLabel: Record<string, string> = {
  CLIENTE: 'Cliente',
  FORNECEDOR: 'Fornecedor',
  AMBOS: 'Cliente + Fornecedor',
}

// ─── Formulário ───────────────────────────────────────────────────────────────

function PessoaForm({
  initialData,
  onSuccess,
  onCancel,
}: {
  initialData?: Pessoa
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
          tipoLegal: initialData.tipoLegal,
          nome: initialData.nome,
          nomeFantasia: initialData.nomeFantasia ?? '',
          documento: initialData.documento ?? '',
          email: initialData.email ?? '',
          telefone: initialData.telefone ?? '',
          limiteCredito: Number(initialData.limiteCredito),
          ie: initialData.ie ?? '',
          indicadorIE: initialData.indicadorIE ?? 9,
          cep: initialData.cep ?? '',
          logradouro: initialData.logradouro ?? '',
          numero: initialData.numero ?? '',
          complemento: initialData.complemento ?? '',
          bairro: initialData.bairro ?? '',
          municipio: initialData.municipio ?? '',
          uf: initialData.uf ?? '',
          codigoIBGE: initialData.codigoIBGE ?? '',
        }
      : { tipo: 'CLIENTE', tipoLegal: 'PF', limiteCredito: 0, indicadorIE: 9 },
  })

  const tipo = watch('tipo')
  const tipoLegal = watch('tipoLegal')

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = { ...data, email: data.email || undefined }
      return isEditing
        ? api.put(`/pessoas/${initialData.id}`, payload)
        : api.post('/pessoas', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pessoas'] })
      onSuccess()
    },
  })

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
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
            {t === 'geral' ? 'Dados Gerais' : 'Endereço / Fiscal'}
          </button>
        ))}
      </div>

      {aba === 'geral' && (
        <>
          <FormField label="Código">
            <input
              readOnly
              value={initialData?.codigo ?? ''}
              placeholder="Gerado automaticamente"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-500 cursor-default select-none"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Papel" error={errors.tipo?.message} required>
              <Select {...register('tipo')}>
                <option value="CLIENTE">Cliente</option>
                <option value="FORNECEDOR">Fornecedor</option>
                <option value="AMBOS">Cliente + Fornecedor</option>
              </Select>
            </FormField>
            <FormField label="Tipo de Pessoa" error={errors.tipoLegal?.message} required>
              <Select {...register('tipoLegal')}>
                <option value="PF">Pessoa Física</option>
                <option value="PJ">Pessoa Jurídica</option>
              </Select>
            </FormField>
          </div>

          <FormField
            label={tipoLegal === 'PJ' ? 'Razão Social' : 'Nome Completo'}
            error={errors.nome?.message}
            required
          >
            <Input
              {...register('nome')}
              placeholder={tipoLegal === 'PJ' ? 'Padaria Brasil Ltda' : 'João da Silva'}
              error={!!errors.nome}
            />
          </FormField>

          {tipoLegal === 'PJ' && (
            <FormField label="Nome Fantasia">
              <Input {...register('nomeFantasia')} placeholder="Padaria Brasil" />
            </FormField>
          )}

          <FormField
            label={tipoLegal === 'PJ' ? 'CNPJ' : 'CPF'}
            error={errors.documento?.message}
          >
            <Input
              {...register('documento')}
              placeholder={tipoLegal === 'PJ' ? '00.000.000/0001-00' : '000.000.000-00'}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Telefone" error={errors.telefone?.message}>
              <Input {...register('telefone')} placeholder="(51) 99999-9999" />
            </FormField>
            <FormField label="E-mail" error={errors.email?.message}>
              <Input {...register('email')} type="email" placeholder="contato@email.com" error={!!errors.email} />
            </FormField>
          </div>

          {(tipo === 'CLIENTE' || tipo === 'AMBOS') && (
            <FormField label="Limite de Crédito" hint="Valor máximo para compras a prazo">
              <Controller control={control} name="limiteCredito" render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
              )} />
            </FormField>
          )}
        </>
      )}

      {aba === 'fiscal' && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
            Dados necessários para geração de NF-e. Obrigatório para pessoas jurídicas contribuintes do ICMS.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Indicador de IE" hint="Situação em relação ao ICMS">
              <Select {...register('indicadorIE')}>
                <option value={1}>1 — Contribuinte ICMS (tem IE)</option>
                <option value={2}>2 — Contribuinte isento de IE</option>
                <option value={9}>9 — Não contribuinte (PF ou Simples)</option>
              </Select>
            </FormField>
            <FormField label="Inscrição Estadual (IE)">
              <Input {...register('ie')} placeholder="Somente números ou ISENTO" />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="CEP" hint="8 dígitos sem traço">
              <Input {...register('cep')} placeholder="01310100" maxLength={8} />
            </FormField>
            <div className="col-span-2">
              <FormField label="Logradouro">
                <Input {...register('logradouro')} placeholder="Rua das Flores" />
              </FormField>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <FormField label="Número">
              <Input {...register('numero')} placeholder="123" />
            </FormField>
            <div className="col-span-3">
              <FormField label="Complemento">
                <Input {...register('complemento')} placeholder="Loja 5" />
              </FormField>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Bairro">
              <Input {...register('bairro')} placeholder="Centro" />
            </FormField>
            <FormField label="Município">
              <Input {...register('municipio')} placeholder="São Paulo" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="UF">
              <Select {...register('uf')}>
                <option value="">Selecione...</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Código IBGE" hint="7 dígitos">
              <Input {...register('codigoIBGE')} placeholder="3550308" maxLength={7} />
            </FormField>
          </div>
        </>
      )}

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          Erro ao salvar. Verifique os dados e tente novamente.
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

export function PessoasPage() {
  const queryClient = useQueryClient()
  const [filtroTipo, setFiltroTipo] = useState('')
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editando, setEditando] = useState<Pessoa | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Pessoa | null>(null)

  const { data: pessoas = [], isLoading } = useQuery<Pessoa[]>({
    queryKey: ['pessoas', filtroTipo, busca, mostrarInativos],
    queryFn: () => api.get('/pessoas', {
      params: {
        tipo: filtroTipo || undefined,
        busca: busca || undefined,
        mostrarInativos: mostrarInativos || undefined,
      },
    }).then(r => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/pessoas/${id}/toggle-ativo`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pessoas'] })
      setConfirmToggle(null)
    },
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
              {editando ? `Editar — ${editando.nome}` : 'Nova Pessoa'}
            </h2>
            <p className="text-xs text-gray-400">Clientes & Fornecedores</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <PessoaForm
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
          <h2 className="text-2xl font-bold text-gray-900">Clientes & Fornecedores</h2>
          <p className="text-gray-500 text-sm">{pessoas.length} pessoa(s) cadastrada(s)</p>
        </div>
        <button
          onClick={() => { setEditando(null); setPanelOpen(true) }}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Nova Pessoa
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos os perfis</option>
          <option value="CLIENTE">Apenas Clientes</option>
          <option value="FORNECEDOR">Apenas Fornecedores</option>
          <option value="AMBOS">Cliente + Fornecedor</option>
        </select>

        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou documento..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[240px]"
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
        ) : pessoas.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Nenhuma pessoa encontrada.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3 text-right">Limite Crédito</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pessoas.map(p => (
                <tr key={p.id}
                  onClick={() => { setEditando(p); setPanelOpen(true) }}
                  className={clsx(
                    'hover:bg-gray-50 cursor-pointer transition',
                    !p.ativo && 'opacity-50',
                  )}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.codigo}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {p.nome}
                    {p.nomeFantasia && <span className="block text-xs text-gray-400">{p.nomeFantasia}</span>}
                    {!p.ativo && <span className="ml-2 text-xs text-red-400 font-normal">inativo</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', tipoCor[p.tipo])}>
                      {tipoLabel[p.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.tipoLegal}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.documento ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.telefone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{p.email ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                    {(p.tipo === 'CLIENTE' || p.tipo === 'AMBOS')
                      ? `R$ ${Number(p.limiteCredito).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
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
                        onClick={e => { e.stopPropagation(); setConfirmToggle(p) }}
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.ativo ? 'Desativar Pessoa' : 'Reativar Pessoa'}
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
