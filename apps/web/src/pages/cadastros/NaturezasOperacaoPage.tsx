import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, FileText, Pencil, PowerOff, Power, Trash2, ArrowLeft, Boxes, DollarSign, BarChart3, Star } from 'lucide-react'
import clsx from 'clsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { Form } from '../../components/ui/Form'

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface Natureza {
  id: string
  codigo: string
  descricao: string
  ativo: boolean
  padraoVenda: boolean
  tipoOperacao: 'SAIDA' | 'ENTRADA'
  finalidadeNFe: 'NORMAL' | 'COMPLEMENTAR' | 'AJUSTE' | 'DEVOLUCAO'
  modeloPadrao?: 'NFE' | 'NFCE' | null
  cfop?: string | null
  movimentaEstoque: 'NENHUM' | 'SAIDA' | 'ENTRADA'
  geraFinanceiro: boolean
  geraReceitaDRE: boolean
  contaFinanceiraId?: string | null
  contaFinanceira?: { id: string; codigo: string; nome: string } | null
  csosn?: string | null; cstIcms?: string | null; aliquotaIcms?: number | string | null
  cstPis?: string | null; aliquotaPis?: number | string | null
  cstCofins?: string | null; aliquotaCofins?: number | string | null
  cstIpi?: string | null; aliquotaIpi?: number | string | null
  textoComplementar?: string | null
  _count: { pedidosVenda: number }
}

interface ContaFinanceira { id: string; codigo: string; nome: string; tipo: string; isAnalitica: boolean }

// ─── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  descricao: z.string().min(2, 'Obrigatório').max(120),
  tipoOperacao: z.enum(['SAIDA', 'ENTRADA']),
  finalidadeNFe: z.enum(['NORMAL', 'COMPLEMENTAR', 'AJUSTE', 'DEVOLUCAO']),
  modeloPadrao: z.string().optional(),
  cfop: z.string().max(5).optional(),
  movimentaEstoque: z.enum(['NENHUM', 'SAIDA', 'ENTRADA']),
  geraFinanceiro: z.enum(['SIM', 'NAO']),
  geraReceitaDRE: z.enum(['SIM', 'NAO']),
  contaFinanceiraId: z.string().optional(),
  csosn: z.string().max(4).optional(),
  cstIcms: z.string().max(3).optional(),
  aliquotaIcms: z.coerce.number().min(0).max(100).optional(),
  cstPis: z.string().max(2).optional(),
  aliquotaPis: z.coerce.number().min(0).max(100).optional(),
  cstCofins: z.string().max(2).optional(),
  aliquotaCofins: z.coerce.number().min(0).max(100).optional(),
  cstIpi: z.string().max(2).optional(),
  aliquotaIpi: z.coerce.number().min(0).max(100).optional(),
  textoComplementar: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const numOrUndef = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === '' ? undefined : Number(v)

// ─── Tabelas fiscais (código → descrição) ─────────────────────────────────────
const CSOSN_OPCOES: [string, string][] = [
  ['101', 'Tributada com permissão de crédito'],
  ['102', 'Tributada sem permissão de crédito'],
  ['103', 'Isenção do ICMS para faixa de receita'],
  ['201', 'Trib. c/ crédito e ICMS por ST'],
  ['202', 'Trib. s/ crédito e ICMS por ST'],
  ['203', 'Isenção por faixa de receita e ICMS por ST'],
  ['300', 'Imune'],
  ['400', 'Não tributada pelo Simples'],
  ['500', 'ICMS cobrado antes por ST/antecipação'],
  ['900', 'Outros'],
]
const CST_ICMS_OPCOES: [string, string][] = [
  ['00', 'Tributada integralmente'],
  ['10', 'Tributada e com cobrança por ST'],
  ['20', 'Com redução de base de cálculo'],
  ['30', 'Isenta/não trib. e com cobrança por ST'],
  ['40', 'Isenta'],
  ['41', 'Não tributada'],
  ['50', 'Suspensão'],
  ['51', 'Diferimento'],
  ['60', 'ICMS cobrado anteriormente por ST'],
  ['70', 'Redução de BC e cobrança por ST'],
  ['90', 'Outras'],
]
const CST_PISCOFINS_OPCOES: [string, string][] = [
  ['01', 'Tributável — alíquota básica'],
  ['02', 'Tributável — alíquota diferenciada'],
  ['03', 'Tributável — alíquota por unidade'],
  ['04', 'Monofásica — revenda à alíquota zero'],
  ['05', 'Tributável por ST'],
  ['06', 'Alíquota zero'],
  ['07', 'Isenta da contribuição'],
  ['08', 'Sem incidência da contribuição'],
  ['09', 'Com suspensão da contribuição'],
  ['49', 'Outras operações de saída'],
  ['99', 'Outras operações'],
]
const CST_IPI_OPCOES: [string, string][] = [
  ['50', 'Saída tributada'],
  ['51', 'Saída tributável — alíquota zero'],
  ['52', 'Saída isenta'],
  ['53', 'Saída não-tributada'],
  ['54', 'Saída imune'],
  ['55', 'Saída com suspensão'],
  ['99', 'Outras saídas'],
]

// ─── Formulário ───────────────────────────────────────────────────────────────

function NaturezaForm({ initialData, onSuccess, onCancel }: {
  initialData?: Natureza; onSuccess: () => void; onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const isEditing = !!initialData

  const { data: contas = [] } = useQuery<ContaFinanceira[]>({
    queryKey: ['contas-financeiras'],
    queryFn: () => api.get('/financeiro/contas').then(r => r.data),
  })
  const contasReceita = contas.filter(c => c.isAnalitica && c.tipo === 'RECEITA')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData ? {
      descricao: initialData.descricao,
      tipoOperacao: initialData.tipoOperacao,
      finalidadeNFe: initialData.finalidadeNFe,
      modeloPadrao: initialData.modeloPadrao ?? '',
      cfop: initialData.cfop ?? '',
      movimentaEstoque: initialData.movimentaEstoque,
      geraFinanceiro: initialData.geraFinanceiro ? 'SIM' : 'NAO',
      geraReceitaDRE: initialData.geraReceitaDRE ? 'SIM' : 'NAO',
      contaFinanceiraId: initialData.contaFinanceiraId ?? '',
      csosn: initialData.csosn ?? '',
      cstIcms: initialData.cstIcms ?? '',
      aliquotaIcms: numOrUndef(initialData.aliquotaIcms),
      cstPis: initialData.cstPis ?? '',
      aliquotaPis: numOrUndef(initialData.aliquotaPis),
      cstCofins: initialData.cstCofins ?? '',
      aliquotaCofins: numOrUndef(initialData.aliquotaCofins),
      cstIpi: initialData.cstIpi ?? '',
      aliquotaIpi: numOrUndef(initialData.aliquotaIpi),
      textoComplementar: initialData.textoComplementar ?? '',
    } : {
      tipoOperacao: 'SAIDA', finalidadeNFe: 'NORMAL', movimentaEstoque: 'SAIDA',
      geraFinanceiro: 'SIM', geraReceitaDRE: 'SIM',
    },
  })

  const geraReceita = watch('geraReceitaDRE') === 'SIM'

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const s = (v?: string) => (v && v.trim() ? v.trim() : undefined)
      const payload = {
        ...data,
        geraFinanceiro: data.geraFinanceiro === 'SIM',
        geraReceitaDRE: data.geraReceitaDRE === 'SIM',
        modeloPadrao: s(data.modeloPadrao),
        cfop: s(data.cfop),
        contaFinanceiraId: s(data.contaFinanceiraId),
        csosn: s(data.csosn), cstIcms: s(data.cstIcms),
        cstPis: s(data.cstPis), cstCofins: s(data.cstCofins), cstIpi: s(data.cstIpi),
        textoComplementar: s(data.textoComplementar),
      }
      return isEditing
        ? api.put(`/naturezas-operacao/${initialData.id}`, payload)
        : api.post('/naturezas-operacao', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['naturezas-operacao'] })
      onSuccess()
    },
  })

  const secao = (t: string) => <h3 className="text-sm font-semibold text-gray-800 mt-2">{t}</h3>

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      {/* Descrição + CFOP */}
      <div className="grid grid-cols-4 gap-3 items-start">
        <div className="col-span-3">
          <FormField label="Descrição (natureza da operação)" error={errors.descricao?.message} required>
            <Input {...register('descricao')} placeholder="Venda de mercadoria" error={!!errors.descricao} autoFocus />
          </FormField>
        </div>
        <FormField label="CFOP base" error={errors.cfop?.message} hint="Informe o 1º dígito com x">
          <Input {...register('cfop')} placeholder="x102" />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Tipo de Operação">
          <Select {...register('tipoOperacao')}>
            <option value="SAIDA">Saída</option>
            <option value="ENTRADA">Entrada</option>
          </Select>
        </FormField>
        <FormField label="Finalidade NF-e">
          <Select {...register('finalidadeNFe')}>
            <option value="NORMAL">Normal</option>
            <option value="COMPLEMENTAR">Complementar</option>
            <option value="AJUSTE">Ajuste</option>
            <option value="DEVOLUCAO">Devolução</option>
          </Select>
        </FormField>
        <FormField label="Documento padrão">
          <Select {...register('modeloPadrao')}>
            <option value="">— (decide pelo canal) —</option>
            <option value="NFE">NF-e (55)</option>
            <option value="NFCE">NFC-e (65)</option>
          </Select>
        </FormField>
      </div>

      {/* Efeitos */}
      {secao('Efeitos da operação')}
      <div className="grid grid-cols-3 gap-3 items-start">
        <FormField label="Movimenta estoque">
          <Select {...register('movimentaEstoque')}>
            <option value="NENHUM">Não movimenta</option>
            <option value="SAIDA">Baixa (saída)</option>
            <option value="ENTRADA">Entrada</option>
          </Select>
        </FormField>
        <FormField label="Gera financeiro" hint="Conta a receber / caixa">
          <Select {...register('geraFinanceiro')}>
            <option value="SIM">Sim</option>
            <option value="NAO">Não</option>
          </Select>
        </FormField>
        <FormField label="Gera receita no DRE">
          <Select {...register('geraReceitaDRE')}>
            <option value="SIM">Sim</option>
            <option value="NAO">Não</option>
          </Select>
        </FormField>
      </div>
      {geraReceita && (
        <FormField label="Conta de receita (DRE)" hint="Plano de contas analítico de receita onde a venda é classificada">
          <Select {...register('contaFinanceiraId')}>
            <option value="">— selecione —</option>
            {contasReceita.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
          </Select>
        </FormField>
      )}

      {/* Tributação */}
      {secao('Tributação')}
      <div className="grid grid-cols-3 gap-3">
        <FormField label="CSOSN (Simples)">
          <Select {...register('csosn')}>
            <option value="">— selecione —</option>
            {CSOSN_OPCOES.map(([v, d]) => <option key={v} value={v}>{v} — {d}</option>)}
          </Select>
        </FormField>
        <FormField label="CST ICMS (Normal)">
          <Select {...register('cstIcms')}>
            <option value="">— selecione —</option>
            {CST_ICMS_OPCOES.map(([v, d]) => <option key={v} value={v}>{v} — {d}</option>)}
          </Select>
        </FormField>
        <FormField label="Alíquota ICMS %"><Input {...register('aliquotaIcms')} type="number" step="0.01" min="0" placeholder="0" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="CST PIS">
          <Select {...register('cstPis')}>
            <option value="">— selecione —</option>
            {CST_PISCOFINS_OPCOES.map(([v, d]) => <option key={v} value={v}>{v} — {d}</option>)}
          </Select>
        </FormField>
        <FormField label="Alíquota PIS %"><Input {...register('aliquotaPis')} type="number" step="0.0001" min="0" placeholder="0" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="CST COFINS">
          <Select {...register('cstCofins')}>
            <option value="">— selecione —</option>
            {CST_PISCOFINS_OPCOES.map(([v, d]) => <option key={v} value={v}>{v} — {d}</option>)}
          </Select>
        </FormField>
        <FormField label="Alíquota COFINS %"><Input {...register('aliquotaCofins')} type="number" step="0.0001" min="0" placeholder="0" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="CST IPI">
          <Select {...register('cstIpi')}>
            <option value="">— selecione —</option>
            {CST_IPI_OPCOES.map(([v, d]) => <option key={v} value={v}>{v} — {d}</option>)}
          </Select>
        </FormField>
        <FormField label="Alíquota IPI %"><Input {...register('aliquotaIpi')} type="number" step="0.0001" min="0" placeholder="0" /></FormField>
      </div>

      {/* Fiscal */}
      {secao('Texto fiscal padrão (infCpl)')}
      <FormField label="Observações fiscais" hint="Vão para as informações complementares da NF-e">
        <Textarea {...register('textoComplementar')} rows={2} placeholder="Documento emitido por ME/EPP optante pelo Simples Nacional..." />
      </FormField>

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error
            ?? 'Erro ao salvar. Verifique os dados e tente novamente.'}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={mutation.isPending}>{isEditing ? 'Salvar Alterações' : 'Salvar'}</Button>
      </div>
    </Form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const tipoCor: Record<string, string> = {
  SAIDA: 'bg-blue-100 text-blue-700',
  ENTRADA: 'bg-purple-100 text-purple-700',
}

export function NaturezasOperacaoPage() {
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [mostrarInativas, setMostrarInativas] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editando, setEditando] = useState<Natureza | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Natureza | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState<Natureza | null>(null)
  const [erro, setErro] = useState('')

  const { data: naturezas = [], isLoading } = useQuery<Natureza[]>({
    queryKey: ['naturezas-operacao'],
    queryFn: () => api.get('/naturezas-operacao').then(r => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/naturezas-operacao/${id}/toggle-ativo`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['naturezas-operacao'] }); setConfirmToggle(null) },
  })

  const excluirMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/naturezas-operacao/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['naturezas-operacao'] }); setConfirmExcluir(null); setErro('') },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      setErro(e.response?.data?.error ?? 'Erro ao excluir.'); setConfirmExcluir(null)
    },
  })

  const padraoMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/naturezas-operacao/${id}/definir-padrao`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['naturezas-operacao'] }); setErro('') },
    onError: (e: { response?: { data?: { error?: string } } }) => setErro(e.response?.data?.error ?? 'Erro ao definir padrão.'),
  })

  const filtradas = naturezas.filter(n => {
    if (!mostrarInativas && !n.ativo) return false
    if (busca) {
      const q = busca.toLowerCase()
      if (!n.codigo.toLowerCase().includes(q) && !n.descricao.toLowerCase().includes(q)) return false
    }
    return true
  })

  function fechar() { setPanelOpen(false); setEditando(null) }

  if (panelOpen) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={fechar} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600"><ArrowLeft size={18} /></button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{editando ? `Editar — ${editando.descricao}` : 'Nova Natureza de Operação'}</h2>
            <p className="text-xs text-gray-400">Naturezas de Operação</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl">
          <NaturezaForm initialData={editando ?? undefined} onSuccess={fechar} onCancel={fechar} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Naturezas de Operação</h2>
          <p className="text-gray-500 text-sm">{naturezas.length} cadastrada(s) · perfil fiscal de CFOP, impostos e efeitos</p>
        </div>
        <button onClick={() => { setEditando(null); setPanelOpen(true) }}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> Nova Natureza
        </button>
      </div>

      {erro && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>}

      <div className="flex flex-wrap gap-3">
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por código ou descrição..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[360px]" />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={mostrarInativas} onChange={e => setMostrarInativas(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          Mostrar inativas
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Nenhuma natureza encontrada.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">CFOP</th>
                <th className="px-4 py-3 text-center">Efeitos</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtradas.map(n => (
                <tr key={n.id} onClick={() => { setEditando(n); setPanelOpen(true) }}
                  className={clsx('hover:bg-gray-50 cursor-pointer transition', !n.ativo && 'opacity-50')}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <span className="inline-flex items-center gap-1.5">
                      {n.descricao}
                      {n.padraoVenda && (
                        <span title="Padrão para novos pedidos de venda"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                          <Star size={10} className="fill-amber-500 text-amber-500" /> Padrão
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', tipoCor[n.tipoOperacao])}>
                      {n.tipoOperacao === 'SAIDA' ? 'Saída' : 'Entrada'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {n.cfop || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2 text-gray-300">
                      <span title={`Estoque: ${n.movimentaEstoque}`} className={n.movimentaEstoque !== 'NENHUM' ? 'text-blue-500' : ''}><Boxes size={15} /></span>
                      <span title="Gera financeiro" className={n.geraFinanceiro ? 'text-green-600' : ''}><DollarSign size={15} /></span>
                      <span title="Entra no DRE" className={n.geraReceitaDRE ? 'text-indigo-600' : ''}><BarChart3 size={15} /></span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', n.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                      {n.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {n.tipoOperacao === 'SAIDA' && (
                        <button onClick={e => { e.stopPropagation(); padraoMutation.mutate(n.id) }}
                          title={n.padraoVenda ? 'Remover como padrão de venda' : 'Definir como padrão de venda'}
                          className={clsx('p-1.5 rounded-lg transition', n.padraoVenda ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50')}>
                          <Star size={14} className={n.padraoVenda ? 'fill-amber-500' : ''} />
                        </button>
                      )}
                      <button onClick={e => { e.stopPropagation(); setEditando(n); setPanelOpen(true) }} title="Editar"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition"><Pencil size={14} /></button>
                      <button onClick={e => { e.stopPropagation(); setConfirmToggle(n) }} title={n.ativo ? 'Desativar' : 'Reativar'}
                        className={clsx('p-1.5 rounded-lg transition', n.ativo ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50')}>
                        {n.ativo ? <PowerOff size={14} /> : <Power size={14} />}
                      </button>
                      <button onClick={e => { e.stopPropagation(); setErro(''); setConfirmExcluir(n) }} title="Excluir"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"><Trash2 size={14} /></button>
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
        title={confirmToggle?.ativo ? 'Desativar Natureza' : 'Reativar Natureza'}
        message={confirmToggle?.ativo
          ? `Deseja desativar "${confirmToggle?.descricao}"? Ela não aparecerá mais na seleção do pedido.`
          : `Deseja reativar "${confirmToggle?.descricao}"?`}
        confirmLabel={confirmToggle?.ativo ? 'Desativar' : 'Reativar'}
        variant={confirmToggle?.ativo ? 'danger' : 'warning'}
        loading={toggleMutation.isPending}
        onConfirm={() => confirmToggle && toggleMutation.mutate(confirmToggle.id)}
        onCancel={() => setConfirmToggle(null)}
      />

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir Natureza de Operação"
        message={`Deseja excluir permanentemente "${confirmExcluir?.descricao}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={excluirMutation.isPending}
        onConfirm={() => confirmExcluir && excluirMutation.mutate(confirmExcluir.id)}
        onCancel={() => setConfirmExcluir(null)}
      />
    </div>
  )
}
