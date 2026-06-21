import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, X, CheckCircle2,
  AlertTriangle, Clock, TrendingDown, TrendingUp, Calendar,
  Ban, CreditCard, Repeat, Pause, Play, Trash2, Pencil, RefreshCw, ArrowLeft,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../lib/api'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { CurrencyInput } from '../../components/ui/FormField'

// ── Types ──────────────────────────────────────────────────────────────────

interface Parcela {
  id: string
  numero: number
  valor: number
  vencimento: string
  status: 'ABERTO' | 'QUITADO' | 'CANCELADO'
  dataBaixa?: string
  valorPago?: number
  juros?: number
  multa?: number
  taxas?: number
  contaBancaria?: { id: string; nome: string }
  observacao?: string
  parcelaOrigemId?: string
}

interface Titulo {
  id: string
  tipo: 'PAGAR' | 'RECEBER'
  descricao: string
  documento?: string
  total: number
  status: 'ABERTO' | 'PARCIAL' | 'QUITADO' | 'CANCELADO'
  pessoa?: { id: string; nome: string; documento: string }
  contaFinanceira?: { id: string; codigo: string; nome: string }
  parcelas: Parcela[]
  criadoEm: string
  observacao?: string
  recorrenciaId?: string
  recorrenciaOrdem?: number
}

interface Recorrencia {
  id: string
  tipo: 'PAGAR' | 'RECEBER'
  descricao: string
  valor: number
  diaVencimento: number
  ativa: boolean
  pessoa?: { id: string; nome: string }
  contaFinanceira?: { id: string; codigo: string; nome: string }
  observacao?: string
  _count: { titulos: number }
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

const fmt = (v: number | string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (s: string) => new Date(s + (s.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR')
const today = () => new Date().toISOString().split('T')[0]
const primeiroDiaMes = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0] }
const ultimoDiaMes  = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0] }

// Navega para o próximo campo ao pressionar Enter. Aplique onKeyDown={nextOnEnter} nos
// inputs/selects do formulário e data-form="" no elemento container raiz.
function nextOnEnter(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const container = e.currentTarget.closest('[data-form]')
  if (!container) return
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(
    'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
  ))
  const idx = focusable.indexOf(e.currentTarget)
  if (idx >= 0 && idx < focusable.length - 1) focusable[idx + 1].focus()
}

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
  const valorOriginal = Number(parcela.valor)
  const [form, setForm] = useState({
    dataBaixa: today(),
    contaBancariaId: contas[0]?.id ?? '',
    valorPrincipal: valorOriginal.toFixed(2),
    juros: '',
    multa: '',
    taxas: '',
    vencimentoRestante: parcela.vencimento,
    observacao: '',
  })

  const principal = Math.max(0, Number(form.valorPrincipal) || 0)
  const encargos = (Number(form.juros) || 0) + (Number(form.multa) || 0) + (Number(form.taxas) || 0)
  const totalPago = principal + encargos
  const restante = Number((valorOriginal - principal).toFixed(2))
  const isParcial = restante > 0.005
  const temEncargos = encargos > 0
  const vencido = isVencido(parcela.vencimento)

  const baixar = useMutation({
    mutationFn: () => api.post(`/titulos/${tituloId}/parcelas/${parcela.id}/baixar`, {
      dataBaixa: form.dataBaixa,
      valorPago: Number(totalPago.toFixed(2)),
      contaBancariaId: form.contaBancariaId,
      juros: Number(form.juros) || undefined,
      multa: Number(form.multa) || undefined,
      taxas: Number(form.taxas) || undefined,
      observacao: form.observacao || undefined,
      vencimentoRestante: isParcial ? form.vencimentoRestante : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['titulos'] })
      qc.invalidateQueries({ queryKey: ['titulos-resumo'] })
      onClose()
    },
  })

  function campoEncargo(label: string, field: 'juros' | 'multa' | 'taxas') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label} (R$)</label>
        <input
          type="number" step="0.01" min="0" placeholder="0,00"
          value={form[field]}
          onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Baixar Parcela {parcela.numero}</h3>
            <p className="text-sm text-gray-500">
              Valor: {fmt(valorOriginal)} · Vencimento: {fmtDate(parcela.vencimento)}
              {vencido && <span className="ml-2 text-red-500 font-medium">· Vencida</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Data + Conta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data da Baixa</label>
              <input type="date" value={form.dataBaixa}
                onChange={e => setForm(f => ({ ...f, dataBaixa: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta Bancária</label>
              <select value={form.contaBancariaId}
                onChange={e => setForm(f => ({ ...f, contaBancariaId: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.isCaixa ? ' (Caixa)' : ''}</option>)}
              </select>
            </div>
          </div>

          {/* Valor pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor pago (R$)</label>
            <input
              type="number" step="0.01" min="0.01"
              value={form.valorPrincipal}
              onChange={e => setForm(f => ({ ...f, valorPrincipal: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Aviso de baixa parcial */}
          {isParcial && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-orange-700">
                Baixa parcial — restante: {fmt(restante)}
              </p>
              <p className="text-xs text-orange-600">Uma nova parcela será criada com o saldo restante.</p>
              <div>
                <label className="block text-xs font-medium text-orange-700 mb-1">Vencimento do restante</label>
                <input
                  type="date" value={form.vencimentoRestante}
                  onChange={e => setForm(f => ({ ...f, vencimentoRestante: e.target.value }))}
                  className="w-full border border-orange-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                />
              </div>
            </div>
          )}

          {/* Encargos */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Encargos por atraso (opcional)</p>
            <div className="grid grid-cols-3 gap-3">
              {campoEncargo('Juros', 'juros')}
              {campoEncargo('Multa', 'multa')}
              {campoEncargo('Taxas', 'taxas')}
            </div>
          </div>

          {/* Total */}
          <div className={clsx(
            'flex items-center justify-between rounded-lg px-4 py-3 border',
            isParcial ? 'bg-orange-50 border-orange-200' : temEncargos ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-100',
          )}>
            <span className="text-sm font-medium text-gray-700">Total a receber/pagar</span>
            <div className="text-right">
              <span className={clsx('text-lg font-bold', isParcial ? 'text-orange-700' : temEncargos ? 'text-amber-700' : 'text-green-700')}>
                {fmt(totalPago)}
              </span>
              {temEncargos && (
                <p className="text-xs text-amber-600 mt-0.5">
                  {fmt(principal)} + {fmt(encargos)} em encargos
                </p>
              )}
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <input type="text" value={form.observacao} placeholder="Opcional"
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>

          {(baixar.error as { response?: { data?: { error?: string } } } | null)?.response?.data?.error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {(baixar.error as { response?: { data?: { error?: string } } }).response?.data?.error}
            </p>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => baixar.mutate()}
            disabled={baixar.isPending || !form.contaBancariaId || principal <= 0}
            className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={16} />
            {baixar.isPending ? 'Baixando...' : `Confirmar ${fmt(totalPago)}`}
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
  const qc = useQueryClient()
  const [baixando, setBaixando] = useState<Parcela | null>(null)
  const [estornando, setEstornando] = useState<Parcela | null>(null)

  const isPagar = titulo.tipo === 'PAGAR'
  const abertas = titulo.parcelas
    .filter(p => p.status === 'ABERTO')
    .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
  const proxima = abertas[0] ?? null
  const vencidas = abertas.filter(p => isVencido(p.vencimento))

  // Última parcela quitada (candidata ao estorno)
  const ultimaQuitada = titulo.parcelas
    .filter(p => p.status === 'QUITADO')
    .sort((a, b) => b.numero - a.numero)[0] ?? null

  const estornar = useMutation({
    mutationFn: (p: Parcela) => api.patch(`/titulos/${titulo.id}/parcelas/${p.id}/estornar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['titulos'] })
      qc.invalidateQueries({ queryKey: ['titulos-resumo'] })
      setEstornando(null)
    },
  })

  return (
    <>
      <tr className={clsx('hover:bg-gray-50 transition', titulo.status === 'CANCELADO' && 'opacity-50')}>
        <td className="px-4 py-3">
          <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center shrink-0', isPagar ? 'bg-red-100' : 'bg-green-100')}>
            {isPagar ? <TrendingDown size={14} className="text-red-600" /> : <TrendingUp size={14} className="text-green-600" />}
          </div>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-gray-900">{titulo.descricao}</p>
          {titulo.documento && <p className="text-xs text-gray-400 mt-0.5">Doc: {titulo.documento}</p>}
          {titulo.recorrenciaId && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-500 mt-0.5">
              <Repeat size={10} /> Recorrente
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-gray-700 tabular-nums">
            {abertas.length}/{titulo.parcelas.length}
          </span>
          {vencidas.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-500 mt-0.5">
              <AlertTriangle size={11} /> {vencidas.length} vencida(s)
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          {proxima ? (
            <div>
              <span className={clsx('text-sm tabular-nums', isVencido(proxima.vencimento) ? 'text-red-600 font-medium' : 'text-gray-600')}>
                {fmtDate(proxima.vencimento)}
              </span>
              {proxima.parcelaOrigemId && (
                <span className="ml-1.5 text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-medium">saldo</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <span className={clsx('font-semibold tabular-nums', isPagar ? 'text-red-700' : 'text-green-700')}>
            {fmt(titulo.total)}
          </span>
        </td>
        <td className="px-4 py-3">{statusBadge(titulo.status)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {ultimaQuitada && (
              <button
                onClick={() => setEstornando(ultimaQuitada)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition"
                title="Estornar último pagamento"
              >
                <RefreshCw size={12} /> Estornar
              </button>
            )}
            {proxima && (
              <button
                onClick={() => setBaixando(proxima)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition"
              >
                <CreditCard size={12} /> Baixar
              </button>
            )}
            {titulo.status !== 'CANCELADO' && titulo.status !== 'QUITADO' && (
              <button
                onClick={() => onCancelar(titulo.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                title="Cancelar título"
              >
                <Ban size={15} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {baixando && (
        <ModalBaixa
          parcela={baixando}
          tituloId={titulo.id}
          contas={contas}
          onClose={() => setBaixando(null)}
        />
      )}

      <ConfirmDialog
        open={!!estornando}
        title="Estornar Pagamento"
        message={`Estornar a parcela ${estornando?.numero} de ${fmt(estornando?.valor ?? 0)} paga em ${estornando?.dataBaixa ? fmtDate(estornando.dataBaixa) : '—'}? A transação financeira será removida e a parcela voltará para Aberto.`}
        confirmLabel="Estornar"
        variant="danger"
        onConfirm={() => estornando && estornar.mutate(estornando)}
        onCancel={() => setEstornando(null)}
        loading={estornar.isPending}
      />
    </>
  )
}

// ── Busca de pessoa (fornecedor / cliente) ─────────────────────────────────

function PessoaInput({ label, pessoas, pessoaId, pessoaNome, onChange }: {
  label: string
  pessoas: Pessoa[]
  pessoaId: string | null
  pessoaNome: string
  onChange: (id: string | null, nome: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')

  const vinculado = pessoas.find(p => p.id === pessoaId)
  const buscaDigitos = busca.replace(/\D/g, '')
  const filtrados = busca.trim()
    ? pessoas.filter(p =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (buscaDigitos !== '' && (p.documento ?? '').includes(buscaDigitos)))
    : pessoas
  const displayValue = aberto ? busca : pessoaNome

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {vinculado && <span className="ml-2 text-xs text-green-600 font-normal">· vinculado</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          placeholder={`Buscar ${label.toLowerCase()}...`}
          onChange={e => { const v = e.target.value; setBusca(v); setAberto(true); onChange(null, v) }}
          onFocus={() => { setBusca(''); setAberto(true) }}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={nextOnEnter}
          className={clsx(
            'w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500',
            vinculado && 'border-green-300 bg-green-50 text-green-900',
          )}
        />
        {aberto && (
          <div className="absolute z-30 top-full left-0 right-0 mt-0.5 bg-white border rounded-lg shadow-xl overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              {filtrados.slice(0, 15).map(p => (
                <button key={p.id} type="button"
                  onMouseDown={() => { onChange(p.id, p.nome); setBusca(''); setAberto(false) }}
                  className={clsx('w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition',
                    p.id === pessoaId && 'bg-primary-50 font-medium text-primary-700')}>
                  <span className="font-medium">{p.nome}</span>
                  {p.documento && <span className="ml-2 text-xs text-gray-400">{p.documento}</span>}
                </button>
              ))}
              {filtrados.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Nenhum resultado</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal: Criar / Editar Recorrência ─────────────────────────────────────

function ModalFormRecorrencia({
  inicial, pessoas, contasFinanceiras, onClose,
}: {
  inicial?: Recorrencia
  pessoas: Pessoa[]
  contasFinanceiras: ContaFinanceira[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const editando = !!inicial
  const [form, setForm] = useState({
    tipo: (inicial?.tipo ?? 'PAGAR') as 'PAGAR' | 'RECEBER',
    descricao: inicial?.descricao ?? '',
    valor: inicial ? String(inicial.valor) : '',
    diaVencimento: inicial ? String(inicial.diaVencimento) : '5',
    pessoaId: inicial?.pessoa?.id ?? null as string | null,
    pessoaNome: inicial?.pessoa?.nome ?? '',
    contaFinanceiraId: inicial?.contaFinanceira?.id ?? '',
    observacao: inicial?.observacao ?? '',
    propagar: true,
  })
  const [error, setError] = useState('')

  const salvar = useMutation({
    mutationFn: () => editando
      ? api.patch(`/recorrencias/${inicial!.id}`, {
          descricao: form.descricao,
          valor: Number(form.valor),
          pessoaId: form.pessoaId || null,
          contaFinanceiraId: form.contaFinanceiraId || null,
          observacao: form.observacao || null,
          propagar: form.propagar,
        })
      : api.post('/recorrencias', {
          tipo: form.tipo,
          descricao: form.descricao,
          valor: Number(form.valor),
          diaVencimento: Number(form.diaVencimento),
          pessoaId: form.pessoaId || undefined,
          contaFinanceiraId: form.contaFinanceiraId || undefined,
          observacao: form.observacao || undefined,
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recorrencias'] })
      qc.invalidateQueries({ queryKey: ['titulos'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-gray-900">
            {editando ? 'Editar Recorrência' : 'Nova Recorrência'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {!editando && (
            <div className="flex gap-2">
              {(['PAGAR', 'RECEBER'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, tipo: t }))}
                  className={clsx(
                    'flex-1 py-2 text-sm rounded-lg border font-medium transition',
                    form.tipo === t
                      ? t === 'PAGAR' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-green-50 border-green-300 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50',
                  )}
                >
                  {t === 'PAGAR' ? 'A Pagar' : 'A Receber'}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
            <input type="text" value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Aluguel, Internet, Energia..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
              <input type="number" value={form.valor} min={0} step={0.01}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                placeholder="0,00"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dia do vencimento *
                <span className="ml-1 text-xs text-gray-400">(1–28)</span>
              </label>
              <input type="number" value={form.diaVencimento} min={1} max={28}
                onChange={e => setForm(f => ({ ...f, diaVencimento: e.target.value }))}
                disabled={editando}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
          </div>

          <PessoaInput
            label={form.tipo === 'PAGAR' ? 'Fornecedor' : 'Cliente'}
            pessoas={pessoas}
            pessoaId={form.pessoaId}
            pessoaNome={form.pessoaNome}
            onChange={(id, nome) => setForm(f => ({ ...f, pessoaId: id, pessoaNome: nome }))}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conta (Plano de Contas)</label>
            <select value={form.contaFinanceiraId}
              onChange={e => setForm(f => ({ ...f, contaFinanceiraId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
              <option value="">— Selecionar —</option>
              {contasFinanceiras.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <input type="text" value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              placeholder="Opcional"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>

          {editando && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.propagar}
                onChange={e => setForm(f => ({ ...f, propagar: e.target.checked }))}
                className="rounded" />
              <span className="text-sm text-gray-700">Aplicar alterações aos títulos futuros em aberto</span>
            </label>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || !form.descricao || !form.valor || Number(form.valor) <= 0}
            className="flex-1 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Repeat size={15} />
            {salvar.isPending ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Criar e Gerar 12 Meses'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Gerenciar Recorrências ──────────────────────────────────────────

function ModalGerenciarRecorrencias({
  pessoas, contasFinanceiras, onClose,
}: {
  pessoas: Pessoa[]
  contasFinanceiras: ContaFinanceira[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<Recorrencia | null>(null)
  const [cancelarId, setCancelarId] = useState<string | null>(null)

  const { data: recorrencias = [], isLoading } = useQuery<Recorrencia[]>({
    queryKey: ['recorrencias'],
    queryFn: () => api.get('/recorrencias').then(r => r.data),
  })

  const toggleAtivo = useMutation({
    mutationFn: (id: string) => api.patch(`/recorrencias/${id}/toggle-ativo`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recorrencias'] }),
  })

  const renovar = useMutation({
    mutationFn: (id: string) => api.post(`/recorrencias/${id}/renovar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recorrencias'] })
      qc.invalidateQueries({ queryKey: ['titulos'] })
    },
  })

  const cancelar = useMutation({
    mutationFn: (id: string) => api.delete(`/recorrencias/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recorrencias'] })
      qc.invalidateQueries({ queryKey: ['titulos'] })
      setCancelarId(null)
    },
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <Repeat size={18} className="text-blue-600" />
              <h3 className="font-semibold text-gray-900">Recorrências</h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{recorrencias.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCriando(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              >
                <Plus size={14} /> Nova Recorrência
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">Carregando...</div>
            ) : recorrencias.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Repeat size={36} className="mb-3 opacity-30" />
                <p className="font-medium">Nenhuma recorrência cadastrada</p>
                <p className="text-sm mt-1">Crie uma para lançar contas como aluguel e internet automaticamente</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Vence dia</th>
                    <th className="px-4 py-3">Pessoa</th>
                    <th className="px-4 py-3">Títulos</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recorrencias.map(rec => (
                    <tr key={rec.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                            rec.tipo === 'PAGAR' ? 'bg-red-100' : 'bg-green-100')}>
                            {rec.tipo === 'PAGAR'
                              ? <TrendingDown size={12} className="text-red-600" />
                              : <TrendingUp size={12} className="text-green-600" />}
                          </div>
                          <span className="font-medium text-gray-900">{rec.descricao}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-medium">
                        {fmt(rec.valor)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        Todo dia {rec.diaVencimento}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {rec.pessoa?.nome ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {rec._count.titulos} gerados
                      </td>
                      <td className="px-4 py-3">
                        {rec.ativa
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Ativa</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Pausada</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditando(rec)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => renovar.mutate(rec.id)}
                            disabled={renovar.isPending}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"
                            title="Renovar (gerar próximos 12 meses)"
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            onClick={() => toggleAtivo.mutate(rec.id)}
                            disabled={toggleAtivo.isPending}
                            className={clsx('p-1.5 rounded-lg transition',
                              rec.ativa
                                ? 'hover:bg-amber-50 text-gray-400 hover:text-amber-600'
                                : 'hover:bg-green-50 text-gray-400 hover:text-green-600'
                            )}
                            title={rec.ativa ? 'Pausar' : 'Reativar'}
                          >
                            {rec.ativa ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          <button
                            onClick={() => setCancelarId(rec.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                            title="Cancelar e excluir títulos futuros"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t flex-shrink-0">
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <RefreshCw size={11} /> Ao baixar o último título do lote, os próximos 12 meses são gerados automaticamente.
            </p>
          </div>
        </div>
      </div>

      {(criando || editando) && (
        <ModalFormRecorrencia
          inicial={editando ?? undefined}
          pessoas={pessoas}
          contasFinanceiras={contasFinanceiras}
          onClose={() => { setCriando(false); setEditando(null) }}
        />
      )}

      <ConfirmDialog
        open={!!cancelarId}
        title="Cancelar Recorrência"
        message="Todos os títulos futuros em aberto desta recorrência serão cancelados. Esta ação não pode ser desfeita."
        confirmLabel="Cancelar Recorrência"
        variant="danger"
        onConfirm={() => cancelar.mutate(cancelarId!)}
        onCancel={() => setCancelarId(null)}
        loading={cancelar.isPending}
      />
    </>
  )
}

// ── Formulário de criação ──────────────────────────────────────────────────

type TipoLancamento = 'UNICA' | 'MENSAL' | 'PARCELADA'

function FormCriarTitulo({
  tipo, pessoas, contasFinanceiras, onSuccess, onCancel
}: {
  tipo: 'PAGAR' | 'RECEBER'
  pessoas: Pessoa[]
  contas: ContaBancaria[]
  contasFinanceiras: ContaFinanceira[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const [tipoLancamento, setTipoLancamento] = useState<TipoLancamento>('UNICA')
  const [form, setForm] = useState({
    descricao: '',
    documento: '',
    pessoaId: null as string | null,
    pessoaNome: '',
    contaFinanceiraId: '',
    observacao: '',
    valor: 0,
    vencimento: today(),
    qtdParcelas: '2',
  })
  const [error, setError] = useState('')

  const valorTotal = form.valor || 0
  const qtdParc = Math.max(2, parseInt(form.qtdParcelas) || 2)
  const valorParcela = qtdParc > 0 ? Number((valorTotal / qtdParc).toFixed(2)) : 0

  function gerarVencimentos(dataInicio: string, qtd: number): string[] {
    return Array.from({ length: qtd }, (_, i) => {
      const d = new Date(dataInicio + 'T12:00:00')
      d.setMonth(d.getMonth() + i)
      return d.toISOString().split('T')[0]
    })
  }

  const criarTitulo = useMutation({
    mutationFn: (body: unknown) => api.post('/titulos', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['titulos'] })
      qc.invalidateQueries({ queryKey: ['titulos-resumo'] })
      onSuccess()
    },
    onError: (e: Error) => setError(e.message),
  })

  const criarRecorrencia = useMutation({
    mutationFn: (body: unknown) => api.post('/recorrencias', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['titulos'] })
      qc.invalidateQueries({ queryKey: ['titulos-resumo'] })
      qc.invalidateQueries({ queryKey: ['recorrencias'] })
      onSuccess()
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSubmit() {
    setError('')
    const base = {
      tipo,
      descricao: form.descricao,
      documento: form.documento || undefined,
      pessoaId: form.pessoaId || undefined,
      contaFinanceiraId: form.contaFinanceiraId || undefined,
      observacao: form.observacao || undefined,
    }

    if (tipoLancamento === 'UNICA') {
      criarTitulo.mutate({
        ...base,
        parcelas: [{ numero: 1, valor: valorTotal, vencimento: form.vencimento }],
      })
    } else if (tipoLancamento === 'MENSAL') {
      const diaVencimento = new Date(form.vencimento + 'T12:00:00').getDate()
      criarRecorrencia.mutate({ ...base, valor: valorTotal, diaVencimento, dataInicio: form.vencimento })
    } else {
      const vencimentos = gerarVencimentos(form.vencimento, qtdParc)
      criarTitulo.mutate({
        ...base,
        parcelas: vencimentos.map((venc, i) => ({ numero: i + 1, valor: valorParcela, vencimento: venc })),
      })
    }
  }

  const isPending = criarTitulo.isPending || criarRecorrencia.isPending
  const canSubmit = form.descricao.length >= 2 && valorTotal > 0 && !!form.vencimento &&
    (tipoLancamento !== 'PARCELADA' || qtdParc >= 2)

  return (
    <div className="space-y-5" data-form="">

      {/* Tipo de lançamento */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Recorrência</label>
        <div className="grid grid-cols-3 gap-2">
          {(['UNICA', 'MENSAL', 'PARCELADA'] as TipoLancamento[]).map(t => (
            <button key={t} onClick={() => setTipoLancamento(t)}
              className={clsx(
                'px-3 py-2.5 text-sm rounded-lg border-2 font-medium transition-colors',
                tipoLancamento === t
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}>
              {t === 'UNICA' ? 'Única' : t === 'MENSAL' ? 'Mensal' : 'Parcelada'}
            </button>
          ))}
        </div>
        {tipoLancamento === 'MENSAL' && (
          <p className="mt-2 text-xs text-blue-600">
            Gera 12 lançamentos mensais automaticamente e renova conforme necessário.
          </p>
        )}
      </div>

      {/* Descrição + Documento */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
          <input type="text" value={form.descricao}
            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            onKeyDown={nextOnEnter}
            placeholder="Ex: Aluguel, Internet..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nº Documento</label>
          <input type="text" value={form.documento}
            onChange={e => setForm(f => ({ ...f, documento: e.target.value }))}
            onKeyDown={nextOnEnter}
            placeholder="NF, boleto..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
        </div>
      </div>

      {/* Valor + Parcelas + Vencimento */}
      <div className={clsx('grid gap-4', tipoLancamento === 'PARCELADA' ? 'grid-cols-3' : 'grid-cols-2')}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total *</label>
          <CurrencyInput
            value={form.valor}
            onChange={v => setForm(f => ({ ...f, valor: v }))}
            onKeyDown={nextOnEnter}
          />
        </div>
        {tipoLancamento === 'PARCELADA' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nº de Parcelas *</label>
            <input type="number" min="2" max="360" value={form.qtdParcelas}
              onChange={e => setForm(f => ({ ...f, qtdParcelas: e.target.value }))}
              onKeyDown={nextOnEnter}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {tipoLancamento === 'UNICA' ? 'Vencimento *' : 'Primeiro Vencimento *'}
          </label>
          <input type="date" value={form.vencimento}
            onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))}
            onKeyDown={nextOnEnter}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
        </div>
      </div>

      {/* Preview */}
      {tipoLancamento === 'PARCELADA' && valorTotal > 0 && qtdParc >= 2 && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm">
          <p className="text-blue-700 font-medium">{qtdParc}x de {fmt(valorParcela)} — Total: {fmt(valorTotal)}</p>
          <p className="text-blue-500 text-xs mt-0.5">Vencimentos mensais a partir de {fmtDate(form.vencimento)}</p>
        </div>
      )}
      {tipoLancamento === 'MENSAL' && valorTotal > 0 && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm">
          <p className="text-blue-700 font-medium">12 lançamentos de {fmt(valorTotal)}/mês</p>
          <p className="text-blue-500 text-xs mt-0.5">A partir de {fmtDate(form.vencimento)}, renovando automaticamente</p>
        </div>
      )}

      {/* Pessoa + Conta */}
      <div className="grid grid-cols-2 gap-4">
        <PessoaInput
          label={tipo === 'PAGAR' ? 'Fornecedor' : 'Cliente'}
          pessoas={pessoas}
          pessoaId={form.pessoaId}
          pessoaNome={form.pessoaNome}
          onChange={(id, nome) => setForm(f => ({ ...f, pessoaId: id, pessoaNome: nome }))}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Conta (Plano de Contas)</label>
          <select value={form.contaFinanceiraId}
            onChange={e => setForm(f => ({ ...f, contaFinanceiraId: e.target.value }))}
            onKeyDown={nextOnEnter}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
            <option value="">— Selecionar —</option>
            {contasFinanceiras.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
        <input type="text" value={form.observacao}
          onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
          onKeyDown={nextOnEnter}
          placeholder="Opcional"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button onClick={onCancel} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
        <button onClick={handleSubmit} disabled={isPending || !canSubmit}
          className={clsx(
            'flex-1 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2',
            tipo === 'PAGAR' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700',
          )}>
          <Plus size={16} />
          {isPending ? 'Salvando...'
            : tipoLancamento === 'MENSAL' ? 'Criar Recorrência Mensal'
            : tipoLancamento === 'PARCELADA' ? `Parcelar em ${qtdParc}x`
            : `Criar Título a ${tipo === 'PAGAR' ? 'Pagar' : 'Receber'}`}
        </button>
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
  const [vencimentoInicio, setVencimentoInicio] = useState(primeiroDiaMes)
  const [vencimentoFim, setVencimentoFim] = useState(ultimoDiaMes)
  const [criando, setCriando] = useState(false)
  const [gerenciandoRecorrencias, setGerenciandoRecorrencias] = useState(false)
  const [cancelarId, setCancelarId] = useState<string | null>(null)
  const [cancelarErro, setCancelarErro] = useState('')

  const params = useMemo(() => {
    const p: Record<string, string> = { tipo }
    if (filtroStatus) p.status = filtroStatus
    else p.status = ''
    if (filtroVencidos) p.vencidos = 'true'
    if (vencimentoInicio) p.vencimentoInicio = vencimentoInicio
    if (vencimentoFim) p.vencimentoFim = vencimentoFim
    return p
  }, [tipo, filtroStatus, filtroVencidos, vencimentoInicio, vencimentoFim])

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

  const { data: contas = [] } = useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias-lista'],
    queryFn: () => api.get('/financeiro/contas-bancarias').then(r => r.data),
  })

  const { data: contasFinanceiras } = useQuery<ContaFinanceira[]>({
    queryKey: ['contas-financeiras-lista'],
    queryFn: () => api.get('/financeiro/contas').then(r => r.data),
  })

  const { data: pessoas = [] } = useQuery<Pessoa[]>({
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

  const contasList = contas
  const contasFinanceirasList = (contasFinanceiras ?? []).filter(c => c.codigo)

  if (criando) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setCriando(false)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Novo Título a {tipo === 'PAGAR' ? 'Pagar' : 'Receber'}
            </h2>
            <p className="text-xs text-gray-400">Contas a {tipo === 'PAGAR' ? 'Pagar' : 'Receber'}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <FormCriarTitulo
            tipo={tipo}
            pessoas={pessoas}
            contas={contasList}
            contasFinanceiras={contasFinanceirasList}
            onSuccess={() => setCriando(false)}
            onCancel={() => setCriando(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas a Pagar / Receber</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestão de títulos e parcelas financeiras</p>
        </div>
        <div className="flex items-center gap-2">
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

        {/* Período de vencimento */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5">
            <Calendar size={14} className="text-gray-400 shrink-0" />
            <input
              type="date" value={vencimentoInicio}
              onChange={e => setVencimentoInicio(e.target.value)}
              className="text-sm focus:outline-none bg-transparent w-32"
              title="Vencimento a partir de"
            />
          </div>
          <span className="text-gray-400 text-sm">até</span>
          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5">
            <Calendar size={14} className="text-gray-400 shrink-0" />
            <input
              type="date" value={vencimentoFim}
              onChange={e => setVencimentoFim(e.target.value)}
              className="text-sm focus:outline-none bg-transparent w-32"
              title="Vencimento até"
            />
          </div>
          {(vencimentoInicio || vencimentoFim) && (
            <button
              onClick={() => { setVencimentoInicio(''); setVencimentoFim('') }}
              className="text-gray-400 hover:text-gray-600"
              title="Limpar filtro de período"
            >
              <X size={14} />
            </button>
          )}
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Parcela</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3 text-right">Valor Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {titulos.map(t => (
                <TituloRow
                  key={t.id}
                  titulo={t}
                  contas={contasList}
                  onCancelar={id => { setCancelarId(id); setCancelarErro('') }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal gerenciar recorrências */}
      {gerenciandoRecorrencias && (
        <ModalGerenciarRecorrencias
          pessoas={pessoas}
          contasFinanceiras={contasFinanceirasList}
          onClose={() => setGerenciandoRecorrencias(false)}
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
