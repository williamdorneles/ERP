import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  Save, Send, Download, ExternalLink, RefreshCw, Ban,
  CheckCircle2, XCircle, AlertTriangle, Clock,
} from 'lucide-react'
import clsx from 'clsx'
import { FormField, Input, Select, Textarea, CurrencyInput } from '../ui/FormField'
import { Button } from '../ui/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ItemNFe {
  id: string; nItem: number; cProd: string; xProd: string
  ncm: string; cfop: string; uCom: string
  qCom: number; vUnCom: number; vProd: number
  gtin?: string; origem?: number
  csosn?: string; cstICMS?: string; cstPIS?: string; cstCOFINS?: string
  pICMS?: number; pPIS?: number; pCOFINS?: number
  vPIS?: number; vCOFINS?: number
}

interface EventoNFe {
  id: string; tipo: string; descricao: string
  protocolo?: string; motivo?: string; criadoEm: string
}

interface NotaFiscalDetalhe {
  id: string; numero: number; serie: number; modelo: string; status: string
  naturezaOperacao: string; dataEmissao: string; finNFe?: number
  destNome: string; destCpfCnpj?: string; destIE?: string; destIndicadorIE?: number
  destCep?: string; destLogradouro?: string; destNumero?: string
  destBairro?: string; destMunicipio?: string; destUf?: string; destCodigoIBGE?: string
  vBC?: number; vICMS?: number; vIPI?: number; vPIS?: number; vCOFINS?: number
  vFrete?: number; vSeguro?: number; vDesconto: number; vNF: number
  formaPagamento?: string; infCpl?: string
  chave?: string; protocolo?: string; mensagemSefaz?: string
  referenciaNFe?: string; pedidoVendaId?: string
  pedidoVenda?: { estoqueElancado: boolean; financeiroLancado: boolean; numero: string }
  itens: ItemNFe[]
  eventos: EventoNFe[]
}

interface FormData {
  naturezaOperacao: string; infCpl: string; finNFe: string; dataEmissao: string
  destNome: string; destCpfCnpj: string; destIE: string; destIndicadorIE: string
  destCep: string; destLogradouro: string; destNumero: string
  destBairro: string; destMunicipio: string; destUf: string; destCodigoIBGE: string
  formaPagamento: string; vDesconto: number; vFrete: number; vSeguro: number
}

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_CONF: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDENTE:    { label: 'Pendente',    color: 'bg-gray-100 text-gray-600',   icon: <Clock size={12} /> },
  PROCESSANDO: { label: 'Processando', color: 'bg-blue-100 text-blue-700',   icon: <RefreshCw size={12} className="animate-spin" /> },
  AUTORIZADA:  { label: 'Autorizada',  color: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={12} /> },
  REJEITADA:   { label: 'Rejeitada',   color: 'bg-red-100 text-red-700',     icon: <XCircle size={12} /> },
  CANCELADA:   { label: 'Cancelada',   color: 'bg-gray-100 text-gray-500',   icon: <Ban size={12} /> },
  DENEGADA:    { label: 'Denegada',    color: 'bg-red-100 text-red-800',     icon: <AlertTriangle size={12} /> },
  INUTILIZADA: { label: 'Inutilizada', color: 'bg-gray-100 text-gray-400',   icon: <Ban size={12} /> },
}

const FIN_NFE: Record<string, string> = {
  '1': 'Normal', '2': 'Complementar', '3': 'Ajuste', '4': 'Devolução/Retorno',
}

const FORMAS_PAG: Record<string, string> = {
  '01': 'Dinheiro', '03': 'Cartão de Crédito', '04': 'Cartão de Débito',
  '15': 'A Prazo (Boleto)', '17': 'PIX', '90': 'Sem Pagamento',
}

const INDICADORES_IE: Record<string, string> = {
  '1': '1 — Contribuinte de ICMS',
  '2': '2 — Contribuinte isento',
  '9': '9 — Não contribuinte',
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' })

// ── Componente ────────────────────────────────────────────────────────────────

interface Props {
  notaId: string
  onClose: () => void
  onSuccess: () => void
}

export function NfeForm({ notaId, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient()
  const [abaItens, setAbaItens] = useState<'itens' | 'impostos'>('itens')
  const [confirmTransmitir, setConfirmTransmitir] = useState(false)
  const [itens, setItens] = useState<ItemNFe[]>([])
  const [form, setForm] = useState<FormData>({
    naturezaOperacao: '', infCpl: '', finNFe: '1', dataEmissao: '',
    destNome: '', destCpfCnpj: '', destIE: '', destIndicadorIE: '9',
    destCep: '', destLogradouro: '', destNumero: '',
    destBairro: '', destMunicipio: '', destUf: '', destCodigoIBGE: '',
    formaPagamento: '01', vDesconto: 0, vFrete: 0, vSeguro: 0,
  })

  const { data: nota, isLoading } = useQuery<NotaFiscalDetalhe>({
    queryKey: ['nota-fiscal', notaId],
    queryFn: () => api.get(`/fiscal/nfe/${notaId}`).then(r => r.data),
    refetchInterval: (q) => q.state.data?.status === 'PROCESSANDO' ? 5000 : false,
  })

  useEffect(() => {
    if (!nota) return
    setForm({
      naturezaOperacao: nota.naturezaOperacao ?? '',
      infCpl: nota.infCpl ?? '',
      finNFe: String(nota.finNFe ?? 1),
      dataEmissao: nota.dataEmissao?.slice(0, 10) ?? '',
      destNome: nota.destNome ?? '',
      destCpfCnpj: nota.destCpfCnpj ?? '',
      destIE: nota.destIE ?? '',
      destIndicadorIE: String(nota.destIndicadorIE ?? 9),
      destCep: nota.destCep ?? '',
      destLogradouro: nota.destLogradouro ?? '',
      destNumero: nota.destNumero ?? '',
      destBairro: nota.destBairro ?? '',
      destMunicipio: nota.destMunicipio ?? '',
      destUf: nota.destUf ?? '',
      destCodigoIBGE: nota.destCodigoIBGE ?? '',
      formaPagamento: nota.formaPagamento ?? '01',
      vDesconto: Number(nota.vDesconto ?? 0),
      vFrete: Number(nota.vFrete ?? 0),
      vSeguro: Number(nota.vSeguro ?? 0),
    })
    setItens(nota.itens)
  }, [nota])

  function updateItem(id: string, field: keyof ItemNFe, valor: string | number) {
    setItens(prev => prev.map(item => {
      if (item.id !== id) return item
      const atualizado = { ...item, [field]: valor }
      if (field === 'qCom' || field === 'vUnCom') {
        atualizado.vProd = +(Number(atualizado.qCom) * Number(atualizado.vUnCom)).toFixed(2)
      }
      return atualizado
    }))
  }

  const isPendente = nota?.status === 'PENDENTE'
  const isAutorizada = nota?.status === 'AUTORIZADA'
  const isRejeitada = nota?.status === 'REJEITADA'

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  async function buscarCep(cep: string) {
    const c = cep.replace(/\D/g, '')
    if (c.length !== 8) return
    try {
      const r = await api.get(`/lookup/cep/${c}`)
      const d = r.data
      setForm(f => ({
        ...f,
        destLogradouro: d.logradouro ?? f.destLogradouro,
        destBairro: d.bairro ?? f.destBairro,
        destMunicipio: d.municipio ?? f.destMunicipio,
        destUf: d.uf ?? f.destUf,
        destCodigoIBGE: d.codigoIBGE ?? f.destCodigoIBGE,
      }))
    } catch { /* silencioso */ }
  }

  const salvarMutation = useMutation({
    mutationFn: () => api.put(`/fiscal/nfe/${notaId}`, {
      naturezaOperacao: form.naturezaOperacao,
      infCpl: form.infCpl || undefined,
      finNFe: Number(form.finNFe),
      dataEmissao: form.dataEmissao || undefined,
      destNome: form.destNome,
      destCpfCnpj: form.destCpfCnpj || undefined,
      destIE: form.destIE || undefined,
      destIndicadorIE: Number(form.destIndicadorIE),
      destCep: form.destCep || undefined,
      destLogradouro: form.destLogradouro || undefined,
      destNumero: form.destNumero || undefined,
      destBairro: form.destBairro || undefined,
      destMunicipio: form.destMunicipio || undefined,
      destUf: form.destUf || undefined,
      destCodigoIBGE: form.destCodigoIBGE || undefined,
      formaPagamento: form.formaPagamento,
      vDesconto: form.vDesconto,
      vFrete: form.vFrete,
      vSeguro: form.vSeguro,
      itens: itens.map(i => ({
        id: i.id,
        xProd: i.xProd,
        cProd: i.cProd,
        qCom: Number(i.qCom),
        vUnCom: Number(i.vUnCom),
        vProd: Number(i.vProd),
        uCom: i.uCom,
        ncm: i.ncm,
        cfop: i.cfop,
        pICMS: i.pICMS !== undefined ? Number(i.pICMS) : undefined,
        pPIS: i.pPIS !== undefined ? Number(i.pPIS) : undefined,
        pCOFINS: i.pCOFINS !== undefined ? Number(i.pCOFINS) : undefined,
      })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nota-fiscal', notaId] })
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
    },
  })

  const transmitirMutation = useMutation({
    mutationFn: () => api.post(`/fiscal/nfe/${notaId}/transmitir`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nota-fiscal', notaId] })
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
      queryClient.invalidateQueries({ queryKey: ['nfe-estatisticas'] })
      queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] })
      setConfirmTransmitir(false)
      onSuccess()
    },
  })

  const reenviarMutation = useMutation({
    mutationFn: () => api.post(`/fiscal/nfe/${notaId}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nota-fiscal', notaId] })
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
      queryClient.invalidateQueries({ queryKey: ['nfe-estatisticas'] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
      </div>
    )
  }
  if (!nota) return null

  const sc = STATUS_CONF[nota.status] ?? STATUS_CONF.PENDENTE
  const totalItens = itens.reduce((s, i) => s + Number(i.vProd), 0)
  const totalNF = totalItens + form.vFrete + form.vSeguro - form.vDesconto

  const col = { num: 'w-8', sku: 'w-24', un: 'w-14', qtd: 'w-24', preco: 'w-32', total: 'w-28' }

  return (
    <div className="space-y-6">

      {/* ── Banner de status ──────────────────────────────────────────────── */}
      {!isPendente && (
        <div className={clsx(
          'rounded-xl border px-4 py-3 flex items-center gap-2 text-sm font-medium',
          isAutorizada ? 'border-green-200 bg-green-50 text-green-700'
            : isRejeitada ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-gray-200 bg-gray-50 text-gray-600',
        )}>
          {sc.icon}
          <span>{sc.label}</span>
          {nota.mensagemSefaz && (
            <span className="ml-1 opacity-70">— {nota.mensagemSefaz}</span>
          )}
        </div>
      )}

      <fieldset disabled={!isPendente} className="space-y-6 m-0 p-0 border-0 disabled:opacity-95">

        {/* ── Operação ─────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <FormField label="Natureza da Operação" required>
                <Input value={form.naturezaOperacao} onChange={set('naturezaOperacao')} />
              </FormField>
            </div>
            <FormField label="Número da NF-e" hint="Gerado automaticamente">
              <Input
                value={`${String(nota.numero).padStart(9, '0')}-${nota.serie}`}
                disabled readOnly className="text-gray-400 font-mono"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <FormField label="Finalidade">
                <Select value={form.finNFe} onChange={set('finNFe')}>
                  {Object.entries(FIN_NFE).map(([k, v]) => (
                    <option key={k} value={k}>{k} — {v}</option>
                  ))}
                </Select>
              </FormField>
            </div>
            <FormField label="Data de Emissão" required>
              <Input type="date" value={form.dataEmissao} onChange={set('dataEmissao')} />
            </FormField>
            <FormField label="Modelo">
              <Input
                value={nota.modelo === 'NFCE' ? 'NFC-e (65)' : 'NF-e (55)'}
                disabled readOnly className="text-gray-400"
              />
            </FormField>
          </div>
        </section>

        {/* ── Destinatário ─────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Destinatário</h3>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <FormField label="Nome / Razão Social" required>
                <Input value={form.destNome} onChange={set('destNome')} />
              </FormField>
            </div>
            <FormField label="Indicador IE">
              <Select value={form.destIndicadorIE} onChange={set('destIndicadorIE')}>
                {Object.entries(INDICADORES_IE).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <FormField label="CPF / CNPJ">
              <Input value={form.destCpfCnpj} onChange={set('destCpfCnpj')} placeholder="Somente números" />
            </FormField>
            {form.destIndicadorIE === '1' && (
              <FormField label="Inscrição Estadual">
                <Input value={form.destIE} onChange={set('destIE')} />
              </FormField>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 px-4 py-3 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Endereço do destinatário</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <FormField label="CEP">
                <Input
                  value={form.destCep}
                  onChange={set('destCep')}
                  onBlur={e => buscarCep(e.target.value)}
                  placeholder="00000-000"
                />
              </FormField>
              <div className="lg:col-span-2">
                <FormField label="Logradouro">
                  <Input value={form.destLogradouro} onChange={set('destLogradouro')} />
                </FormField>
              </div>
              <FormField label="Número">
                <Input value={form.destNumero} onChange={set('destNumero')} />
              </FormField>
              <FormField label="Bairro">
                <Input value={form.destBairro} onChange={set('destBairro')} />
              </FormField>
              <div className="lg:col-span-2">
                <FormField label="Município">
                  <Input value={form.destMunicipio} onChange={set('destMunicipio')} />
                </FormField>
              </div>
              <FormField label="UF">
                <Input value={form.destUf} onChange={set('destUf')} maxLength={2} className="uppercase" />
              </FormField>
            </div>
            <FormField label="Código IBGE" hint="7 dígitos">
              <Input
                value={form.destCodigoIBGE}
                onChange={set('destCodigoIBGE')}
                maxLength={7}
                className="font-mono"
              />
            </FormField>
          </div>
        </section>

        {/* ── Itens / Impostos (abas internas, read-only) ──────────────────── */}
        <section>
          <div className="flex items-center gap-4 border-b border-gray-200 mb-3">
            <button type="button" tabIndex={-1} onClick={() => setAbaItens('itens')}
              className={clsx(
                '-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition',
                abaItens === 'itens' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700',
              )}>
              Itens de produtos
            </button>
            <button type="button" tabIndex={-1} onClick={() => setAbaItens('impostos')}
              className={clsx(
                '-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition',
                abaItens === 'impostos' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700',
              )}>
              Impostos
            </button>
          </div>

          {abaItens === 'itens' && (
            <div className="border rounded-xl overflow-x-auto">
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50 text-xs font-medium text-gray-500">
                <div className={`${col.num} text-center`}>Nº</div>
                <div className="flex-1">Descrição</div>
                <div className={col.sku}>Código (SKU)</div>
                <div className={`${col.qtd} text-center`}>Qtde</div>
                <div className={`${col.un} text-center`}>UN</div>
                <div className={`${col.preco} text-right`}>Preço un</div>
                <div className={`${col.total} text-right`}>Total</div>
              </div>
              <div className="divide-y">
                {itens.map(item => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-1.5">
                    <div className={`${col.num} text-center text-xs text-gray-400 tabular-nums shrink-0`}>{item.nItem}</div>
                    <div className="flex-1 min-w-0">
                      <input
                        value={item.xProd}
                        onChange={e => updateItem(item.id, 'xProd', e.target.value)}
                        className="w-full px-1 py-0.5 text-sm border border-transparent rounded hover:border-gray-300 focus:border-primary-400 focus:outline-none bg-transparent"
                      />
                    </div>
                    <div className={`${col.sku} shrink-0`}>
                      <input
                        value={item.cProd}
                        onChange={e => updateItem(item.id, 'cProd', e.target.value)}
                        className="w-full px-1 py-0.5 text-xs font-mono border border-transparent rounded hover:border-gray-300 focus:border-primary-400 focus:outline-none bg-transparent"
                      />
                    </div>
                    <div className={`${col.qtd} shrink-0`}>
                      <input
                        type="number"
                        value={Number(item.qCom)}
                        onChange={e => updateItem(item.id, 'qCom', Number(e.target.value))}
                        step="0.001"
                        min="0"
                        className="w-full px-1 py-0.5 text-xs text-right tabular-nums border border-transparent rounded hover:border-gray-300 focus:border-primary-400 focus:outline-none bg-transparent"
                      />
                    </div>
                    <div className={`${col.un} shrink-0`}>
                      <input
                        value={item.uCom}
                        onChange={e => updateItem(item.id, 'uCom', e.target.value.toUpperCase())}
                        maxLength={6}
                        className="w-full px-1 py-0.5 text-xs text-center uppercase border border-transparent rounded hover:border-gray-300 focus:border-primary-400 focus:outline-none bg-transparent"
                      />
                    </div>
                    <div className={`${col.preco} shrink-0`}>
                      <input
                        type="number"
                        value={Number(item.vUnCom)}
                        onChange={e => updateItem(item.id, 'vUnCom', Number(e.target.value))}
                        step="0.0001"
                        min="0"
                        className="w-full px-1 py-0.5 text-xs text-right tabular-nums border border-transparent rounded hover:border-gray-300 focus:border-primary-400 focus:outline-none bg-transparent"
                      />
                    </div>
                    <div className={`${col.total} text-right text-xs font-semibold text-gray-800 tabular-nums shrink-0`}>
                      {fmt(Number(item.vProd))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end px-3 py-2 border-t bg-gray-50/60">
                <span className="text-xs text-gray-500">
                  Total produtos: <span className="font-semibold text-gray-800 tabular-nums ml-1">{fmt(totalItens)}</span>
                </span>
              </div>
            </div>
          )}

          {abaItens === 'impostos' && (
            <div className="border rounded-xl overflow-x-auto">
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50 text-xs font-medium text-gray-500">
                <div className="w-8 text-center shrink-0">Nº</div>
                <div className="flex-1">Descrição</div>
                <div className="w-28 shrink-0">NCM</div>
                <div className="w-20 text-center shrink-0">CFOP</div>
                <div className="w-20 text-center shrink-0">CSOSN/CST</div>
                <div className="w-28 text-right shrink-0">Vl Produto</div>
                <div className="w-20 text-right shrink-0">% PIS</div>
                <div className="w-20 text-right shrink-0">% COFINS</div>
              </div>
              <div className="divide-y">
                {itens.map(item => {
                  const vProd = Number(item.vProd)
                  return (
                    <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <div className="w-8 text-center text-gray-400 tabular-nums shrink-0">{item.nItem}</div>
                      <div className="flex-1 truncate text-gray-700 min-w-0">{item.xProd}</div>
                      <div className="w-28 shrink-0">
                        <input
                          value={item.ncm}
                          onChange={e => updateItem(item.id, 'ncm', e.target.value.replace(/\D/g, ''))}
                          maxLength={8}
                          className="w-full px-1 py-0.5 font-mono border border-transparent rounded hover:border-gray-300 focus:border-primary-400 focus:outline-none bg-transparent text-xs"
                        />
                      </div>
                      <div className="w-20 shrink-0">
                        <input
                          value={item.cfop}
                          onChange={e => updateItem(item.id, 'cfop', e.target.value.replace(/\D/g, ''))}
                          maxLength={4}
                          className="w-full px-1 py-0.5 text-center border border-transparent rounded hover:border-gray-300 focus:border-primary-400 focus:outline-none bg-transparent text-xs"
                        />
                      </div>
                      <div className="w-20 text-center text-gray-500 shrink-0">{item.csosn ?? item.cstICMS ?? '—'}</div>
                      <div className="w-28 text-right tabular-nums text-gray-700 shrink-0">{fmt(vProd)}</div>
                      <div className="w-20 shrink-0">
                        <input
                          type="number"
                          value={Number(item.pPIS ?? 0)}
                          onChange={e => updateItem(item.id, 'pPIS', Number(e.target.value))}
                          step="0.01"
                          min="0"
                          className="w-full px-1 py-0.5 text-right tabular-nums border border-transparent rounded hover:border-gray-300 focus:border-primary-400 focus:outline-none bg-transparent text-xs"
                        />
                      </div>
                      <div className="w-20 shrink-0">
                        <input
                          type="number"
                          value={Number(item.pCOFINS ?? 0)}
                          onChange={e => updateItem(item.id, 'pCOFINS', Number(e.target.value))}
                          step="0.01"
                          min="0"
                          className="w-full px-1 py-0.5 text-right tabular-nums border border-transparent rounded hover:border-gray-300 focus:border-primary-400 focus:outline-none bg-transparent text-xs"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="px-3 py-2 text-[11px] text-gray-400 border-t">
                NCM, CFOP e alíquotas editáveis. CSOSN/CST conforme cadastro do produto.
              </p>
            </div>
          )}
        </section>

        {/* ── Valores ──────────────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Valores</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FormField label="Desconto Geral">
              <CurrencyInput value={form.vDesconto} onChange={v => setForm(f => ({ ...f, vDesconto: v }))} />
            </FormField>
            <FormField label="Frete (pago pelo cliente)">
              <CurrencyInput value={form.vFrete} onChange={v => setForm(f => ({ ...f, vFrete: v }))} />
            </FormField>
            <FormField label="Seguro">
              <CurrencyInput value={form.vSeguro} onChange={v => setForm(f => ({ ...f, vSeguro: v }))} />
            </FormField>
            <FormField label="Forma de Pagamento">
              <Select value={form.formaPagamento} onChange={set('formaPagamento')}>
                {Object.entries(FORMAS_PAG).map(([k, v]) => (
                  <option key={k} value={k}>{k} — {v}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {[
              { label: 'Nº de itens', txt: String(nota.itens.length) },
              { label: 'Total produtos', txt: fmt(totalItens) },
              { label: 'Valor ICMS', txt: fmt(Number(nota.vICMS ?? 0)) },
              { label: 'Valor PIS', txt: fmt(Number(nota.vPIS ?? 0)) },
              { label: 'Valor COFINS', txt: fmt(Number(nota.vCOFINS ?? 0)) },
              { label: 'Total NF-e', txt: fmt(Math.max(totalNF, 0)), strong: true },
            ].map(c => (
              <div key={c.label} className={`rounded-lg border px-3 py-2 ${c.strong ? 'border-primary-200 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{c.label}</p>
                <p className={`text-sm font-semibold tabular-nums ${c.strong ? 'text-primary-700' : 'text-gray-800'}`}>{c.txt}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Informações Complementares ───────────────────────────────────── */}
        <FormField label="Informações Complementares (infCpl)" hint="Aparecem no DANFE">
          <Textarea
            value={form.infCpl}
            onChange={set('infCpl')}
            placeholder="Dados adicionais, referências legais, cláusula Simples Nacional..."
          />
        </FormField>

      </fieldset>

      {/* ── Chave / Protocolo (quando autorizada) ────────────────────────── */}
      {isAutorizada && nota.chave && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Chave de Acesso</p>
          <p className="text-xs font-mono text-green-800 break-all">{nota.chave}</p>
          {nota.protocolo && (
            <p className="text-xs text-green-600">Protocolo: {nota.protocolo}</p>
          )}
        </div>
      )}

      {/* ── Eventos ──────────────────────────────────────────────────────── */}
      {nota.eventos.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Eventos</h3>
          <div className="border rounded-xl divide-y">
            {nota.eventos.map(ev => (
              <div key={ev.id} className="flex items-start gap-3 px-4 py-3 text-xs">
                <span className="text-gray-400 font-mono whitespace-nowrap">
                  {new Date(ev.criadoEm).toLocaleString('pt-BR')}
                </span>
                <span className="font-medium text-gray-700">{ev.descricao}</span>
                {ev.motivo && <span className="text-gray-400">— {ev.motivo}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Erros ────────────────────────────────────────────────────────── */}
      {salvarMutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {String((salvarMutation.error as Error)?.message ?? 'Erro ao salvar')}
        </p>
      )}

      {/* ── Rodapé ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
        <div className="flex-1 min-w-0">
          {nota.chave ? (
            <p className="text-xs font-mono text-gray-400 truncate" title={nota.chave}>
              {nota.chave}
            </p>
          ) : (
            <span className="text-xs text-gray-300">Chave gerada após autorização</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="secondary" onClick={onClose}>Fechar</Button>

          {isPendente && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => salvarMutation.mutate()}
                loading={salvarMutation.isPending}
              >
                <Save size={14} className="mr-1" /> Salvar
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmTransmitir(true)}
                loading={transmitirMutation.isPending}
              >
                <Send size={14} className="mr-1" /> Transmitir para SEFAZ
              </Button>
            </>
          )}

          {isRejeitada && (
            <Button type="button" onClick={() => reenviarMutation.mutate()} loading={reenviarMutation.isPending}>
              <RefreshCw size={14} className="mr-1" /> Reenviar
            </Button>
          )}

          {isAutorizada && (
            <>
              <a href={`/api/fiscal/nfe/${notaId}/danfe`} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="secondary">
                  <Download size={14} className="mr-1" /> DANFE
                </Button>
              </a>
              <a href={`/api/fiscal/nfe/${notaId}/xml`} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="secondary">
                  <ExternalLink size={14} className="mr-1" /> XML
                </Button>
              </a>
            </>
          )}
        </div>
      </div>

      {/* ── Modal: Confirmar transmissão ─────────────────────────────────── */}
      {confirmTransmitir && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Transmitir NF-e para SEFAZ</h3>
            <p className="text-sm text-gray-600 mb-1">
              Confirma o envio da NF-e <strong>{String(nota.numero).padStart(9, '0')}</strong>?
            </p>
            {nota.pedidoVenda && (
              <ul className="text-xs text-gray-500 mb-4 space-y-0.5 list-disc pl-4">
                {!nota.pedidoVenda.estoqueElancado && (
                  <li>O estoque do pedido será lançado automaticamente.</li>
                )}
                {!nota.pedidoVenda.financeiroLancado && (
                  <li>O financeiro (contas a receber) será lançado automaticamente.</li>
                )}
                {nota.pedidoVenda.estoqueElancado && nota.pedidoVenda.financeiroLancado && (
                  <li>Estoque e financeiro já estão lançados no pedido.</li>
                )}
              </ul>
            )}
            {transmitirMutation.isError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-3">
                {String((transmitirMutation.error as Error)?.message ?? 'Erro ao transmitir')}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmTransmitir(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => transmitirMutation.mutate()}
                loading={transmitirMutation.isPending}
              >
                Confirmar e Transmitir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
