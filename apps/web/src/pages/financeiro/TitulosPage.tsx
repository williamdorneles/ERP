import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, ChevronDown, ChevronRight, X, CheckCircle2,
  AlertTriangle, Clock, TrendingDown, TrendingUp, Calendar,
  Ban, CreditCard,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../lib/api'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

// ── Types ──────────────────────────────────────────────────────────────────

interface Parcela {
  id: string
  numero: number
  valor: number
  vencimento: string
  status: 'ABERTO' | 'QUITADO' | 'CANCELADO'
  dataBaixa?: string
  valorPago?: number
  contaBancaria?: { id: string; nome: string }
  observacao?: string
}

interface Titulo {
  id: string
  tipo: 'PAGAR' | 'RECEBER'
  descricao: string
  total: number
  status: 'ABERTO' | 'PARCIAL' | 'QUITADO' | 'CANCELADO'
  pessoa?: { id: string; nome: string; documento: string }
  contaFinanceira?: { id: string; codigo: string; nome: string }
  parcelas: Parcela[]
  criadoEm: string
  observacao?: string
}

interface Resumo {
  totalPagar: number
  totalReceber: number
  vencidosPagar: { valor: number; quantidade: number }
  vencidosReceber: { valor: number; quantidade: number }
  vencendo7Dias: { valor: number; quantidade: number }
}

interface ContaBancaria { id: string; nome: string; isCaixa: boolean }
interface ContaFinanceira { id: string; codigo: string; nome: string }
interface Pessoa { id: string; nome: string; documento: string }

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (s: string) => new Date(s + (s.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR')
const today = () => new Date().toISOString().split('T')[0]

function isVencido(vencimento: string) {
  return new Date(vencimento + 'T23:59:59') < new Date()
}

function statusBadge(status: string, vencimento?: string) {
  if (status === 'QUITADO') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Quitado</span>
  if (status === 'CANCELADO') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Cancelado</span>
  if (status === 'PARCIAL') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Parcial</span>
  if (vencimento && isVencido(vencimento)) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Vencido</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Aberto</span>
}

// ── Summary Cards ──────────────────────────────────────────────────────────

function SummaryCards({ resumo, tipo }: { resumo: Resumo; tipo: 'PAGAR' | 'RECEBER' }) {
  const isPagar = tipo === 'PAGAR'
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className={clsx('rounded-xl p-4 border', isPagar ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100')}>
        <p className={clsx('text-xs font-medium', isPagar ? 'text-red-500' : 'text-green-600')}>Total em aberto</p>
        <p className={clsx('text-xl font-bold mt-1', isPagar ? 'text-red-700' : 'text-green-700')}>
          {fmt(isPagar ? resumo.totalPagar : resumo.totalReceber)}
        </p>
        {isPagar ? <TrendingDown size={16} className="text-red-400 mt-1" /> : <TrendingUp size={16} className="text-green-400 mt-1" />}
      </div>
      <div className="rounded-xl p-4 border bg-red-50 border-red-100">
        <p className="text-xs font-medium text-red-500">Vencidos</p>
        <p className="text-xl font-bold mt-1 text-red-700">
          {fmt(isPagar ? resumo.vencidosPagar.valor : resumo.vencidosReceber.valor)}
        </p>
        <p className="text-xs text-red-500 mt-1">
          {isPagar ? resumo.vencidosPagar.quantidade : resumo.vencidosReceber.quantidade} parcelas
        </p>
      </div>
      <div className="rounded-xl p-4 border bg-amber-50 border-amber-100">
        <p className="text-xs font-medium text-amber-600">Vencendo em 7 dias</p>
        <p className="text-xl font-bold mt-1 text-amber-700">{fmt(resumo.vencendo7Dias.valor)}</p>
        <p className="text-xs text-amber-500 mt-1">{resumo.vencendo7Dias.quantidade} parcelas</p>
      </div>
      <div className="rounded-xl p-4 border bg-blue-50 border-blue-100">
        <p className="text-xs font-medium text-blue-600">Saldo líquido</p>
        <p className="text-xl font-bold mt-1 text-blue-700">{fmt(resumo.totalReceber - resumo.totalPagar)}</p>
        <p className="text-xs text-blue-400 mt-1">Receber - Pagar</p>
      </div>
    </div>
  )
}

// ── Baixa Modal ────────────────────────────────────────────────────────────

function ModalBaixa({
  parcela, tituloId, contas, onClose
}: {
  parcela: Parcela; tituloId: string; contas: ContaBancaria[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    dataBaixa: today(),
    valorPago: String(parcela.valor),
    contaBancariaId: contas[0]?.id ?? '',
    observacao: '',
  })

  const baixar = useMutation({
    mutationFn: () => api.post(`/titulos/${tituloId}/parcelas/${parcela.id}/baixar`, {
      ...form,
      valorPago: Number(form.valorPago),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['titulos'] })
      qc.invalidateQueries({ queryKey: ['titulos-resumo'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Baixar Parcela {parcela.numero}</h3>
            <p className="text-sm text-gray-500">Vencimento: {fmtDate(parcela.vencimento)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data da Baixa</label>
              <input type="date" value={form.dataBaixa}
                onChange={e => setForm(f => ({ ...f, dataBaixa: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor Pago</label>
              <input type="number" step="0.01" value={form.valorPago}
                onChange={e => setForm(f => ({ ...f, valorPago: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conta Bancária</label>
            <select value={form.contaBancariaId}
              onChange={e => setForm(f => ({ ...f, contaBancariaId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.isCaixa ? ' (Caixa)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <input type="text" value={form.observacao} placeholder="Opcional"
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>
          {(baixar.error as Error | null)?.message && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{(baixar.error as Error).message}</p>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => baixar.mutate()}
            disabled={baixar.isPending || !form.contaBancariaId}
            className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={16} />
            {baixar.isPending ? 'Baixando...' : 'Confirmar Baixa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Titulo Row ─────────────────────────────────────────────────────────────

function TituloRow({
  titulo, contas, onCancelar
}: {
  titulo: Titulo; contas: ContaBancaria[]; onCancelar: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [baixando, setBaixando] = useState<Parcela | null>(null)
  const qc = useQueryClient()

  const cancelarParcela = useMutation({
    mutationFn: (parcelaId: string) => api.patch(`/titulos/${titulo.id}/parcelas/${parcelaId}/cancelar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['titulos'] })
      qc.invalidateQueries({ queryKey: ['titulos-resumo'] })
    },
  })

  const isPagar = titulo.tipo === 'PAGAR'
  const abertas = titulo.parcelas.filter(p => p.status === 'ABERTO')
  const vencidas = abertas.filter(p => isVencido(p.vencimento))

  return (
    <>
      <div className={clsx('border rounded-xl overflow-hidden', titulo.status === 'CANCELADO' && 'opacity-60')}>
        <div
          className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer select-none"
          onClick={() => setOpen(o => !o)}
        >
          <div className={clsx('p-2 rounded-lg', isPagar ? 'bg-red-100' : 'bg-green-100')}>
            {isPagar
              ? <TrendingDown size={16} className="text-red-600" />
              : <TrendingUp size={16} className="text-green-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{titulo.descricao}</p>
            {titulo.pessoa && <p className="text-xs text-gray-500 truncate">{titulo.pessoa.nome}</p>}
          </div>
          <div className="text-right mr-2 hidden sm:block">
            <p className={clsx('font-semibold', isPagar ? 'text-red-700' : 'text-green-700')}>{fmt(titulo.total)}</p>
            <p className="text-xs text-gray-400">{titulo.parcelas.length} parcela(s)</p>
          </div>
          {vencidas.length > 0 && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              <AlertTriangle size={12} /> {vencidas.length} vencida(s)
            </span>
          )}
          {statusBadge(titulo.status)}
          {titulo.status === 'ABERTO' && (
            <button
              onClick={e => { e.stopPropagation(); onCancelar(titulo.id) }}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
              title="Cancelar título"
            >
              <Ban size={16} />
            </button>
          )}
          {open ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
        </div>

        {open && (
          <div className="border-t bg-gray-50 px-4 py-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left pb-2 font-medium">Parcela</th>
                  <th className="text-left pb-2 font-medium">Vencimento</th>
                  <th className="text-right pb-2 font-medium">Valor</th>
                  <th className="text-left pb-2 font-medium pl-4">Status</th>
                  <th className="text-right pb-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {titulo.parcelas.map(p => (
                  <tr key={p.id} className={clsx('', p.status === 'CANCELADO' && 'opacity-50')}>
                    <td className="py-2 text-gray-700 font-medium">{p.numero}</td>
                    <td className={clsx('py-2', p.status === 'ABERTO' && isVencido(p.vencimento) && 'text-red-600 font-medium')}>
                      {fmtDate(p.vencimento)}
                      {p.status === 'ABERTO' && isVencido(p.vencimento) && <AlertTriangle size={12} className="inline ml-1" />}
                    </td>
                    <td className="py-2 text-right font-mono">{fmt(p.valor)}</td>
                    <td className="py-2 pl-4">
                      {statusBadge(p.status)}
                      {p.status === 'QUITADO' && p.dataBaixa && (
                        <span className="ml-2 text-xs text-gray-400">Pago {fmtDate(p.dataBaixa)} · {fmt(p.valorPago ?? 0)}</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {p.status === 'ABERTO' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setBaixando(p)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <CreditCard size={12} /> Baixar
                          </button>
                          <button
                            onClick={() => cancelarParcela.mutate(p.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-100"
                          >
                            <Ban size={12} /> Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {titulo.observacao && (
              <p className="text-xs text-gray-500 mt-2 pt-2 border-t">Obs: {titulo.observacao}</p>
            )}
          </div>
        )}
      </div>

      {baixando && (
        <ModalBaixa
          parcela={baixando}
          tituloId={titulo.id}
          contas={contas}
          onClose={() => setBaixando(null)}
        />
      )}
    </>
  )
}

// ── Formulário de criação ──────────────────────────────────────────────────

interface ParcelaForm { numero: number; valor: string; vencimento: string; observacao: string }

function ModalCriarTitulo({
  tipo, pessoas, contas, contasFinanceiras, onClose
}: {
  tipo: 'PAGAR' | 'RECEBER'
  pessoas: Pessoa[]
  contas: ContaBancaria[]
  contasFinanceiras: ContaFinanceira[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    descricao: '',
    pessoaId: '',
    contaFinanceiraId: '',
    observacao: '',
  })
  const [parcelas, setParcelas] = useState<ParcelaForm[]>([
    { numero: 1, valor: '', vencimento: today(), observacao: '' },
  ])
  const [error, setError] = useState('')

  function addParcela() {
    const lastVenc = parcelas[parcelas.length - 1]?.vencimento ?? today()
    const nextDate = new Date(lastVenc + 'T12:00:00')
    nextDate.setMonth(nextDate.getMonth() + 1)
    setParcelas(p => [...p, {
      numero: p.length + 1,
      valor: '',
      vencimento: nextDate.toISOString().split('T')[0],
      observacao: '',
    }])
  }

  function updateParcela(i: number, field: keyof ParcelaForm, value: string) {
    setParcelas(p => p.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  }

  function removeParcela(i: number) {
    if (parcelas.length === 1) return
    setParcelas(p => p.filter((_, idx) => idx !== i).map((item, idx) => ({ ...item, numero: idx + 1 })))
  }

  const total = parcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)

  const criar = useMutation({
    mutationFn: () => api.post('/titulos', {
      tipo,
      descricao: form.descricao,
      pessoaId: form.pessoaId || undefined,
      contaFinanceiraId: form.contaFinanceiraId || undefined,
      observacao: form.observacao || undefined,
      parcelas: parcelas.map(p => ({
        numero: p.numero,
        valor: Number(p.valor),
        vencimento: p.vencimento,
        observacao: p.observacao || undefined,
      })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['titulos'] })
      qc.invalidateQueries({ queryKey: ['titulos-resumo'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
          <h3 className="font-semibold text-gray-900">
            Novo Título a {tipo === 'PAGAR' ? 'Pagar' : 'Receber'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
            <input type="text" value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Conta de energia, Aluguel..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tipo === 'PAGAR' ? 'Fornecedor' : 'Cliente'}
              </label>
              <select value={form.pessoaId}
                onChange={e => setForm(f => ({ ...f, pessoaId: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <option value="">— Selecionar —</option>
                {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta (Plano de Contas)</label>
              <select value={form.contaFinanceiraId}
                onChange={e => setForm(f => ({ ...f, contaFinanceiraId: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <option value="">— Selecionar —</option>
                {contasFinanceiras.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Parcelas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Parcelas</label>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">Total: {fmt(total)}</span>
                <button onClick={addParcela}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {parcelas.map((p, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                  <span className="w-6 text-center text-sm font-medium text-gray-500">{p.numero}</span>
                  <input type="number" step="0.01" placeholder="Valor" value={p.valor}
                    onChange={e => updateParcela(i, 'valor', e.target.value)}
                    className="flex-1 border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                  <input type="date" value={p.vencimento}
                    onChange={e => updateParcela(i, 'vencimento', e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                  <input type="text" placeholder="Obs" value={p.observacao}
                    onChange={e => updateParcela(i, 'observacao', e.target.value)}
                    className="w-28 border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                  {parcelas.length > 1 && (
                    <button onClick={() => removeParcela(i)} className="p-1 text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <input type="text" value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              placeholder="Opcional"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => criar.mutate()}
            disabled={criar.isPending || !form.descricao || parcelas.some(p => !p.valor || !p.vencimento)}
            className={clsx(
              'flex-1 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2',
              tipo === 'PAGAR' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700',
            )}
          >
            <Plus size={16} />
            {criar.isPending ? 'Salvando...' : `Criar Título a ${tipo === 'PAGAR' ? 'Pagar' : 'Receber'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function TitulosPage() {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<'PAGAR' | 'RECEBER'>('PAGAR')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroVencidos, setFiltroVencidos] = useState(false)
  const [criando, setCriando] = useState(false)
  const [cancelarId, setCancelarId] = useState<string | null>(null)
  const [cancelarErro, setCancelarErro] = useState('')

  const params = useMemo(() => {
    const p: Record<string, string> = { tipo }
    if (filtroStatus) p.status = filtroStatus
    else p.status = ''
    if (filtroVencidos) p.vencidos = 'true'
    return p
  }, [tipo, filtroStatus, filtroVencidos])

  const { data: resumo } = useQuery<Resumo>({
    queryKey: ['titulos-resumo'],
    queryFn: () => api.get('/titulos/resumo').then(r => r.data),
  })

  const { data: lista, isLoading } = useQuery<{ dados: Titulo[] }>({
    queryKey: ['titulos', params],
    queryFn: () => {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v) })
      return api.get(`/titulos?${qs}`).then(r => r.data)
    },
  })

  const { data: contas } = useQuery<{ dados: ContaBancaria[] }>({
    queryKey: ['contas-bancarias-lista'],
    queryFn: () => api.get('/financeiro/contas-bancarias').then(r => r.data),
  })

  const { data: contasFinanceiras } = useQuery<ContaFinanceira[]>({
    queryKey: ['contas-financeiras-lista'],
    queryFn: () => api.get('/financeiro/contas').then(r => r.data),
  })

  const { data: pessoas } = useQuery<{ dados: Pessoa[] }>({
    queryKey: ['pessoas-lista'],
    queryFn: () => api.get('/pessoas').then(r => r.data),
  })

  const cancelarTitulo = useMutation({
    mutationFn: (id: string) => api.patch(`/titulos/${id}/cancelar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['titulos'] })
      qc.invalidateQueries({ queryKey: ['titulos-resumo'] })
      setCancelarId(null)
    },
    onError: (e: Error) => setCancelarErro(e.message),
  })

  const titulos = useMemo(() => {
    const list = lista?.dados ?? []
    if (!busca.trim()) return list
    const q = busca.toLowerCase()
    return list.filter(t =>
      t.descricao.toLowerCase().includes(q) ||
      t.pessoa?.nome.toLowerCase().includes(q)
    )
  }, [lista, busca])

  const contasList = contas?.dados ?? []
  const contasFinanceirasList = (contasFinanceiras ?? []).filter(c => c.codigo)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas a Pagar / Receber</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestão de títulos e parcelas financeiras</p>
        </div>
        <button
          onClick={() => setCriando(true)}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition',
            tipo === 'PAGAR' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700',
          )}
        >
          <Plus size={16} />
          Novo a {tipo === 'PAGAR' ? 'Pagar' : 'Receber'}
        </button>
      </div>

      {/* Resumo */}
      {resumo && <SummaryCards resumo={resumo} tipo={tipo} />}

      {/* Tabs PAGAR/RECEBER */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['PAGAR', 'RECEBER'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={clsx(
              'px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px',
              tipo === t
                ? t === 'PAGAR'
                  ? 'border-red-600 text-red-600'
                  : 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t === 'PAGAR' ? (
              <span className="flex items-center gap-2"><TrendingDown size={14} /> Contas a Pagar</span>
            ) : (
              <span className="flex items-center gap-2"><TrendingUp size={14} /> Contas a Receber</span>
            )}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Buscar por descrição ou pessoa..." value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
          <option value="">Todos (abertos/parciais)</option>
          <option value="ABERTO">Aberto</option>
          <option value="PARCIAL">Parcial</option>
          <option value="QUITADO">Quitado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <label className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer hover:bg-gray-50">
          <input type="checkbox" checked={filtroVencidos} onChange={e => setFiltroVencidos(e.target.checked)} />
          <Clock size={14} className="text-red-500" />
          Apenas vencidos
        </label>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">Carregando...</div>
      ) : titulos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
          <Calendar size={40} className="mb-3 opacity-40" />
          <p className="font-medium">Nenhum título encontrado</p>
          <p className="text-sm mt-1">Crie um novo título a {tipo === 'PAGAR' ? 'pagar' : 'receber'} para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {titulos.map(t => (
            <TituloRow
              key={t.id}
              titulo={t}
              contas={contasList}
              onCancelar={id => { setCancelarId(id); setCancelarErro('') }}
            />
          ))}
        </div>
      )}

      {/* Modal criar */}
      {criando && (
        <ModalCriarTitulo
          tipo={tipo}
          pessoas={pessoas?.dados ?? []}
          contas={contasList}
          contasFinanceiras={contasFinanceirasList}
          onClose={() => setCriando(false)}
        />
      )}

      {/* Confirm cancelar titulo */}
      <ConfirmDialog
        open={!!cancelarId}
        title="Cancelar Título"
        message={cancelarErro || 'Tem certeza que deseja cancelar este título? Todas as parcelas em aberto serão canceladas.'}
        confirmLabel="Cancelar Título"
        variant={cancelarErro ? 'default' : 'danger'}
        onConfirm={cancelarErro ? undefined : () => cancelarTitulo.mutate(cancelarId!)}
        onCancel={() => { setCancelarId(null); setCancelarErro('') }}
        loading={cancelarTitulo.isPending}
      />
    </div>
  )
}
