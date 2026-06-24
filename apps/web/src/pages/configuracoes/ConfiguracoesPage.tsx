import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { Form } from '../../components/ui/Form'
import { Settings, Receipt, Building2, Shield, CheckCircle2, AlertTriangle, Upload, Coins, Search, X, Boxes } from 'lucide-react'
import clsx from 'clsx'

type Secao = 'sistema' | 'estoque' | 'financeiro' | 'fiscal'
type TabFiscal = 'empresa' | 'endereco' | 'nfe' | 'certificado'

interface Configuracao {
  chave: string
  valor: string
  descricao: string | null
  atualizadoEm: string
}

const LABELS: Record<string, string> = {
  METODO_CUSTO: 'Método de Custo',
}

// Chaves com aba dedicada ou internas — não aparecem na aba "Sistema" genérica
const CHAVES_DEDICADAS = new Set([
  'METODO_CUSTO', 'PERMITIR_ESTOQUE_NEGATIVO',
  'CONTA_TARIFA_BANCARIA', 'CONTA_JUROS_PAGOS', 'CONTA_JUROS_RECEBIDOS',
  'CONTA_DESCONTO_OBTIDO', 'CONTA_DESCONTO_CONCEDIDO',
  'ULTIMO_NSU_ENTRADA',
])

export function ConfiguracoesPage() {
  const { usuario } = useAuthStore()
  const isAdmin = usuario?.perfil === 'ADMIN'
  const [secao, setSecao] = useState<Secao>('sistema')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-1">Parâmetros globais do sistema e configuração fiscal.</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar de seções */}
        <nav className="w-44 shrink-0 space-y-1">
          <button
            onClick={() => setSecao('sistema')}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
              secao === 'sistema' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            <Settings size={16} /> Sistema
          </button>
          <button
            onClick={() => setSecao('estoque')}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
              secao === 'estoque' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            <Boxes size={16} /> Estoque
          </button>
          <button
            onClick={() => setSecao('financeiro')}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
              secao === 'financeiro' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            <Coins size={16} /> Financeiro
          </button>
          <button
            onClick={() => setSecao('fiscal')}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
              secao === 'fiscal' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            <Receipt size={16} /> Fiscal
          </button>
        </nav>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {secao === 'sistema' && <SecaoSistema isAdmin={isAdmin} />}
          {secao === 'estoque' && <SecaoEstoque isAdmin={isAdmin} />}
          {secao === 'financeiro' && <SecaoFinanceiro isAdmin={isAdmin} />}
          {secao === 'fiscal' && <SecaoFiscal />}
        </div>
      </div>
    </div>
  )
}

// ─── Seção Sistema ────────────────────────────────────────────────────────────

function SecaoSistema({ isAdmin }: { isAdmin: boolean }) {
  const [configs, setConfigs] = useState<Configuracao[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api.get<Configuracao[]>('/configuracoes')
      .then(r => setConfigs(r.data))
      .finally(() => setLoading(false))
  }, [])

  async function salvar(chave: string, valor: string) {
    setSalvando(chave)
    setErro(null)
    setSucesso(null)
    try {
      const { data } = await api.put<Configuracao>(`/configuracoes/${chave}`, { valor })
      setConfigs(prev => prev.map(c => c.chave === chave ? data : c))
      setSucesso('Configuração salva com sucesso.')
      setTimeout(() => setSucesso(null), 3000)
    } catch {
      setErro('Erro ao salvar configuração.')
    } finally {
      setSalvando(null)
    }
  }

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Carregando...</div>

  const visiveis = configs.filter(c => !CHAVES_DEDICADAS.has(c.chave))

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
          Apenas administradores podem alterar configurações.
        </div>
      )}
      {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erro}</div>}
      {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{sucesso}</div>}

      {visiveis.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-8 text-center text-sm text-gray-400">
          Nenhuma configuração geral. Veja as abas Estoque, Financeiro e Fiscal.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {visiveis.map(cfg => (
            <div key={cfg.chave} className="px-6 py-5 space-y-3">
              <div>
                <p className="font-medium text-gray-900">{LABELS[cfg.chave] ?? cfg.chave}</p>
                {cfg.descricao && <p className="text-xs text-gray-500 mt-0.5">{cfg.descricao}</p>}
              </div>
              <p className="text-xs text-gray-400">
                Atualizado em {new Date(cfg.atualizadoEm).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Seção Estoque (custo + estoque negativo) ──────────────────────────────────

function BotoesOpcao({ valorAtual, opcoes, disabled, onSelect }: {
  valorAtual: string
  opcoes: { valor: string; label: string }[]
  disabled: boolean
  onSelect: (v: string) => void
}) {
  return (
    <div className="flex gap-3 flex-wrap">
      {opcoes.map(o => (
        <button
          key={o.valor}
          disabled={disabled}
          onClick={() => onSelect(o.valor)}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium border transition',
            valorAtual === o.valor
              ? 'bg-primary-600 border-primary-600 text-white'
              : 'bg-white border-gray-300 text-gray-700 hover:border-primary-400',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SecaoEstoque({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [salvando, setSalvando] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  const { data: configs = [], isLoading } = useQuery<Configuracao[]>({
    queryKey: ['configuracoes'],
    queryFn: () => api.get('/configuracoes').then(r => r.data),
  })
  const valor = (chave: string) => configs.find(c => c.chave === chave)?.valor ?? ''

  async function salvar(chave: string, v: string) {
    setSalvando(chave); setMsg(null)
    try {
      await api.put(`/configuracoes/${chave}`, { valor: v })
      await qc.invalidateQueries({ queryKey: ['configuracoes'] })
      setMsg({ ok: true, texto: 'Configuração salva.' })
      setTimeout(() => setMsg(null), 3000)
    } catch {
      setMsg({ ok: false, texto: 'Erro ao salvar. Apenas administradores podem alterar.' })
    } finally {
      setSalvando(null)
    }
  }

  if (isLoading) return <div className="text-gray-400 text-sm py-8 text-center">Carregando...</div>

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
          Apenas administradores podem alterar configurações.
        </div>
      )}
      {msg && (
        <div className={clsx('px-4 py-3 rounded-lg text-sm border',
          msg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700')}>
          {msg.texto}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-6 py-5 space-y-3">
          <div>
            <p className="font-medium text-gray-900">Estoque negativo</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Define se saídas e consumos (venda e produção) podem deixar o saldo negativo, ou se são bloqueados quando falta estoque.
            </p>
          </div>
          <BotoesOpcao
            valorAtual={valor('PERMITIR_ESTOQUE_NEGATIVO') || 'SIM'}
            disabled={!isAdmin || salvando === 'PERMITIR_ESTOQUE_NEGATIVO'}
            onSelect={v => salvar('PERMITIR_ESTOQUE_NEGATIVO', v)}
            opcoes={[
              { valor: 'NAO', label: 'Bloquear (não permite)' },
              { valor: 'SIM', label: 'Permitir negativo' },
            ]}
          />
        </div>

        <div className="px-6 py-5 space-y-3">
          <div>
            <p className="font-medium text-gray-900">Método de Custo</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Custo usado no CMV e nas margens: custo médio ponderado móvel ou custo da última entrada.
            </p>
          </div>
          <BotoesOpcao
            valorAtual={valor('METODO_CUSTO') || 'MEDIO'}
            disabled={!isAdmin || salvando === 'METODO_CUSTO'}
            onSelect={v => salvar('METODO_CUSTO', v)}
            opcoes={[
              { valor: 'MEDIO', label: 'Custo Médio Ponderado' },
              { valor: 'ULTIMO', label: 'Último Custo' },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Seção Financeiro (contas padrão de encargos) ──────────────────────────────

interface ContaFin {
  id: string
  codigo: string
  nome: string
  codigoCompleto: string | null
  tipo: string
  isAnalitica: boolean
}

const CONTAS_ENCARGO: { chave: string; label: string; hint: string }[] = [
  { chave: 'CONTA_TARIFA_BANCARIA',    label: 'Tarifa bancária',                hint: 'Despesa financeira (TED/PIX/boleto)' },
  { chave: 'CONTA_JUROS_PAGOS',        label: 'Juros/multa pagos',              hint: 'Despesa financeira por atraso a fornecedores' },
  { chave: 'CONTA_JUROS_RECEBIDOS',    label: 'Juros/multa recebidos',          hint: 'Receita financeira por atraso de clientes' },
  { chave: 'CONTA_DESCONTO_OBTIDO',    label: 'Desconto obtido (pagamento)',    hint: 'Receita / redução de despesa' },
  { chave: 'CONTA_DESCONTO_CONCEDIDO', label: 'Desconto concedido (recebimento)', hint: 'Despesa / redução de receita' },
]

function SecaoFinanceiro({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [salvando, setSalvando] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const { data: configs = [], isLoading: loadingCfg } = useQuery<Configuracao[]>({
    queryKey: ['configuracoes'],
    queryFn: () => api.get('/configuracoes').then(r => r.data),
  })
  const { data: contas = [], isLoading: loadingContas } = useQuery<ContaFin[]>({
    queryKey: ['contas-financeiras'],
    queryFn: () => api.get('/financeiro/contas').then(r => r.data),
  })

  const valorPorChave = new Map(configs.map(c => [c.chave, c.valor]))
  const contasAnaliticas = contas.filter(c => c.isAnalitica)

  async function salvar(chave: string, contaId: string) {
    setSalvando(chave); setErro(null); setSucesso(null)
    try {
      await api.put(`/configuracoes/${chave}`, { valor: contaId })
      await qc.invalidateQueries({ queryKey: ['configuracoes'] })
      setSucesso('Conta vinculada com sucesso.')
      setTimeout(() => setSucesso(null), 3000)
    } catch {
      setErro('Erro ao salvar a conta. Apenas administradores podem alterar.')
    } finally {
      setSalvando(null)
    }
  }

  if (loadingCfg || loadingContas) return <div className="text-gray-400 text-sm py-8 text-center">Carregando...</div>

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        Vincule cada encargo a uma conta do plano de contas (analítica). Esses valores serão usados para
        lançar juros, multas, tarifas e descontos na conta correta do DRE durante a conciliação e a baixa.
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
          Apenas administradores podem alterar configurações.
        </div>
      )}
      {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erro}</div>}
      {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{sucesso}</div>}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {CONTAS_ENCARGO.map(({ chave, label, hint }) => (
          <div key={chave} className="px-6 py-4 flex items-center gap-4">
            <div className="w-56 shrink-0">
              <p className="font-medium text-gray-900 text-sm">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
            </div>
            <div className="flex-1 min-w-0">
              <ContaPicker
                contas={contasAnaliticas}
                value={valorPorChave.get(chave) || ''}
                disabled={!isAdmin || salvando === chave}
                onChange={contaId => salvar(chave, contaId)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ContaPicker({
  contas, value, disabled, onChange,
}: {
  contas: ContaFin[]
  value: string
  disabled: boolean
  onChange: (contaId: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')

  const selecionada = contas.find(c => c.id === value)
  const filtradas = busca.trim()
    ? contas.filter(c =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (c.codigoCompleto ?? c.codigo).includes(busca),
      )
    : contas

  if (!aberto) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setAberto(true); setBusca('') }}
        className={clsx(
          'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border rounded-lg text-left transition',
          disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200' : 'border-gray-300 hover:border-primary-400',
        )}
      >
        {selecionada ? (
          <span className="truncate">
            <span className="font-mono text-gray-400 mr-2">{selecionada.codigoCompleto ?? selecionada.codigo}</span>
            {selecionada.nome}
          </span>
        ) : (
          <span className="text-gray-400">Não vinculada — clique para escolher</span>
        )}
        <Search size={14} className="text-gray-400 shrink-0" />
      </button>
    )
  }

  return (
    <div className="border border-primary-300 rounded-lg p-2 bg-white space-y-2 shadow-sm">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar conta por código ou nome..."
          className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button type="button" onClick={() => setAberto(false)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setAberto(false) }}
            className="w-full text-left px-2 py-1.5 rounded text-xs text-red-500 hover:bg-red-50"
          >
            Remover vínculo
          </button>
        )}
        {filtradas.slice(0, 30).map(conta => (
          <button
            key={conta.id}
            type="button"
            onClick={() => { onChange(conta.id); setAberto(false) }}
            className={clsx(
              'w-full text-left px-2 py-1.5 rounded text-xs transition',
              value === conta.id ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 text-gray-700',
            )}
          >
            <span className={clsx('font-mono mr-2', value === conta.id ? 'text-primary-100' : 'text-gray-400')}>
              {conta.codigoCompleto ?? conta.codigo}
            </span>
            {conta.nome}
          </button>
        ))}
        {filtradas.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">Nenhuma conta encontrada</p>
        )}
      </div>
    </div>
  )
}

// ─── Seção Fiscal ─────────────────────────────────────────────────────────────

function SecaoFiscal() {
  const [tab, setTab] = useState<TabFiscal>('empresa')
  const queryClient = useQueryClient()

  const { data: empresa, isLoading } = useQuery({
    queryKey: ['fiscal-empresa'],
    queryFn: () => api.get('/fiscal/empresa').then(r => r.data),
  })

  const { data: cert } = useQuery({
    queryKey: ['fiscal-certificado'],
    queryFn: () => api.get('/fiscal/certificado').then(r => r.data),
  })

  if (isLoading) return <div className="text-gray-400 text-sm py-8 text-center">Carregando...</div>

  const tabs: { key: TabFiscal; label: string; icon: React.ReactNode }[] = [
    { key: 'empresa',     label: 'Empresa',        icon: <Building2 size={15} /> },
    { key: 'endereco',    label: 'Endereço Fiscal', icon: <Building2 size={15} /> },
    { key: 'nfe',         label: 'NF-e / Provedor', icon: <Receipt size={15} /> },
    { key: 'certificado', label: 'Certificado A1',  icon: <Shield size={15} /> },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition',
              tab === t.key
                ? 'border-primary-600 text-primary-700 bg-primary-50'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50',
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === 'empresa'     && <TabEmpresa    empresa={empresa} onSave={() => queryClient.invalidateQueries({ queryKey: ['fiscal-empresa'] })} />}
        {tab === 'endereco'    && <TabEndereco   empresa={empresa} onSave={() => queryClient.invalidateQueries({ queryKey: ['fiscal-empresa'] })} />}
        {tab === 'nfe'         && <TabNFe        empresa={empresa} onSave={() => queryClient.invalidateQueries({ queryKey: ['fiscal-empresa'] })} />}
        {tab === 'certificado' && <TabCertificado cert={cert}      onSave={() => queryClient.invalidateQueries({ queryKey: ['fiscal-certificado'] })} />}
      </div>
    </div>
  )
}

// ─── Tab Empresa ─────────────────────────────────────────────────────────────

function TabEmpresa({ empresa, onSave }: { empresa: Record<string, unknown> | null; onSave: () => void }) {
  const { register, handleSubmit, reset, formState: { errors: _e, isDirty } } = useForm({
    defaultValues: { razaoSocial: '', nomeFantasia: '', cnpj: '', ie: '', im: '', cnae: '', crt: 'SIMPLES_NACIONAL', fone: '', email: '' },
  })
  useEffect(() => { if (empresa) reset(empresa as never) }, [empresa, reset])
  const mutation = useMutation({ mutationFn: (data: Record<string, unknown>) => api.put('/fiscal/empresa', data), onSuccess: onSave })

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d as never))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Razão Social" required><Input {...register('razaoSocial', { required: true })} placeholder="Padaria Brasil Ltda" /></FormField>
        <FormField label="Nome Fantasia"><Input {...register('nomeFantasia')} placeholder="Padaria Brasil" /></FormField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="CNPJ" required hint="Somente números"><Input {...register('cnpj', { required: true })} placeholder="12345678000195" maxLength={14} /></FormField>
        <FormField label="Inscrição Estadual (IE)"><Input {...register('ie')} placeholder="Somente números" /></FormField>
        <FormField label="Inscrição Municipal (IM)"><Input {...register('im')} placeholder="Opcional" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="CNAE" hint="7 dígitos"><Input {...register('cnae')} placeholder="1091101" maxLength={7} /></FormField>
        <FormField label="Regime Tributário (CRT)" required>
          <Select {...register('crt')}>
            <option value="SIMPLES_NACIONAL">1 — Simples Nacional</option>
            <option value="SIMPLES_EXCESSO">2 — Simples Nacional — Excesso de Sublimite</option>
            <option value="REGIME_NORMAL">3 — Regime Normal (Lucro Presumido / Real)</option>
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Fone"><Input {...register('fone')} placeholder="(51) 3333-4444" /></FormField>
        <FormField label="E-mail"><Input {...register('email')} type="email" placeholder="fiscal@empresa.com.br" /></FormField>
      </div>
      <SaveBar loading={mutation.isPending} dirty={isDirty} error={mutation.isError} />
    </Form>
  )
}

// ─── Tab Endereço ─────────────────────────────────────────────────────────────

function TabEndereco({ empresa, onSave }: { empresa: Record<string, unknown> | null; onSave: () => void }) {
  const { register, handleSubmit, reset, formState: { isDirty } } = useForm({
    defaultValues: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', uf: '', codigoIBGE: '' },
  })
  useEffect(() => { if (empresa) reset(empresa as never) }, [empresa, reset])
  const mutation = useMutation({ mutationFn: (data: Record<string, unknown>) => api.put('/fiscal/empresa', data), onSuccess: onSave })

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d as never))} className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        Endereço obrigatório para emissão de NF-e conforme layouts SEFAZ NT 2024.
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="CEP" hint="Somente números"><Input {...register('cep')} placeholder="01310100" maxLength={8} /></FormField>
        <div className="col-span-2"><FormField label="Logradouro"><Input {...register('logradouro')} placeholder="Rua das Flores" /></FormField></div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <FormField label="Número"><Input {...register('numero')} placeholder="123" /></FormField>
        <div className="col-span-3"><FormField label="Complemento"><Input {...register('complemento')} placeholder="Sala 2" /></FormField></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Bairro"><Input {...register('bairro')} placeholder="Centro" /></FormField>
        <FormField label="Município"><Input {...register('municipio')} placeholder="São Paulo" /></FormField>
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
        <FormField label="Código IBGE" hint="7 dígitos"><Input {...register('codigoIBGE')} placeholder="3550308" maxLength={7} /></FormField>
      </div>
      <SaveBar loading={mutation.isPending} dirty={isDirty} />
    </Form>
  )
}

// ─── Tab NF-e ────────────────────────────────────────────────────────────────

function TabNFe({ empresa, onSave }: { empresa: Record<string, unknown> | null; onSave: () => void }) {
  const { register, handleSubmit, reset, formState: { isDirty } } = useForm({
    defaultValues: { ambiente: 'HOMOLOGACAO', providerNFe: 'FOCUS_NFE', providerApiKey: '', providerApiUrl: '', serieNFe: 1, proximoNumeroNFe: 1, serieNFCe: 1, proximoNumeroNFCe: 1 },
  })
  useEffect(() => { if (empresa) reset(empresa as never) }, [empresa, reset])
  const mutation = useMutation({ mutationFn: (data: Record<string, unknown>) => api.put('/fiscal/empresa', data), onSuccess: onSave })

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d as never))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Ambiente SEFAZ" required>
          <Select {...register('ambiente')}>
            <option value="HOMOLOGACAO">Homologação (Testes)</option>
            <option value="PRODUCAO">Produção (Real)</option>
          </Select>
        </FormField>
        <FormField label="Provedor de Emissão">
          <Select {...register('providerNFe')}>
            <option value="FOCUS_NFE">FocusNFe (focus.nfe.io)</option>
            <option value="ENOTAS">eNotas (enotas.com.br)</option>
            <option value="SEFAZ_DIRETO">SEFAZ Direto (avançado)</option>
          </Select>
        </FormField>
      </div>
      <FormField label="API Key do Provedor" hint="Token de autenticação fornecido pelo provedor">
        <Input {...register('providerApiKey')} type="password" placeholder="••••••••••••••••" />
      </FormField>
      <FormField label="URL Base da API (opcional)" hint="Deixe em branco para usar a URL padrão do provedor">
        <Input {...register('providerApiUrl')} placeholder="https://homologacao.focusnfe.com.br" />
      </FormField>
      <div className="grid grid-cols-4 gap-4 pt-2 border-t border-gray-100">
        <FormField label="Série NF-e"><Input {...register('serieNFe', { valueAsNumber: true })} type="number" min="1" /></FormField>
        <FormField label="Próx. Número NF-e"><Input {...register('proximoNumeroNFe', { valueAsNumber: true })} type="number" min="1" /></FormField>
        <FormField label="Série NFC-e"><Input {...register('serieNFCe', { valueAsNumber: true })} type="number" min="1" /></FormField>
        <FormField label="Próx. Número NFC-e"><Input {...register('proximoNumeroNFCe', { valueAsNumber: true })} type="number" min="1" /></FormField>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
        <strong>Ambiente Homologação:</strong> NF-e emitidas não têm validade fiscal. Mude para <strong>Produção</strong> somente após validar com a contabilidade.
      </div>
      <SaveBar loading={mutation.isPending} dirty={isDirty} />
    </Form>
  )
}

// ─── Tab Certificado ─────────────────────────────────────────────────────────

function TabCertificado({ cert, onSave }: { cert: Record<string, unknown> | null; onSave: () => void }) {
  const [arquivo, setArquivo] = useState('')
  const [senha, setSenha] = useState('')
  const [validade, setValidade] = useState('')
  const [titular, setTitular] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/fiscal/certificado', { arquivoBase64: arquivo, senha, validade, titular }),
    onSuccess: onSave,
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setArquivo((reader.result as string).split(',')[1])
      const match = file.name.match(/(\d{8})/)
      if (match) {
        const d = match[1]
        setValidade(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`)
      }
    }
    reader.readAsDataURL(file)
  }

  const certValido = cert && new Date(String(cert.validade)) > new Date()
  const diasParaVencer = cert ? Math.ceil((new Date(String(cert.validade)).getTime() - Date.now()) / 86_400_000) : null

  return (
    <div className="space-y-5">
      {cert ? (
        <div className={clsx('flex items-start gap-4 p-4 rounded-xl border', certValido ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
          {certValido ? <CheckCircle2 size={24} className="text-green-600 shrink-0 mt-0.5" /> : <AlertTriangle size={24} className="text-red-600 shrink-0 mt-0.5" />}
          <div>
            <p className={clsx('font-semibold', certValido ? 'text-green-800' : 'text-red-800')}>
              {certValido ? 'Certificado Digital Ativo' : 'Certificado Vencido'}
            </p>
            <p className="text-sm text-gray-600">Titular: <strong>{String(cert.titular ?? 'Não informado')}</strong></p>
            <p className="text-sm text-gray-600">
              Validade: <strong>{new Date(String(cert.validade)).toLocaleDateString('pt-BR')}</strong>
              {diasParaVencer !== null && (
                <span className={clsx('ml-2 font-medium', diasParaVencer < 30 ? 'text-red-600' : 'text-green-600')}>
                  ({diasParaVencer > 0 ? `${diasParaVencer} dias restantes` : 'Vencido'})
                </span>
              )}
            </p>
            {!!cert.serialNumber && <p className="text-xs text-gray-400 font-mono mt-1">S/N: {String(cert.serialNumber)}</p>}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-6 text-center">
          <Shield size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">Nenhum certificado digital cadastrado</p>
          <p className="text-gray-400 text-xs mt-1">Necessário para assinar e emitir NF-e</p>
        </div>
      )}

      <div className="border-t border-gray-100 pt-5 space-y-4">
        <p className="text-sm font-semibold text-gray-700">{cert ? 'Atualizar Certificado' : 'Importar Certificado Digital A1'}</p>
        <FormField label="Arquivo PFX / P12">
          <label className="flex items-center gap-3 px-3 py-2.5 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
            <Upload size={16} className="text-gray-400" />
            <span className="text-sm text-gray-500">{arquivo ? 'Arquivo carregado ✓' : 'Selecionar arquivo .pfx ou .p12'}</span>
            <input type="file" accept=".pfx,.p12" onChange={handleFileChange} className="hidden" />
          </label>
        </FormField>
        <FormField label="Senha do Certificado">
          <Input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Validade" hint="Verifique no certificado emitido pela AC">
            <Input type="date" value={validade} onChange={e => setValidade(e.target.value)} />
          </FormField>
          <FormField label="Titular (Nome na AC)">
            <Input value={titular} onChange={e => setTitular(e.target.value)} placeholder="RAZAO SOCIAL LTDA:12345678000195" />
          </FormField>
        </div>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!arquivo || !senha || !validade}>
          Importar Certificado
        </Button>
      </div>
    </div>
  )
}

// ─── Barra de salvar ─────────────────────────────────────────────────────────

function SaveBar({ loading, dirty, error }: { loading: boolean; dirty: boolean; error?: boolean }) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
      {error ? (
        <p className="text-sm text-red-600">Erro ao salvar. Verifique os dados.</p>
      ) : dirty ? (
        <p className="text-sm text-amber-600">Você tem alterações não salvas.</p>
      ) : <span />}
      <Button type="submit" loading={loading}>Salvar Configuração</Button>
    </div>
  )
}
