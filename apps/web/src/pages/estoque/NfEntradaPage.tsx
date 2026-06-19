import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload, Plus, CheckCircle2, XCircle, FileText,
  Package, AlertTriangle, Trash2, RotateCcw,
  Cloud, X, ArrowLeft, Boxes, Wallet, Calculator, Loader2,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../lib/api'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Produto { id: string; codigo: string; nome: string; unidadeMedida: string; custoUnitario: number }
interface Pessoa { id: string; nome: string; documento: string }
interface ContaBancaria { id: string; nome: string; banco?: string; isCaixa: boolean }

interface ItemForm {
  nItem: number; cProd: string; descricao: string; ncm: string; cfop: string
  unidade: string; quantidade: number; valorUnitario: number; valorTotal: number
  produtoId: string | null
  produtoNovo: boolean
  produto?: Produto | null
}
type EnvioPara = 'PRAZO' | 'CAIXA' | 'CONTA'

interface ParcelaForm {
  numero: string
  dias: number
  vencimento: string
  valor: number
  envioPara: EnvioPara
  contaBancariaId: string | null
  meioPagamento: string
}

interface NfHeader {
  chaveAcesso?: string; numero: string; serie: string
  dataEmissao: string; dataEntrada: string
  fornecedorId?: string | null; fornecedorNome: string; fornecedorCnpj: string
  totalProdutos: number
  vFrete: number; vSeg: number; vDesc: number; vOutro: number
  vBC: number; vICMS: number; vICMSDeson: number
  vBCST: number; vST: number; vFCP: number; vFCPST: number
  vIPI: number; vIPIDevol: number; vPIS: number; vCOFINS: number
  vII: number; vTotTrib: number
  totalImpostos: number; totalNf: number
  contaFinanceiraId: string | null
  fornecedor?: Pessoa | null
}

interface NfEntradaLista {
  id: string; numero: string | null; serie: string | null
  dataEntrada: string; fornecedorNome: string
  totalNf: number; vFrete: number; status: string
  estoqueElancado: boolean; financeiroLancado: boolean; custoFormado: boolean
  parcelasJson: string | null
  fornecedor: { id: string; nome: string } | null
  _count: { itens: number }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (s: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const today = () => new Date().toISOString().split('T')[0]

function mapUnidade(u: string): string {
  const v = u.toUpperCase()
  if (v === 'KG' || v === 'KGS') return 'KG'
  if (v === 'G' || v === 'GR' || v === 'GRS') return 'G'
  if (v === 'L' || v === 'LT' || v === 'LTS') return 'L'
  if (v === 'ML') return 'ML'
  if (v === 'CX' || v === 'BX') return 'CX'
  if (v === 'PCT' || v === 'PC' || v === 'PK') return 'PCT'
  return 'UN'
}

// ── Seletor de Produto (com portal, escapa overflow de tabela) ────────────────

function ProdutoSelector({
  item, produtos, onChange, onNovoProduto,
}: {
  item: ItemForm
  produtos: Produto[]
  onChange: (produtoId: string | null) => void
  onNovoProduto: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const atual = produtos.find(p => p.id === item.produtoId)
  const filtrados = busca.trim()
    ? produtos.filter(p =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busca.toLowerCase()))
    : produtos

  // Se marcado como novo produto
  if (item.produtoNovo) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-2 py-1 font-medium">
          <Plus size={11} /> Produto novo
        </span>
        <button type="button" onClick={() => onNovoProduto()}
          className="text-xs text-gray-400 hover:text-gray-600 underline">desfazer</button>
      </div>
    )
  }

  const displayValue = aberto ? busca : (atual ? `${atual.codigo} — ${atual.nome}` : '')

  function abrir() {
    setRect(inputRef.current?.getBoundingClientRect() ?? null)
    setBusca('')
    setAberto(true)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder="Vincular produto..."
        onChange={e => { setBusca(e.target.value); if (!aberto) abrir(); if (!e.target.value) onChange(null) }}
        onFocus={abrir}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        className={clsx(
          'w-full px-2 py-1.5 text-xs border rounded-lg outline-none focus:ring-1 focus:ring-primary-500',
          item.produtoId
            ? 'bg-green-50 border-green-300 text-green-800'
            : 'bg-amber-50 border-amber-300 text-amber-700',
        )}
      />

      {aberto && rect && createPortal(
        <div
          style={{ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 260), zIndex: 9999 }}
          className="bg-white border rounded-lg shadow-2xl overflow-hidden"
        >
          <div className="max-h-48 overflow-y-auto">
            <button type="button" onMouseDown={() => { onChange(null); setBusca(''); setAberto(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 border-b">
              — Não vincular agora
            </button>
            {filtrados.slice(0, 20).map(p => (
              <button key={p.id} type="button"
                onMouseDown={() => { onChange(p.id); setBusca(''); setAberto(false) }}
                className={clsx('w-full text-left px-3 py-1.5 text-xs hover:bg-primary-50 transition',
                  p.id === item.produtoId && 'bg-primary-50 font-medium text-primary-700')}>
                <span className="font-mono text-gray-400 mr-1">{p.codigo}</span>
                {p.nome}
              </button>
            ))}
            {filtrados.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">Nenhum produto encontrado</p>
            )}
          </div>
          <div className="border-t">
            <button type="button"
              onMouseDown={() => { setAberto(false); onNovoProduto() }}
              className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 font-medium flex items-center gap-1.5 transition">
              <Plus size={12} /> Cadastrar como novo produto
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── Campo de fornecedor com busca ─────────────────────────────────────────────

function FornecedorInput({ pessoasList, fornecedorId, fornecedorNome, fornecedorCnpj, onChange }: {
  pessoasList: Pessoa[]
  fornecedorId: string | null
  fornecedorNome: string
  fornecedorCnpj?: string
  onChange: (id: string | null, nome: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')

  const vinculado = pessoasList.find(p => p.id === fornecedorId)
  const filtrados = busca.trim()
    ? pessoasList.filter(p =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (p.documento ?? '').includes(busca.replace(/\D/g, '')))
    : pessoasList
  const displayValue = aberto ? busca : fornecedorNome

  return (
    <div className="mt-3">
      <label className="block text-xs font-medium text-gray-600 mb-1">
        Fornecedor / Emitente <span className="text-red-500">*</span>
        {vinculado && <span className="ml-2 text-green-600 font-normal">· vinculado ao cadastro</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          placeholder="Digite o nome ou CNPJ..."
          onChange={e => { const v = e.target.value; setBusca(v); setAberto(true); onChange(null, v) }}
          onFocus={() => { setBusca(''); setAberto(true) }}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
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
                    p.id === fornecedorId && 'bg-primary-50 font-medium text-primary-700')}>
                  <span className="font-medium">{p.nome}</span>
                  {p.documento && <span className="ml-2 text-xs text-gray-400">{p.documento}</span>}
                </button>
              ))}
              {filtrados.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Nenhum fornecedor encontrado</p>}
            </div>
          </div>
        )}
      </div>
      {!vinculado && fornecedorNome && (
        fornecedorCnpj
          ? <p className="text-xs text-blue-600 mt-1">Não encontrado no cadastro — será cadastrado automaticamente como fornecedor ao salvar.</p>
          : <p className="text-xs text-amber-600 mt-1">Sem CNPJ — será registrado apenas o nome, sem criar cadastro.</p>
      )}
    </div>
  )
}

// ── Formulário principal ──────────────────────────────────────────────────────

function FormNfEntrada({
  inicial, onClose, nfId, readOnly = false,
}: {
  inicial?: Partial<NfHeader & { itens: ItemForm[]; duplicatas: ParcelaForm[] }>
  onClose: () => void
  nfId?: string
  readOnly?: boolean
}) {
  const qc = useQueryClient()

  const n0 = (k: string) => (inicial as Record<string, unknown>)?.[k] as number ?? 0

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
    vFrete: n0('vFrete'), vSeg: n0('vSeg'), vDesc: n0('vDesc'), vOutro: n0('vOutro'),
    vBC: n0('vBC'), vICMS: n0('vICMS'), vICMSDeson: n0('vICMSDeson'),
    vBCST: n0('vBCST'), vST: n0('vST'), vFCP: n0('vFCP'), vFCPST: n0('vFCPST'),
    vIPI: n0('vIPI'), vIPIDevol: n0('vIPIDevol'), vPIS: n0('vPIS'),
    vCOFINS: n0('vCOFINS'), vII: n0('vII'), vTotTrib: n0('vTotTrib'),
    totalImpostos: n0('totalImpostos'),
    totalNf: inicial?.totalNf ?? 0,
    contaFinanceiraId: (inicial as Record<string, unknown>)?.contaFinanceiraId as string ?? null,
  })
  const [itens, setItens] = useState<ItemForm[]>(inicial?.itens ?? [])

  // Converte duplicatas do XML para ParcelaForm com defaults
  const duplicatasIniciais = inicial?.duplicatas ?? []
  const [parcelas, setParcelas] = useState<ParcelaForm[]>(
    duplicatasIniciais.length > 0
      ? duplicatasIniciais.map(d => ({ ...d, dias: 0, envioPara: 'PRAZO' as EnvioPara, contaBancariaId: null, meioPagamento: 'Dinheiro' }))
      : [{ numero: '001', dias: 0, vencimento: today(), valor: 0, envioPara: 'PRAZO', contaBancariaId: null, meioPagamento: 'Dinheiro' }]
  )
  const [condicaoPagamento, setCondicaoPagamento] = useState('')
  const [erro, setErro] = useState('')

  const { data: pessoas } = useQuery<Pessoa[]>({
    queryKey: ['pessoas-lista'],
    queryFn: () => api.get('/pessoas').then(r => r.data),
  })
  const { data: produtos } = useQuery<Produto[]>({
    queryKey: ['produtos-estoque'],
    queryFn: () => api.get('/produtos').then(r => r.data),
  })
  const { data: contasBancarias } = useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias'],
    queryFn: () => api.get('/financeiro/contas-bancarias').then(r => r.data),
  })
  const { data: contasFinanceiras } = useQuery<{ id: string; codigo: string; nome: string }[]>({
    queryKey: ['contas-financeiras'],
    queryFn: () => api.get('/financeiro/contas').then(r => r.data),
  })

  const salvar = useMutation({
    mutationFn: () => api.post('/nf-entrada/salvar', {
      id: nfId,
      ...header,
      totalProdutos: totalItens,
      fornecedorId: header.fornecedorId || null,
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

  function gerarParcelas() {
    const str = condicaoPagamento.trim().toLowerCase()
    if (!str) return
    const tokens = str.split(/\s+/)
    const dias: number[] = []
    let lastDia = 0
    for (const token of tokens) {
      if (/^\d+x$/.test(token)) {
        const n = parseInt(token)
        for (let i = 1; i <= n; i++) { dias.push(lastDia + i * 30) }
        lastDia = dias[dias.length - 1]
      } else if (/^\+\d+x$/.test(token)) {
        const n = parseInt(token.slice(1))
        for (let i = 1; i <= n; i++) { dias.push(lastDia + i * 30) }
        lastDia = dias[dias.length - 1]
      } else if (/^\d+$/.test(token)) {
        dias.push(parseInt(token))
        lastDia = parseInt(token)
      }
    }
    if (dias.length === 0) return
    const totalNf = header.totalNf || totalItens
    const valorParcela = +(totalNf / dias.length).toFixed(2)
    const diff = +(totalNf - valorParcela * dias.length).toFixed(2)
    const base = new Date(header.dataEntrada + 'T12:00:00')
    setParcelas(dias.map((d, idx) => {
      const dt = new Date(base)
      dt.setDate(dt.getDate() + d)
      return {
        numero: String(idx + 1).padStart(3, '0'),
        dias: d,
        vencimento: dt.toISOString().split('T')[0],
        valor: idx === 0 ? +(valorParcela + diff).toFixed(2) : valorParcela,
        envioPara: 'PRAZO' as EnvioPara,
        contaBancariaId: null,
        meioPagamento: 'Dinheiro',
      }
    }))
  }

  function atualizarParcela<K extends keyof ParcelaForm>(idx: number, campo: K, valor: ParcelaForm[K]) {
    setParcelas(prev => prev.map((p, i) => {
      if (i !== idx) return p
      const novo = { ...p, [campo]: valor }
      // Sincroniza dias ↔ data
      if (campo === 'dias') {
        const base = new Date(header.dataEntrada + 'T12:00:00')
        base.setDate(base.getDate() + Number(valor))
        novo.vencimento = base.toISOString().split('T')[0]
      }
      if (campo === 'vencimento') {
        const base = new Date(header.dataEntrada + 'T12:00:00')
        const venc = new Date(String(valor) + 'T12:00:00')
        novo.dias = Math.round((venc.getTime() - base.getTime()) / 86400000)
      }
      return novo
    }))
  }

  function addItem() {
    setItens(prev => [...prev, {
      nItem: prev.length + 1, cProd: '', descricao: '', ncm: '', cfop: '',
      unidade: 'UN', quantidade: 1, valorUnitario: 0, valorTotal: 0,
      produtoId: null, produtoNovo: false,
    }])
  }

  function setNum(campo: keyof NfHeader, valor: number) {
    setHeader(h => ({ ...h, [campo]: valor }))
  }

  function inputNum(campo: keyof NfHeader, label: string) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <input type="number" step="0.01" min="0"
          value={(header[campo] as number) || 0}
          onChange={e => setNum(campo, Number(e.target.value))}
          className="w-full border rounded-lg px-3 py-2 text-sm text-right focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>
    )
  }

  const totalItens = itens.reduce((s, i) => s + i.valorTotal, 0)
  const totalParcelas = parcelas.reduce((s, p) => s + p.valor, 0)
  const itensSemVinculo = itens.filter(i => !i.produtoId && !i.produtoNovo).length
  const itensNovos = itens.filter(i => i.produtoNovo).length
  const pessoasList = pessoas ?? []
  const produtosList = produtos ?? []

  const totalNfCalculado = +(
    totalItens - header.vDesc + header.vFrete + header.vSeg + header.vOutro +
    header.vII + header.vIPI - header.vIPIDevol + header.vST +
    header.vPIS + header.vCOFINS - header.vICMSDeson + header.vFCP + header.vFCPST
  ).toFixed(2)

  return (
    <div className="space-y-6">
      {readOnly && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          <AlertTriangle size={16} className="shrink-0" />
          Nota com lançamentos — estorne o estoque e/ou financeiro na listagem para habilitar a edição.
        </div>
      )}
      <div className={clsx('space-y-6', readOnly && 'pointer-events-none opacity-60 select-none')}>
      {/* Dados da Nota */}
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
        <FornecedorInput
          pessoasList={pessoasList}
          fornecedorId={header.fornecedorId ?? null}
          fornecedorNome={header.fornecedorNome}
          fornecedorCnpj={header.fornecedorCnpj}
          onChange={(id, nome) => setHeader(h => ({ ...h, fornecedorId: id, fornecedorNome: nome }))}
        />
      </section>

      {/* Itens */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Produtos ou serviços</h3>
          {itensSemVinculo > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle size={11} />
              {itensSemVinculo} sem vínculo
            </span>
          )}
          {itensNovos > 0 && (
            <span className="text-xs text-blue-600">
              · {itensNovos} novo(s) a cadastrar
            </span>
          )}
        </div>

        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-center px-2 py-2 font-medium text-gray-500 w-8">Nº</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Descrição</th>
                <th className="text-left px-2 py-2 font-medium text-gray-600 w-36">Código (SKU)</th>
                <th className="text-center px-2 py-2 font-medium text-gray-600 w-14">Un</th>
                <th className="text-right px-2 py-2 font-medium text-gray-600 w-20">Qtde</th>
                <th className="text-right px-2 py-2 font-medium text-gray-600 w-24">Preço un</th>
                <th className="text-right px-2 py-2 font-medium text-gray-600 w-24">Total</th>
                <th className="text-right px-2 py-2 font-medium text-gray-600 w-16">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {itens.map((item, idx) => {
                const produtoVinculado = produtosList.find(p => p.id === item.produtoId)
                return (
                  <tr key={idx} className="bg-white hover:bg-gray-50/50 group">
                    <td className="text-center px-2 py-2 text-gray-400 font-mono">{item.nItem}</td>
                    <td className="px-3 py-2">
                      <input type="text" value={item.descricao}
                        onChange={e => atualizarItem(idx, 'descricao', e.target.value)}
                        className="w-full border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-400 text-gray-900 placeholder-gray-300"
                        placeholder="Descrição do produto" />
                      {(item.ncm || item.cfop) && (
                        <p className="text-gray-400 mt-0.5">
                          {item.ncm && `NCM ${item.ncm}`}{item.ncm && item.cfop && ' · '}{item.cfop && `CFOP ${item.cfop}`}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {item.produtoNovo ? (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 text-xs font-medium">
                          <Plus size={10} /> Novo
                          <button type="button" title="Desfazer"
                            onClick={() => atualizarItem(idx, 'produtoNovo', false)}
                            className="text-blue-400 hover:text-blue-700 ml-0.5">×</button>
                        </span>
                      ) : produtoVinculado ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-gray-700 font-medium">{produtoVinculado.codigo}</span>
                          <button type="button" title="Desvincular"
                            onClick={() => atualizarItem(idx, 'produtoId', null)}
                            className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        </div>
                      ) : (
                        <ProdutoSelector
                          item={item}
                          produtos={produtosList}
                          onChange={pid => atualizarItem(idx, 'produtoId', pid)}
                          onNovoProduto={() => {
                            atualizarItem(idx, 'produtoNovo', true)
                            atualizarItem(idx, 'produtoId', null)
                          }}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input type="text" value={item.unidade}
                        onChange={e => atualizarItem(idx, 'unidade', e.target.value)}
                        className="w-full text-center border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-400"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" step="0.001" value={item.quantidade}
                        onChange={e => atualizarItem(idx, 'quantidade', Number(e.target.value))}
                        className="w-full text-right border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-400"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" step="0.0001" value={item.valorUnitario}
                        onChange={e => atualizarItem(idx, 'valorUnitario', Number(e.target.value))}
                        className="w-full text-right border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-400"
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-gray-900">
                      {item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button type="button"
                        onClick={() => setItens(prev => prev.filter((_, i) => i !== idx))}
                        className="text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        remover
                      </button>
                    </td>
                  </tr>
                )
              })}
              {itens.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">
                    Nenhum item — importe um XML ou adicione manualmente
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t bg-gray-50/50">
              <tr>
                <td colSpan={5} className="px-3 py-2">
                  <button type="button" onClick={addItem}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium transition">
                    <Plus size={12} /> adicionar outro item
                  </button>
                </td>
                <td className="px-2 py-2 text-right text-xs text-gray-500">Total</td>
                <td className="px-2 py-2 text-right font-semibold text-gray-900 font-mono">
                  {totalItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Frete, Seguro e Despesas */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Frete, Seguro e Despesas Acessórias</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {inputNum('vFrete', 'Frete (R$)')}
          {inputNum('vSeg', 'Seguro (R$)')}
          {inputNum('vOutro', 'Outras Despesas (R$)')}
          {inputNum('vDesc', 'Desconto (R$)')}
        </div>
      </section>

      {/* Impostos */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Impostos (ICMSTot)</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {inputNum('vBC', 'BC ICMS (R$)')}
          {inputNum('vICMS', 'ICMS (R$)')}
          {inputNum('vBCST', 'BC ICMS ST (R$)')}
          {inputNum('vST', 'ICMS ST (R$)')}
          {inputNum('vIPI', 'IPI (R$)')}
          {inputNum('vTotTrib', 'Total Tributos Aprox. (R$)')}
        </div>
        <p className="text-xs text-gray-400 mt-2">vTotTrib: valor informativo (Lei 12.741/2012), não compõe o total da NF.</p>
      </section>

      {/* Condições de Pagamento */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Pagamento</h3>

        {/* Linha superior: condição + categoria */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Condição de pagamento</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={condicaoPagamento}
                onChange={e => setCondicaoPagamento(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && gerarParcelas()}
                placeholder="Ex: 2x, 30 60, 15 +2x"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button type="button" onClick={gerarParcelas}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 text-gray-700 whitespace-nowrap transition">
                ↺ Gerar parcelas
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Nº de parcelas ou prazos. Ex: 30 60, 3x ou 15 +2x</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Categoria (Plano de Contas)</label>
            <select
              value={header.contaFinanceiraId ?? ''}
              onChange={e => setHeader(h => ({ ...h, contaFinanceiraId: e.target.value || null }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">— Sem categoria —</option>
              {(contasFinanceiras ?? []).map(c => (
                <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Categoria da receita ou despesa</p>
          </div>
        </div>

        {/* Tabela de parcelas */}
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-center px-2 py-2 font-medium text-gray-600 w-8">Nº</th>
                <th className="text-center px-2 py-2 font-medium text-gray-600 w-16">Dias</th>
                <th className="text-left px-2 py-2 font-medium text-gray-600 w-36">Data</th>
                <th className="text-right px-2 py-2 font-medium text-gray-600 w-28">Valor</th>
                <th className="text-left px-2 py-2 font-medium text-gray-600">Enviar para</th>
                <th className="text-left px-2 py-2 font-medium text-gray-600 w-36">Meio de Pag. NFe</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {parcelas.map((p, idx) => (
                <tr key={idx} className="bg-white">
                  <td className="px-2 py-2 text-center text-gray-500 font-mono">{idx + 1}</td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" value={p.dias}
                      onChange={e => atualizarParcela(idx, 'dias', Number(e.target.value))}
                      className="w-full text-center border rounded px-1 py-1 focus:ring-1 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input type="date" value={p.vencimento}
                      onChange={e => atualizarParcela(idx, 'vencimento', e.target.value)}
                      className="w-full border rounded px-1 py-1 focus:ring-1 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" step="0.01" value={p.valor}
                      onChange={e => atualizarParcela(idx, 'valor', Number(e.target.value))}
                      className="w-full text-right border rounded px-1 py-1 focus:ring-1 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <select value={p.envioPara}
                        onChange={e => atualizarParcela(idx, 'envioPara', e.target.value as EnvioPara)}
                        className={clsx(
                          'border rounded px-1 py-1 focus:ring-1 focus:ring-primary-500 text-xs flex-shrink-0',
                          p.envioPara === 'CONTA' ? 'w-32' : 'w-full',
                        )}
                      >
                        <option value="PRAZO">Contas a Pagar</option>
                        <option value="CAIXA">Caixa</option>
                        <option value="CONTA">Conta Bancária</option>
                      </select>
                      {p.envioPara === 'CONTA' && (
                        <select
                          value={p.contaBancariaId ?? ''}
                          onChange={e => atualizarParcela(idx, 'contaBancariaId', e.target.value || null)}
                          className="flex-1 min-w-0 border rounded px-1 py-1 focus:ring-1 focus:ring-primary-500 text-xs"
                        >
                          <option value="">— Selecionar —</option>
                          {(contasBancarias ?? []).filter(c => !c.isCaixa).map(c => (
                            <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` — ${c.banco}` : ''}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <select value={p.meioPagamento}
                      onChange={e => atualizarParcela(idx, 'meioPagamento', e.target.value)}
                      className="w-full border rounded px-1 py-1 focus:ring-1 focus:ring-primary-500 text-xs"
                    >
                      {[
                        'Dinheiro', 'Cheque', 'Cartão de Crédito', 'Cartão de Débito',
                        'Boleto', 'PIX', 'Vale Alimentação', 'Outros',
                      ].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {parcelas.length > 1 && (
                      <button onClick={() => setParcelas(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-gray-300 hover:text-red-500 transition">
                        <XCircle size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t">
              <tr>
                <td colSpan={3} className="px-2 py-2">
                  <button type="button"
                    onClick={() => setParcelas(p => [...p, {
                      numero: String(p.length + 1).padStart(3, '0'),
                      dias: 0, vencimento: today(), valor: 0,
                      envioPara: 'PRAZO', contaBancariaId: null, meioPagamento: 'Dinheiro',
                    }])}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                    <Plus size={12} /> adicionar outra parcela
                  </button>
                </td>
                <td className="px-2 py-2 text-right font-semibold text-gray-700">
                  {fmt(totalParcelas)}
                  {Math.abs(totalParcelas - header.totalNf) > 0.01 && header.totalNf > 0 && (
                    <span className="ml-1 text-red-500 font-normal">≠ NF</span>
                  )}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Totais */}
      <section className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            <tr className="bg-gray-50">
              <td className="px-4 py-2 text-gray-600">Produtos (soma dos itens)</td>
              <td className="px-4 py-2 text-right font-mono text-gray-900">{fmt(totalItens)}</td>
            </tr>
            {header.vDesc > 0 && <tr><td className="px-4 py-2 text-red-600">(-) Desconto</td><td className="px-4 py-2 text-right font-mono text-red-600">-{fmt(header.vDesc)}</td></tr>}
            {header.vFrete > 0 && <tr><td className="px-4 py-2 text-gray-600">(+) Frete</td><td className="px-4 py-2 text-right font-mono">{fmt(header.vFrete)}</td></tr>}
            {header.vSeg > 0 && <tr><td className="px-4 py-2 text-gray-600">(+) Seguro</td><td className="px-4 py-2 text-right font-mono">{fmt(header.vSeg)}</td></tr>}
            {header.vOutro > 0 && <tr><td className="px-4 py-2 text-gray-600">(+) Outras Despesas</td><td className="px-4 py-2 text-right font-mono">{fmt(header.vOutro)}</td></tr>}
            {header.vST > 0 && <tr><td className="px-4 py-2 text-gray-600">(+) ICMS ST</td><td className="px-4 py-2 text-right font-mono">{fmt(header.vST)}</td></tr>}
            {header.vIPI > 0 && <tr><td className="px-4 py-2 text-gray-600">(+) IPI</td><td className="px-4 py-2 text-right font-mono">{fmt(header.vIPI)}</td></tr>}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2">
              <td className="px-4 py-3 font-semibold text-gray-700">
                Total NF
                {Math.abs(totalNfCalculado - header.totalNf) > 0.02 && header.totalNf > 0 && (
                  <span className="ml-2 text-xs font-normal text-amber-600">
                    · calculado: {fmt(totalNfCalculado)}
                    <button type="button" onClick={() => setHeader(h => ({ ...h, totalNf: totalNfCalculado }))}
                      className="ml-1 underline hover:text-amber-700">usar</button>
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <input type="number" step="0.01"
                  value={header.totalNf || ''}
                  onChange={e => setHeader(h => ({ ...h, totalNf: Number(e.target.value) }))}
                  placeholder={fmt(totalNfCalculado)}
                  className="w-40 border rounded-lg px-3 py-1.5 text-right font-semibold text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Info sobre o fluxo */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
        <p className="font-medium">Após salvar, use as ações na listagem:</p>
        <p>📦 <strong>Lançar Estoque</strong> — cadastra produtos novos e atualiza quantidades</p>
        <p>💰 <strong>Lançar Financeiro</strong> — cria o lançamento no contas a pagar ou extrato</p>
        <p>🧮 <strong>Formar Custo</strong> — rateia frete e acréscimos nos custos dos produtos</p>
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{erro}</p>}
      </div>

      <div className="flex gap-3 pt-2 border-t">
        <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition">
          {readOnly ? 'Fechar' : 'Cancelar'}
        </button>
        {!readOnly && (
          <button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || !header.fornecedorNome || itens.length === 0}
            className="flex items-center gap-2 px-6 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
          >
            <CheckCircle2 size={16} />
            {salvar.isPending ? 'Salvando...' : 'Salvar Nota'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Modal: Formar Custo ───────────────────────────────────────────────────────

interface PreviewItem {
  id: string; descricao: string; quantidade: number; valorTotal: number
  adicionalRateado: number; custoAtual: number; custoNovo: number
  produto: { codigo: string; nome: string } | null
}

function ModalFormarCusto({ nf, onClose }: { nf: NfEntradaLista; onClose: () => void }) {
  const qc = useQueryClient()
  const [frete, setFrete] = useState(nf.vFrete ?? 0)
  const [outros, setOutros] = useState(0)
  const [erro, setErro] = useState('')

  const { data: preview, isLoading } = useQuery<{ totalAdicional: number; itens: PreviewItem[] }>({
    queryKey: ['preview-custo', nf.id, frete, outros],
    queryFn: () => api.get(`/nf-entrada/${nf.id}/preview-custo`, { params: { frete, outros } }).then(r => r.data),
  })

  const formar = useMutation({
    mutationFn: () => api.post(`/nf-entrada/${nf.id}/formar-custo`, { frete, outros }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nf-entradas'] })
      onClose()
    },
    onError: (e: Error) => setErro(e.message),
  })

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Calculator size={18} className="text-purple-600" /> Formar Custo
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">NF {nf.numero || '—'} — Rateio do frete nos produtos</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Inputs de frete */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Frete (R$)</label>
              <input type="number" step="0.01" min="0" value={frete}
                onChange={e => setFrete(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm text-right focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Outras despesas (R$)</label>
              <input type="number" step="0.01" min="0" value={outros}
                onChange={e => setOutros(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm text-right focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          {/* Tabela de rateio */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Calculando...
            </div>
          ) : preview && preview.itens.length > 0 ? (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Produto</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Total Item</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Frete Rateado</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Custo Atual</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Custo Novo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.itens.map(item => (
                    <tr key={item.id} className="bg-white">
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-900">{item.produto?.nome ?? item.descricao}</p>
                        {item.produto && <p className="text-gray-400">{item.produto.codigo}</p>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(item.valorTotal)}</td>
                      <td className="px-3 py-2 text-right font-mono text-blue-700">+{fmt(item.adicionalRateado)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">{item.custoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">
                        {item.custoNovo.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-right text-xs text-gray-600 font-medium">Total rateado:</td>
                    <td className="px-3 py-2 text-right font-semibold text-blue-700">
                      {fmt(preview.totalAdicional)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm">Nenhum produto vinculado nesta NF.</div>
          )}

          {erro && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{erro}</p>}
        </div>

        <div className="flex gap-3 px-6 pb-6 border-t pt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => formar.mutate()}
            disabled={formar.isPending || !preview || preview.itens.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
          >
            {formar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
            {formar.isPending ? 'Formando...' : 'Confirmar e Formar Custo'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

interface SincResultado {
  totalDocumentos: number; nfesNovos: number; resNFeIgnorados: number
  ultNSU: string; nfes: Record<string, unknown>[]
}

export function NfEntradaPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [dadosXml, setDadosXml] = useState<Record<string, unknown> | null>(null)
  const [parsandoXml, setParsandoXml] = useState(false)
  const [erroXml, setErroXml] = useState('')
  const [busca, setBusca] = useState('')
  const [excluirId, setExcluirId] = useState<string | null>(null)
  const [estornarEstoqueId, setEstornarEstoqueId] = useState<string | null>(null)
  const [estornarFinanceiroId, setEstornarFinanceiroId] = useState<string | null>(null)
  const [estornarErro, setEstornarErro] = useState('')
  const [resultadoSefaz, setResultadoSefaz] = useState<SincResultado | null>(null)
  const [erroSefaz, setErroSefaz] = useState('')
  const [modalCusto, setModalCusto] = useState<NfEntradaLista | null>(null)
  const [editandoNfId, setEditandoNfId] = useState<string | null>(null)
  const [modoReadOnly, setModoReadOnly] = useState(false)
  const [carregandoNf, setCarregandoNf] = useState(false)

  const sincronizarSefaz = useMutation({
    mutationFn: () => api.post('/nf-entrada/sincronizar-sefaz').then(r => r.data as SincResultado),
    onSuccess: (data) => { setResultadoSefaz(data); setErroSefaz('') },
    onError: (e: Error) => setErroSefaz(e.message),
  })

  const { data, isLoading } = useQuery<{ dados: NfEntradaLista[] }>({
    queryKey: ['nf-entradas'],
    queryFn: () => api.get('/nf-entrada').then(r => r.data),
  })

  const lancarEstoque = useMutation({
    mutationFn: (id: string) => api.post(`/nf-entrada/${id}/lancar-estoque`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nf-entradas'] }),
    onError: (e: Error) => alert(e.message),
  })

  const lancarFinanceiro = useMutation({
    mutationFn: (id: string) => api.post(`/nf-entrada/${id}/lancar-financeiro`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nf-entradas'] }),
    onError: (e: Error) => alert(e.message),
  })

  const estornarEstoque = useMutation({
    mutationFn: (id: string) => api.post(`/nf-entrada/${id}/estornar-estoque`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nf-entradas'] }); setEstornarEstoqueId(null); setEstornarErro('') },
    onError: (e: Error) => setEstornarErro(e.message),
  })

  const estornarFinanceiro = useMutation({
    mutationFn: (id: string) => api.post(`/nf-entrada/${id}/estornar-financeiro`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nf-entradas'] }); setEstornarFinanceiroId(null); setEstornarErro('') },
    onError: (e: Error) => setEstornarErro(e.message),
  })

  const excluirNf = useMutation({
    mutationFn: (id: string) => api.delete(`/nf-entrada/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nf-entradas'] }); setExcluirId(null) },
    onError: (e: Error) => alert(e.message),
  })

  function fechar() { setFormAberto(false); setDadosXml(null); setEditandoNfId(null); setModoReadOnly(false) }

  async function abrirNf(nf: NfEntradaLista) {
    if (carregandoNf) return
    setCarregandoNf(true)
    try {
      const res = await api.get(`/nf-entrada/${nf.id}`)
      const d = res.data
      const parcelas: ParcelaForm[] = d.parcelasJson ? JSON.parse(d.parcelasJson) : []
      const inicial = {
        chaveAcesso: d.chaveAcesso ?? '',
        numero: d.numero ?? '',
        serie: d.serie ?? '1',
        dataEmissao: d.dataEmissao?.slice(0, 10) ?? today(),
        dataEntrada: d.dataEntrada?.slice(0, 10) ?? today(),
        fornecedorId: d.fornecedorId ?? null,
        fornecedorNome: d.fornecedorNome ?? '',
        fornecedorCnpj: d.fornecedorCnpj ?? '',
        totalProdutos: Number(d.totalProdutos ?? 0),
        vFrete: Number(d.vFrete ?? 0), vSeg: Number(d.vSeg ?? 0), vDesc: Number(d.vDesc ?? 0),
        vOutro: Number(d.vOutro ?? 0), vBC: Number(d.vBC ?? 0), vICMS: Number(d.vICMS ?? 0),
        vICMSDeson: Number(d.vICMSDeson ?? 0), vBCST: Number(d.vBCST ?? 0), vST: Number(d.vST ?? 0),
        vFCP: Number(d.vFCP ?? 0), vFCPST: Number(d.vFCPST ?? 0), vIPI: Number(d.vIPI ?? 0),
        vIPIDevol: Number(d.vIPIDevol ?? 0), vPIS: Number(d.vPIS ?? 0), vCOFINS: Number(d.vCOFINS ?? 0),
        vII: Number(d.vII ?? 0), vTotTrib: Number(d.vTotTrib ?? 0), totalImpostos: Number(d.totalImpostos ?? 0),
        totalNf: Number(d.totalNf ?? 0),
        contaFinanceiraId: d.contaFinanceiraId ?? null,
        itens: d.itens.map((i: Record<string, unknown>) => ({
          nItem: i.nItem, cProd: i.cProd ?? '', descricao: i.descricao,
          ncm: i.ncm ?? '', cfop: i.cfop ?? '', unidade: i.unidade ?? '',
          quantidade: Number(i.quantidade), valorUnitario: Number(i.valorUnitario),
          valorTotal: Number(i.valorTotal), produtoId: i.produtoId ?? null,
          produtoNovo: i.produtoNovo ?? false, produto: i.produto,
        })),
        duplicatas: parcelas,
      }
      setDadosXml(inicial as unknown as Record<string, unknown>)
      setEditandoNfId(nf.id)
      setModoReadOnly(nf.estoqueElancado || nf.financeiroLancado)
      setFormAberto(true)
    } catch (e) { alert(e instanceof Error ? e.message : 'Erro ao carregar NF') }
    finally { setCarregandoNf(false) }
  }

  async function handleXml(file: File) {
    setParsandoXml(true); setErroXml('')
    try {
      const xml = await file.text()
      const res = await api.post('/nf-entrada/parse-xml', { xml })
      setDadosXml({ ...res.data, xmlOriginal: xml })
      setFormAberto(true)
    } catch (e) { setErroXml(e instanceof Error ? e.message : 'Erro ao ler XML') }
    finally { setParsandoXml(false) }
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    RASCUNHO:   { label: 'Rascunho',   color: 'bg-gray-100 text-gray-600' },
    CONFIRMADA: { label: 'Confirmada', color: 'bg-green-100 text-green-700' },
  }

  const nfs = data?.dados ?? []
  const nfsFiltradas = busca
    ? nfs.filter(nf =>
        nf.fornecedorNome.toLowerCase().includes(busca.toLowerCase()) ||
        (nf.numero ?? '').includes(busca),
      )
    : nfs

  if (formAberto) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={fechar} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {editandoNfId && modoReadOnly
                ? 'Visualizar NF de Entrada'
                : editandoNfId
                  ? 'Editar NF de Entrada'
                  : dadosXml
                    ? 'Importar NF de Entrada'
                    : 'Nova NF de Entrada'}
            </h1>
            <p className="text-xs text-gray-400">NF de Entrada</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <FormNfEntrada
            inicial={dadosXml as Parameters<typeof FormNfEntrada>[0]['inicial']}
            onClose={fechar}
            nfId={editandoNfId ?? undefined}
            readOnly={modoReadOnly}
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
          <p className="text-sm text-gray-500 mt-0.5">Lançamento de notas fiscais de compra</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xml" className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleXml(e.target.files[0]) }} />
          <button onClick={() => { setErroSefaz(''); sincronizarSefaz.mutate() }}
            disabled={sincronizarSefaz.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition">
            <Cloud size={16} />
            {sincronizarSefaz.isPending ? 'Consultando...' : 'Sincronizar SEFAZ'}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={parsandoXml}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition">
            <Upload size={16} />
            {parsandoXml ? 'Lendo XML...' : 'Importar XML'}
          </button>
          <button onClick={() => { setDadosXml(null); setFormAberto(true) }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
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

      {/* Filtro */}
      <div className="flex gap-3">
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por fornecedor ou número da NF..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[280px]"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : nfsFiltradas.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {busca ? 'Nenhuma NF encontrada para o filtro.' : 'Nenhuma NF lançada. Importe um XML ou faça uma entrada manual.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Data Entrada</th>
                <th className="px-4 py-3">NF / Série</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3 text-center">Itens</th>
                <th className="px-4 py-3 text-right">Total NF</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {nfsFiltradas.map(nf => {
                const conf = statusConfig[nf.status] ?? statusConfig.RASCUNHO
                return (
                  <tr key={nf.id}
                    onClick={() => abrirNf(nf)}
                    className={clsx('hover:bg-gray-50 transition', carregandoNf ? 'cursor-wait' : 'cursor-pointer')}
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(nf.dataEntrada)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                      {nf.numero || '—'}/{nf.serie || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{nf.fornecedorNome}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{nf._count.itens}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                      {fmt(nf.totalNf)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', conf.color)}>
                        {conf.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                        <>
                            {/* Estoque: lançar ou estornar */}
                            {nf.estoqueElancado ? (
                              <button
                                onClick={() => { setEstornarEstoqueId(nf.id); setEstornarErro('') }}
                                title={nf.custoFormado ? 'Estornar estoque e custo' : 'Estornar lançamento de estoque'}
                                className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition"
                              >
                                <RotateCcw size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => lancarEstoque.mutate(nf.id)}
                                disabled={lancarEstoque.isPending}
                                title="Lançar Estoque"
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition disabled:opacity-50"
                              >
                                <Boxes size={15} />
                              </button>
                            )}

                            {/* Financeiro: lançar ou estornar */}
                            {nf.financeiroLancado ? (
                              <button
                                onClick={() => { setEstornarFinanceiroId(nf.id); setEstornarErro('') }}
                                title="Estornar lançamento financeiro"
                                className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition"
                              >
                                <RotateCcw size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => lancarFinanceiro.mutate(nf.id)}
                                disabled={lancarFinanceiro.isPending}
                                title="Lançar Financeiro"
                                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 hover:text-green-700 transition disabled:opacity-50"
                              >
                                <Wallet size={15} />
                              </button>
                            )}

                            {/* Formar Custo */}
                            <button
                              onClick={() => nf.estoqueElancado && !nf.custoFormado && setModalCusto(nf)}
                              disabled={nf.custoFormado || !nf.estoqueElancado}
                              title={nf.custoFormado ? 'Custo já formado' : !nf.estoqueElancado ? 'Lance o estoque primeiro' : 'Formar Custo'}
                              className={clsx('p-1.5 rounded-lg transition',
                                nf.custoFormado
                                  ? 'text-green-600 bg-green-50 cursor-default'
                                  : nf.estoqueElancado
                                    ? 'text-purple-600 hover:bg-purple-50 hover:text-purple-700'
                                    : 'text-gray-300 cursor-not-allowed')}
                            >
                              {nf.custoFormado ? <CheckCircle2 size={15} /> : <Calculator size={15} />}
                            </button>

                            {/* Excluir (só sem lançamentos) */}
                            {!nf.estoqueElancado && !nf.financeiroLancado && (
                              <button
                                onClick={() => setExcluirId(nf.id)}
                                title="Excluir NF"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                        </>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal resultado SEFAZ */}
      {resultadoSefaz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Cloud size={18} className="text-indigo-600" /> Resultado SEFAZ
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {resultadoSefaz.totalDocumentos} doc(s) · NSU: {resultadoSefaz.ultNSU}
                  {resultadoSefaz.resNFeIgnorados > 0 && ` · ${resultadoSefaz.resNFeIgnorados} sumário(s) ignorado(s)`}
                </p>
              </div>
              <button onClick={() => setResultadoSefaz(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {resultadoSefaz.nfes.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <CheckCircle2 size={32} className="mx-auto mb-3 text-green-400" />
                  <p className="font-medium">Nenhuma NF nova encontrada</p>
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
                          {String(n.dataEmissao || '—')} ·
                          {(n.itens as unknown[]).length} item(s) ·
                          {(n.fornecedor as Record<string, unknown> | null)
                            ? <span className="text-green-600"> fornecedor vinculado</span>
                            : <span className="text-amber-600"> fornecedor não cadastrado</span>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900">{fmt(Number(n.totalNf ?? 0))}</p>
                        <button
                          onClick={() => { setDadosXml(n); setFormAberto(true); setResultadoSefaz(null) }}
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

      {/* Modais de ações */}
      {modalCusto && (
        <ModalFormarCusto nf={modalCusto} onClose={() => setModalCusto(null)} />
      )}

      <ConfirmDialog
        open={!!excluirId}
        title="Excluir NF de Entrada"
        message="A nota será excluída permanentemente. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => excluirNf.mutate(excluirId!)}
        onCancel={() => setExcluirId(null)}
        loading={excluirNf.isPending}
      />

      <ConfirmDialog
        open={!!estornarEstoqueId}
        title="Estornar Lançamento de Estoque"
        message={estornarErro || 'As movimentações de estoque desta NF serão revertidas e os produtos terão suas quantidades decrementadas. Continuar?'}
        confirmLabel="Estornar Estoque"
        variant={estornarErro ? 'default' : 'warning'}
        onConfirm={estornarErro ? undefined : () => estornarEstoque.mutate(estornarEstoqueId!)}
        onCancel={() => { setEstornarEstoqueId(null); setEstornarErro('') }}
        loading={estornarEstoque.isPending}
      />

      <ConfirmDialog
        open={!!estornarFinanceiroId}
        title="Estornar Lançamento Financeiro"
        message={estornarErro || 'Os títulos financeiros desta NF serão excluídos. Parcelas já quitadas impedem o estorno. Continuar?'}
        confirmLabel="Estornar Financeiro"
        variant={estornarErro ? 'default' : 'warning'}
        onConfirm={estornarErro ? undefined : () => estornarFinanceiro.mutate(estornarFinanceiroId!)}
        onCancel={() => { setEstornarFinanceiroId(null); setEstornarErro('') }}
        loading={estornarFinanceiro.isPending}
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
                  : item.produtoNovo
                    ? <span className="text-blue-600 flex items-center gap-1"><Plus size={11} /> Produto novo</span>
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
          <p className="text-xs font-medium text-gray-600 mb-1">Título gerado</p>
          {data.titulos.map((t: Record<string, unknown>) => (
            <div key={String(t.id)} className="text-xs text-gray-600 flex gap-4">
              <span>{String(t.descricao)}</span>
              <span className="font-medium">{Number(t.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              <span className="text-gray-400">{(t.parcelas as unknown[]).length} parcela(s)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
