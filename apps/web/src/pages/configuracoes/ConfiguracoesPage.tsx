import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { Settings, Receipt, Building2, Shield, CheckCircle2, AlertTriangle, Upload } from 'lucide-react'
import clsx from 'clsx'

type Secao = 'sistema' | 'fiscal'
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

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
          Apenas administradores podem alterar configurações.
        </div>
      )}
      {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erro}</div>}
      {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{sucesso}</div>}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {configs.map(cfg => (
          <div key={cfg.chave} className="px-6 py-5 space-y-3">
            <div>
              <p className="font-medium text-gray-900">{LABELS[cfg.chave] ?? cfg.chave}</p>
              {cfg.descricao && <p className="text-xs text-gray-500 mt-0.5">{cfg.descricao}</p>}
            </div>

            {cfg.chave === 'METODO_CUSTO' && (
              <div className="flex gap-3">
                {(['MEDIO', 'ULTIMO'] as const).map(opcao => (
                  <button
                    key={opcao}
                    disabled={!isAdmin || salvando === cfg.chave}
                    onClick={() => salvar(cfg.chave, opcao)}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium border transition',
                      cfg.valor === opcao
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-primary-400',
                      (!isAdmin || salvando === cfg.chave) && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    {opcao === 'MEDIO' ? 'Custo Médio Ponderado' : 'Último Custo'}
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400">
              Atualizado em {new Date(cfg.atualizadoEm).toLocaleString('pt-BR')}
            </p>
          </div>
        ))}
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
    <form onSubmit={handleSubmit(d => mutation.mutate(d as never))} className="space-y-4">
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
    </form>
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
    <form onSubmit={handleSubmit(d => mutation.mutate(d as never))} className="space-y-4">
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
    </form>
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
    <form onSubmit={handleSubmit(d => mutation.mutate(d as never))} className="space-y-4">
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
    </form>
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
