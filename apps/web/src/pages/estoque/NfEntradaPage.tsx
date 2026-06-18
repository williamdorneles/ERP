import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload, Plus, CheckCircle2, XCircle, FileText,
  ChevronDown, ChevronRight, Package, AlertTriangle, Ban, Cloud, X, ArrowLeft,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../lib/api'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Produto { id: string; codigo: string; nome: string; unidadeMedida: string; custoUnitario: number }
interface Pessoa { id: string; nome: string; documento: string }
interface ContaFinanceira { id: string; codigo: string; nome: string }

interface ItemForm {
  nItem: number; cProd: string; descricao: string; ncm: string; cfop: string
  unidade: string; quantidade: number; valorUnitario: number; valorTotal: number
  produtoId: string | null
  produto?: Produto | null
}
interface ParcelaForm { numero: string; vencimento: string; valor: number }

interface NfHeader {
  chaveAcesso?: string; numero: string; serie: string
  dataEmissao: string; dataEntrada: string
  fornecedorId?: string | null; fornecedorNome: string; fornecedorCnpj: string
  totalProdutos: number; totalImpostos: number; totalNf: number
  fornecedor?: Pessoa | null
}

interface NfEntradaLista {
  id: string; numero: string | null; serie: string | null
  dataEntrada: string; fornecedorNome: string
  totalNf: number; status: string
  fornecedor: { id: string; nome: string } | null
  _count: { itens: number }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (s: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const today = () => new Date().toISOString().split('T')[0]

// ── Seletor de Produto por Item ───────────────────────────────────────────────

function ProdutoSelector({
  item, produtos, onChange,
}: { item: ItemForm; produtos: Produto[]; onChange: (produtoId: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')

  const filtrados = busca.trim()
    ? produtos.filter(p =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busca.toLowerCase())
      )
    : produtos

  const atual = produtos.find(p => p.id === item.produtoId)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'w-full flex items-center justify-between px-2 py-1.5 text-xs border rounded-lg text-left transition',
          item.produtoId
            ? 'bg-green-50 border-green-300 text-green-800'
            : 'bg-amber-50 border-amber-300 text-amber-700',
        )}
      >
        <span className="truncate">
          {atual ? `${atual.codigo} — ${atual.nome}` : '⚠ Vincular produto...'}
        </span>
        <ChevronDown size={12} className="flex-shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl">
          <div className="p-2 border-b">
            <input
              autoFocus type="text" placeholder="Buscar produto..." value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 border-b"
            >
              — Não vincular (ignorar no estoque)
            </button>
            {filtrados.slice(0, 20).map(p => (
              <button
                key={p.id} type="button"
                onClick={() => { onChange(p.id); setOpen(false) }}
                className={clsx(
                  'w-full text-left px-3 py-1.5 text-xs hover:bg-primary-50 transition',
                  p.id === item.produtoId && 'bg-primary-50 font-medium text-primary-700',
                )}
              >
                <span className="font-mono text-gray-400 mr-1">{p.codigo}</span>
                {p.nome}
              </button>
            ))}
            {filtrados.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">Nenhum produto encontrado</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Formulário principal ──────────────────────────────────────────────────────

function FormNfEntrada({
  inicial, onClose,
}: { inicial?: Partial<NfHeader & { itens: ItemForm[]; duplicatas: ParcelaForm[] }>; onClose: () => void }) {
  const qc = useQueryClient()

  const [header, setHeader] = useState<NfHeader>({
    chaveAcesso: inicial?.chaveAcesso ?? '',
    numero: inicial?.numero ?? '',
    serie: inicial?.serie ?? '1',
    dataEmissao: inicial?.dataEmissao ?? today(),
    dataEntrada: inicial?.dataEntrada ?? today(),
    fornecedorId: inicial?.fornecedorId ?? null,
    fornecedorNome: inicial?.fornecedorNome ?? '',
    fornecedorCnpj: inicial?.fornecedorCnpj ?? '',
    totalProdutos: inicial?.totalProdutos ?? 0,
    totalImpostos: inicial?.totalImpostos ?? 0,
    totalNf: inicial?.totalNf ?? 0,
  })
  const [itens, setItens] = useState<ItemForm[]>(inicial?.itens ?? [])
  const [parcelas, setParcelas] = useState<ParcelaForm[]>(inicial?.duplicatas ?? [
    { numero: '001', vencimento: today(), valor: 0 },
  ])
  const [contaFinanceiraId, setContaFinanceiraId] = useState('')
  const [erro, setErro] = useState('')

  const { data: pessoas } = useQuery<Pessoa[]>({
    queryKey: ['pessoas-lista'],
    queryFn: () => api.get('/pessoas').then(r => r.data),
  })
  const { data: produtos } = useQuery<Produto[]>({
    queryKey: ['produtos-estoque'],
    queryFn: () => api.get('/produtos').then(r => r.data.dados),
  })
  const { data: contasFinanceiras } = useQuery<ContaFinanceira[]>({
    queryKey: ['contas-financeiras-lista'],
    queryFn: () => api.get('/financeiro/contas').then(r => r.data),
  })

  const confirmar = useMutation({
    mutationFn: () => api.post('/nf-entrada/confirmar', {
      ...header,
      fornecedorId: header.fornecedorId || null,
      contaFinanceiraId: contaFinanceiraId || null,
      itens: itens.map(i => ({ ...i, produtoId: i.produtoId || null })),
      parcelas,
      xmlOriginal: (inicial as Record<string, unknown>)?.xmlOriginal as string | undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nf-entradas'] })
      onClose()
    },
    onError: (e: Error) => setErro(e.message),
  })

  function atualizarItem(idx: number, campo: keyof ItemForm, valor: unknown) {
    setItens(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const atualizado = { ...it, [campo]: valor }
      if (campo === 'quantidade' || campo === 'valorUnitario') {
        atualizado.valorTotal = +(atualizado.quantidade * atualizado.valorUnitario).toFixed(2)
      }
      return atualizado
    }))
  }

  function addItem() {
    setItens(prev => [...prev, {
      nItem: prev.length + 1, cProd: '', descricao: '', ncm: '', cfop: '', unidade: 'UN',
      quantidade: 1, valorUnitario: 0, valorTotal: 0, produtoId: null,
    }])
  }

  const totalItens = itens.reduce((s, i) => s + i.valorTotal, 0)
  const totalParcelas = parcelas.reduce((s, p) => s + p.valor, 0)
  const itensSemVinculo = itens.filter(i => !i.produtoId).length
  const pessoasList = pessoas ?? []
  const produtosList = produtos ?? []

  return (
    <div className="space-y-6">
          {/* Dados do cabeçalho */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Dados da Nota</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Número</label>
                <input type="text" value={header.numero}
                  onChange={e => setHeader(h => ({ ...h, numero: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Série</label>
                <input type="text" value={header.serie}
                  onChange={e => setHeader(h => ({ ...h, serie: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Emissão</label>
                <input type="date" value={header.dataEmissao}
                  onChange={e => setHeader(h => ({ ...h, dataEmissao: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Entrada</label>
                <input type="date" value={header.dataEntrada}
                  onChange={e => setHeader(h => ({ ...h, dataEntrada: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fornecedor</label>
                <select value={header.fornecedorId ?? ''}
                  onChange={e => {
                    const p = pessoasList.find(p => p.id === e.target.value)
                    setHeader(h => ({ ...h, fornecedorId: e.target.value || null, fornecedorNome: p?.nome ?? h.fornecedorNome }))
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                  <option value="">— Selecionar cadastrado —</option>
                  {pessoasList.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Nome do Emitente {!header.fornecedorId && <span className="text-red-500">*</span>}
                </label>
                <input type="text" value={header.fornecedorNome}
                  onChange={e => setHeader(h => ({ ...h, fornecedorNome: e.target.value }))}
                  placeholder="Nome conforme NF"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Conta (Plano de Contas) para o título</label>
              <select value={contaFinanceiraId}
                onChange={e => setContaFinanceiraId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <option value="">— Selecionar —</option>
                {(contasFinanceiras ?? []).map(c => (
                  <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Itens */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Itens
                {itensSemVinculo > 0 && (
                  <span className="ml-2 text-xs text-amber-600 font-normal">
                    <AlertTriangle size={12} className="inline mr-1" />
                    {itensSemVinculo} sem vínculo (não afetarão o estoque)
                  </span>
                )}
              </h3>
              <button onClick={addItem}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                <Plus size={14} /> Adicionar item
              </button>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Descrição (NF)</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 w-32">Produto (ERP)</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">Qtd</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Vl. Unit.</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itens.map((item, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="px-3 py-2">
                        <input type="text" value={item.descricao}
                          onChange={e => atualizarItem(idx, 'descricao', e.target.value)}
                          className="w-full border-0 bg-transparent focus:outline-none text-gray-900"
                          placeholder="Descrição" />
                        <p className="text-gray-400 text-xs mt-0.5">
                          NCM: {item.ncm || '—'} · CFOP: {item.cfop || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <ProdutoSelector
                          item={item}
                          produtos={produtosList}
                          onChange={pid => atualizarItem(idx, 'produtoId', pid)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.001" value={item.quantidade}
                          onChange={e => atualizarItem(idx, 'quantidade', Number(e.target.value))}
                          className="w-full text-right border rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.0001" value={item.valorUnitario}
                          onChange={e => atualizarItem(idx, 'valorUnitario', Number(e.target.value))}
                          className="w-full text-right border rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-gray-900">
                        {fmt(item.valorTotal)}
                      </td>
                    </tr>
                  ))}
                  {itens.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-6 text-gray-400">Nenhum item</td></tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-medium text-gray-600">Total itens:</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(totalItens)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Parcelas */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Condições de Pagamento
                {Math.abs(totalParcelas - header.totalNf) > 0.01 && header.totalNf > 0 && (
                  <span className="ml-2 text-xs text-red-500">
                    Soma das parcelas ({fmt(totalParcelas)}) ≠ Total NF ({fmt(header.totalNf)})
                  </span>
                )}
              </h3>
              <button onClick={() => setParcelas(p => [...p, { numero: String(p.length + 1).padStart(3, '0'), vencimento: today(), valor: 0 }])}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                <Plus size={14} /> Adicionar parcela
              </button>
            </div>
            <div className="space-y-2">
              {parcelas.map((p, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                  <span className="w-16 text-xs text-gray-500 font-mono">Dup. {p.numero}</span>
                  <input type="date" value={p.vencimento}
                    onChange={e => setParcelas(prev => prev.map((pp, i) => i === idx ? { ...pp, vencimento: e.target.value } : pp))}
                    className="border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-primary-500" />
                  <input type="number" step="0.01" value={p.valor} placeholder="Valor"
                    onChange={e => setParcelas(prev => prev.map((pp, i) => i === idx ? { ...pp, valor: Number(e.target.value) } : pp))}
                    className="flex-1 border rounded px-2 py-1.5 text-sm text-right focus:ring-1 focus:ring-primary-500" />
                  {parcelas.length > 1 && (
                    <button onClick={() => setParcelas(p => p.filter((_, i) => i !== idx))}
                      className="p-1 text-gray-400 hover:text-red-500">
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Totais */}
          <div className="flex justify-end gap-8 text-sm border-t pt-4">
            <div className="text-right space-y-1">
              <p className="text-gray-500">Total produtos: <span className="font-semibold text-gray-900">{fmt(totalItens)}</span></p>
              <p className="text-gray-500">Total NF: <span className="font-semibold text-gray-900">{fmt(header.totalNf)}</span></p>
            </div>
          </div>

          {erro && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{erro}</p>}

      {/* Ações */}
      <div className="flex gap-3 pt-2 border-t">
        <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition">
          Cancelar
        </button>
        <button
          onClick={() => confirmar.mutate()}
          disabled={confirmar.isPending || !header.fornecedorNome || itens.length === 0 || parcelas.length === 0}
          className="flex items-center gap-2 px-6 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
        >
          <CheckCircle2 size={16} />
          {confirmar.isPending ? 'Lançando...' : 'Confirmar Entrada'}
        </button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

interface SincResultado {
  totalDocumentos: number
  nfesNovos: number
  resNFeIgnorados: number
  ultNSU: string
  nfes: Record<string, unknown>[]
}

export function NfEntradaPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [dadosXml, setDadosXml] = useState<Record<string, unknown> | null>(null)
  const [parsandoXml, setParsandoXml] = useState(false)
  const [erroXml, setErroXml] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [cancelarId, setCancelarId] = useState<string | null>(null)
  const [cancelarErro, setCancelarErro] = useState('')
  const [resultadoSefaz, setResultadoSefaz] = useState<SincResultado | null>(null)
  const [erroSefaz, setErroSefaz] = useState('')

  const sincronizarSefaz = useMutation({
    mutationFn: () => api.post('/nf-entrada/sincronizar-sefaz').then(r => r.data as SincResultado),
    onSuccess: (data) => { setResultadoSefaz(data); setErroSefaz('') },
    onError: (e: Error) => setErroSefaz(e.message),
  })

  const { data, isLoading } = useQuery<{ dados: NfEntradaLista[] }>({
    queryKey: ['nf-entradas'],
    queryFn: () => api.get('/nf-entrada').then(r => r.data),
  })

  const cancelar = useMutation({
    mutationFn: (id: string) => api.patch(`/nf-entrada/${id}/cancelar`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nf-entradas'] }); setCancelarId(null) },
    onError: (e: Error) => setCancelarErro(e.message),
  })

  function fechar() {
    setFormAberto(false)
    setDadosXml(null)
  }

  async function handleXml(file: File) {
    setParsandoXml(true)
    setErroXml('')
    try {
      const xml = await file.text()
      const res = await api.post('/nf-entrada/parse-xml', { xml })
      setDadosXml({ ...res.data, xmlOriginal: xml })
      setFormAberto(true)
    } catch (e) {
      setErroXml(e instanceof Error ? e.message : 'Erro ao ler XML')
    } finally {
      setParsandoXml(false)
    }
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    RASCUNHO:   { label: 'Rascunho',   color: 'bg-gray-100 text-gray-600' },
    CONFIRMADA: { label: 'Confirmada', color: 'bg-green-100 text-green-700' },
    CANCELADA:  { label: 'Cancelada',  color: 'bg-red-100 text-red-600' },
  }

  const nfs = data?.dados ?? []

  // ── Formulário inline (padrão do sistema) ─────────────────────────────────
  if (formAberto) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={fechar} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {dadosXml ? 'Importar NF de Entrada' : 'Nova NF de Entrada'}
            </h1>
            <p className="text-xs text-gray-400">NF de Entrada</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <FormNfEntrada
            inicial={dadosXml as Parameters<typeof FormNfEntrada>[0]['inicial']}
            onClose={fechar}
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
          <h1 className="text-2xl font-bold text-gray-900">NF de Entrada</h1>
          <p className="text-sm text-gray-500 mt-0.5">Lançamento de notas fiscais de compra — atualiza estoque e gera título a pagar</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xml" className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleXml(e.target.files[0]) }} />
          <button
            onClick={() => { setErroSefaz(''); sincronizarSefaz.mutate() }}
            disabled={sincronizarSefaz.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition"
            title="Baixa NF-es recebidas via NFeDistribuicaoDFe (requer certificado A1)"
          >
            <Cloud size={16} />
            {sincronizarSefaz.isPending ? 'Consultando SEFAZ...' : 'Sincronizar SEFAZ'}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={parsandoXml}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition"
          >
            <Upload size={16} />
            {parsandoXml ? 'Lendo XML...' : 'Importar XML'}
          </button>
          <button
            onClick={() => { setDadosXml(null); setFormAberto(true) }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Plus size={16} /> Entrada Manual
          </button>
        </div>
      </div>

      {erroXml && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertTriangle size={16} /> {erroXml}
        </div>
      )}

      {erroSefaz && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertTriangle size={16} />
          <span className="flex-1">{erroSefaz}</span>
          <button onClick={() => setErroSefaz('')}><X size={14} /></button>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Carregando...</div>
      ) : nfs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
          <FileText size={40} className="mb-3 opacity-30" />
          <p className="font-medium">Nenhuma NF lançada</p>
          <p className="text-sm mt-1">Importe um XML ou faça uma entrada manual</p>
        </div>
      ) : (
        <div className="space-y-2">
          {nfs.map(nf => {
            const conf = statusConfig[nf.status] ?? statusConfig.RASCUNHO
            const aberto = expandido === nf.id
            return (
              <div key={nf.id} className={clsx('border rounded-xl overflow-hidden', nf.status === 'CANCELADA' && 'opacity-60')}>
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandido(aberto ? null : nf.id)}
                >
                  <div className="p-2 rounded-lg bg-blue-50">
                    <FileText size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">
                      NF {nf.numero || '—'}/{nf.serie || '—'}
                      <span className="ml-3 text-sm text-gray-500">{nf.fornecedorNome}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {fmtDate(nf.dataEntrada)} · {nf._count.itens} item(s)
                    </p>
                  </div>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', conf.color)}>
                    {conf.label}
                  </span>
                  <p className="font-semibold text-gray-900 w-28 text-right">{fmt(nf.totalNf)}</p>
                  {nf.status === 'CONFIRMADA' && (
                    <button
                      onClick={e => { e.stopPropagation(); setCancelarId(nf.id); setCancelarErro('') }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                      title="Cancelar NF"
                    >
                      <Ban size={15} />
                    </button>
                  )}
                  {aberto
                    ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                    : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
                </div>

                {aberto && (
                  <div className="border-t bg-gray-50 px-4 py-3">
                    <NfDetalhe id={nf.id} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal resultado SEFAZ */}
      {resultadoSefaz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Cloud size={18} className="text-indigo-600" />
                  Resultado da Sincronização SEFAZ
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {resultadoSefaz.totalDocumentos} documento(s) recebido(s) ·
                  NSU atual: {resultadoSefaz.ultNSU}
                  {resultadoSefaz.resNFeIgnorados > 0 && ` · ${resultadoSefaz.resNFeIgnorados} sumário(s) ignorado(s)`}
                </p>
              </div>
              <button onClick={() => setResultadoSefaz(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {resultadoSefaz.nfes.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <CheckCircle2 size={32} className="mx-auto mb-3 text-green-400" />
                  <p className="font-medium">Nenhuma NF nova encontrada</p>
                  <p className="text-sm mt-1">Todas as notas já foram importadas ou não há novidades.</p>
                </div>
              ) : (
                resultadoSefaz.nfes.map((nfe, idx) => {
                  const n = nfe as Record<string, unknown>
                  return (
                    <div key={idx} className="border rounded-xl p-4 bg-gray-50 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">
                          NF {String(n.numero || '—')}/{String(n.serie || '—')}
                          <span className="ml-2 text-xs text-gray-500">NSU: {String(n.nsu || '—')}</span>
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5">{String(n.emitenteNome || '—')}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Emissão: {String(n.dataEmissao || '—')} ·
                          {(n.itens as unknown[]).length} item(s) ·
                          {(n.fornecedor as Record<string,unknown> | null)
                            ? <span className="text-green-600"> fornecedor vinculado</span>
                            : <span className="text-amber-600"> fornecedor não cadastrado</span>
                          }
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900">{fmt(Number(n.totalNf ?? 0))}</p>
                        <button
                          onClick={() => {
                            setDadosXml(n)
                            setFormAberto(true)
                            setResultadoSefaz(null)
                          }}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                        >
                          <Plus size={12} /> Importar
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setResultadoSefaz(null)}
                className="w-full px-4 py-2 text-sm border rounded-lg hover:bg-white transition">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!cancelarId}
        title="Cancelar NF de Entrada"
        message={cancelarErro || 'Esta ação estornará as movimentações de estoque e cancelará o título a pagar. Continuar?'}
        confirmLabel="Cancelar NF"
        variant={cancelarErro ? 'default' : 'danger'}
        onConfirm={cancelarErro ? undefined : () => cancelar.mutate(cancelarId!)}
        onCancel={() => { setCancelarId(null); setCancelarErro('') }}
        loading={cancelar.isPending}
      />
    </div>
  )
}

// ── Detalhe inline ────────────────────────────────────────────────────────────

function NfDetalhe({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['nf-entrada', id],
    queryFn: () => api.get(`/nf-entrada/${id}`).then(r => r.data),
  })

  if (isLoading) return <p className="text-xs text-gray-400">Carregando...</p>
  if (!data) return null

  return (
    <div className="space-y-4">
      <table className="w-full text-xs">
        <thead><tr className="text-gray-500 border-b">
          <th className="text-left pb-1 font-medium">Item</th>
          <th className="text-left pb-1 font-medium">Produto ERP</th>
          <th className="text-right pb-1 font-medium">Qtd</th>
          <th className="text-right pb-1 font-medium">Vl. Unit.</th>
          <th className="text-right pb-1 font-medium">Total</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {data.itens.map((item: Record<string, unknown>) => (
            <tr key={String(item.id)}>
              <td className="py-1.5 text-gray-700">{String(item.descricao)}</td>
              <td className="py-1.5">
                {item.produto
                  ? <span className="text-green-700 flex items-center gap-1"><Package size={11} /> {String((item.produto as Record<string, unknown>).nome)}</span>
                  : <span className="text-amber-600">Não vinculado</span>}
              </td>
              <td className="py-1.5 text-right font-mono">{Number(item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
              <td className="py-1.5 text-right font-mono">{Number(item.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</td>
              <td className="py-1.5 text-right font-mono font-medium">{Number(item.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.titulos?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Título a Pagar gerado</p>
          {data.titulos.map((t: Record<string, unknown>) => (
            <div key={String(t.id)} className="text-xs text-gray-600 flex gap-4">
              <span>{String(t.descricao)}</span>
              <span className="font-medium">{Number(t.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              <span className="text-gray-400">
                {(t.parcelas as unknown[]).length} parcela(s)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
