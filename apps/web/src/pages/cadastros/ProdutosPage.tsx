import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Package, Pencil, PowerOff, Power, AlertTriangle, ArrowLeft, Layers, XCircle, CheckCircle2, History } from 'lucide-react'
import clsx from 'clsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormField, Input, Select, CurrencyInput } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { Form } from '../../components/ui/Form'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type UnidadeMedida = 'KG' | 'G' | 'L' | 'ML' | 'UN' | 'CX' | 'PCT'

interface Produto {
  id: string; codigo: string; nome: string
  tipo: 'INSUMO' | 'PRODUTO_ACABADO' | 'INSUMO_PRODUTO'
  aprovisionamento: 'COMPRADO' | 'FABRICADO'
  categoriaId?: string | null
  categoria?: { id: string; nome: string } | null
  ativo: boolean
  unidadeMedida: UnidadeMedida; estoqueAtual: number; estoqueMinimo: number; custoUnitario: number
  precoVenda?: number
  ncm?: string; cest?: string; gtin?: string; origem: number
  fornecedorId?: string | null
  codigoFornecedor?: string | null
  fatorConversao?: number | null
  operacaoConversao?: 'MULTIPLICAR' | 'DIVIDIR' | null
}

interface Fornecedor {
  id: string; nome: string; nomeFantasia?: string | null; documento?: string | null; tipo: string
}

interface BomItemForm {
  componenteId: string
  quantidade: number
  unidade: UnidadeMedida
  percPerda: number
  ordem: number
}

interface BomForm {
  qtdeProduzida: number
  unidadeProduzida: UnidadeMedida
  tempoPreparo: number | null
  instrucoes: string
  itens: BomItemForm[]
}

interface ProdutoSimples {
  id: string; codigo: string; nome: string
  unidadeMedida: UnidadeMedida; custoUnitario: number
}

// ─── Schema do formulário ─────────────────────────────────────────────────────

const schema = z.object({
  tipo: z.enum(['INSUMO', 'PRODUTO_ACABADO', 'INSUMO_PRODUTO']),
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  categoriaId: z.string().optional().nullable(),
  unidadeMedida: z.enum(['KG', 'G', 'L', 'ML', 'UN', 'CX', 'PCT']),
  estoqueMinimo: z.coerce.number().min(0),
  custoUnitario: z.coerce.number().min(0),
  precoVenda: z.coerce.number().min(0).optional(),
  ncm: z.string().max(8).optional(),
  cest: z.string().max(7).optional(),
  gtin: z.string().max(14).optional(),
  origem: z.coerce.number().min(0).max(8),
  fornecedorId: z.string().optional().nullable(),
  codigoFornecedor: z.string().max(60).optional().nullable(),
  fatorConversao: z.coerce.number().positive().optional().nullable(),
  operacaoConversao: z.enum(['MULTIPLICAR', 'DIVIDIR']).optional().nullable(),
})

type FormData = z.infer<typeof schema>

// ─── Badges ───────────────────────────────────────────────────────────────────

const tipoCor: Record<string, string> = {
  INSUMO: 'bg-blue-100 text-blue-700',
  PRODUTO_ACABADO: 'bg-emerald-100 text-emerald-700',
  INSUMO_PRODUTO: 'bg-purple-100 text-purple-700',
}

const tipoLabel: Record<string, string> = {
  INSUMO: 'Insumo',
  PRODUTO_ACABADO: 'Produto',
  INSUMO_PRODUTO: 'Insumo + Produto',
}

// ─── Custos Tab ───────────────────────────────────────────────────────────────

const motivoLabel: Record<string, string> = {
  MANUAL:         'Edição manual',
  NF_ENTRADA:     'NF de Entrada',
  FORMACAO_CUSTO: 'Formação de custo',
  ESTORNO_NF:     'Estorno de NF',
  BOM:            'Composição (BOM)',
}

const motivoCor: Record<string, string> = {
  MANUAL:         'bg-gray-100 text-gray-600',
  NF_ENTRADA:     'bg-blue-100 text-blue-700',
  FORMACAO_CUSTO: 'bg-amber-100 text-amber-700',
  ESTORNO_NF:     'bg-red-100 text-red-600',
  BOM:            'bg-purple-100 text-purple-700',
}

interface RegistroCusto {
  id: string
  custo: number
  motivo: string
  observacao: string | null
  criadoEm: string
  nfEntrada: { numero: string | null; dataEntrada: string } | null
}

function CustosTab({ produtoId }: { produtoId?: string }) {
  const { data: custos = [], isLoading } = useQuery<RegistroCusto[]>({
    queryKey: ['produto-custos', produtoId],
    queryFn: () => api.get(`/produtos/${produtoId}/custos`).then(r => r.data),
    enabled: !!produtoId,
  })

  if (!produtoId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 gap-3">
        <History size={32} />
        <p className="text-sm">Salve o produto primeiro para visualizar o histórico de custos.</p>
      </div>
    )
  }

  if (isLoading) return <div className="py-8 text-center text-gray-400 text-sm">Carregando...</div>

  if (custos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 gap-3">
        <History size={32} />
        <p className="text-sm">Nenhuma alteração de custo registrada ainda.</p>
        <p className="text-xs">O histórico será criado ao lançar NFs, salvar BOM ou editar manualmente o custo.</p>
      </div>
    )
  }

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const fmtR$ = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })

  return (
    <div className="border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">Data</th>
            <th className="text-left px-4 py-2.5 font-medium">Motivo</th>
            <th className="text-right px-4 py-2.5 font-medium">Custo</th>
            <th className="text-left px-4 py-2.5 font-medium">Observação</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {custos.map((r, i) => (
            <tr key={r.id} className={i === 0 ? 'bg-primary-50/40' : 'bg-white hover:bg-gray-50/50'}>
              <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.criadoEm)}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${motivoCor[r.motivo] ?? 'bg-gray-100 text-gray-600'}`}>
                  {motivoLabel[r.motivo] ?? r.motivo}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-800">
                {fmtR$(Number(r.custo))}
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-500">
                {r.observacao}
                {r.nfEntrada?.numero && <span className="ml-1 text-blue-600">· NF {r.nfEntrada.numero}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── BOM Tab ──────────────────────────────────────────────────────────────────

const UNIDADES: UnidadeMedida[] = ['KG', 'G', 'L', 'ML', 'UN', 'CX', 'PCT']
const fmtCusto = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })

function BomTab({ produtoId }: { produtoId?: string }) {
  const qc = useQueryClient()
  const [bom, setBom] = useState<BomForm>({
    qtdeProduzida: 1, unidadeProduzida: 'UN', tempoPreparo: null, instrucoes: '', itens: [],
  })
  const [erro, setErro] = useState('')
  // combobox de busca por componente
  const [buscaComp, setBuscaComp] = useState<Record<number, string>>({})
  const [abertaComp, setAbertaComp] = useState<number | null>(null)
  const comboRef = useRef<HTMLDivElement>(null)
  const inputRefs = useRef<Array<{ comp: HTMLInputElement | null; qtd: HTMLInputElement | null }>>([])

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setAbertaComp(null)
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [])

  const { data: produtoDetalhe, isLoading } = useQuery({
    queryKey: ['produto-detalhe', produtoId],
    queryFn: () => api.get(`/produtos/${produtoId}`).then(r => r.data),
    enabled: !!produtoId,
  })

  const { data: todos = [] } = useQuery<ProdutoSimples[]>({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos').then(r => r.data),
  })

  useEffect(() => {
    if (produtoDetalhe?.bom) {
      const b = produtoDetalhe.bom
      setBom({
        qtdeProduzida:    Number(b.qtdeProduzida),
        unidadeProduzida: b.unidadeProduzida,
        tempoPreparo:     b.tempoPreparo ?? null,
        instrucoes:       b.instrucoes ?? '',
        itens: b.itens.map((i: Record<string, unknown>) => ({
          componenteId: i.componenteId,
          quantidade:   Number(i.quantidade),
          unidade:      i.unidade as UnidadeMedida,
          percPerda:    Number(i.percPerda),
          ordem:        Number(i.ordem),
        })),
      })
    }
  }, [produtoDetalhe?.bom])

  const salvar = useMutation({
    mutationFn: () => api.put(`/produtos/${produtoId}/bom`, bom),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produto-detalhe', produtoId] })
      qc.invalidateQueries({ queryKey: ['produtos'] })
      setErro('')
    },
    onError: (e: Error) => setErro(e.message),
  })

  const remover = useMutation({
    mutationFn: () => api.delete(`/produtos/${produtoId}/bom`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produto-detalhe', produtoId] })
      qc.invalidateQueries({ queryKey: ['produtos'] })
      setBom({ qtdeProduzida: 1, unidadeProduzida: 'UN', tempoPreparo: null, instrucoes: '', itens: [] })
    },
    onError: (e: Error) => setErro(e.message),
  })

  if (!produtoId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 gap-3">
        <Layers size={32} />
        <p className="text-sm">Salve o produto primeiro para configurar a composição (BOM).</p>
      </div>
    )
  }

  if (isLoading) return <div className="py-8 text-center text-gray-400 text-sm">Carregando...</div>

  const componentes = todos.filter(p => p.id !== produtoId)
  const temBom = !!produtoDetalhe?.bom

  const custoLote = bom.itens.reduce((acc, item) => {
    const comp = componentes.find(p => p.id === item.componenteId)
    if (!comp) return acc
    return acc + Number(comp.custoUnitario) * item.quantidade * (1 + item.percPerda / 100)
  }, 0)
  const custoUnit = bom.qtdeProduzida > 0 ? custoLote / bom.qtdeProduzida : 0

  function addItem() {
    setBom(b => ({ ...b, itens: [...b.itens, { componenteId: '', quantidade: 1, unidade: 'KG', percPerda: 0, ordem: b.itens.length }] }))
  }

  function upd<K extends keyof BomItemForm>(idx: number, campo: K, valor: BomItemForm[K]) {
    setBom(b => ({ ...b, itens: b.itens.map((it, i) => i === idx ? { ...it, [campo]: valor } : it) }))
  }

  return (
    <div className="space-y-4">
      {/* Tamanho do lote */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
        <span className="text-sm text-gray-600">Este lote produz</span>
        <input type="number" min="0.001" step="0.001" value={bom.qtdeProduzida}
          onChange={e => setBom(b => ({ ...b, qtdeProduzida: Number(e.target.value) }))}
          className="w-24 border rounded-lg px-3 py-1.5 text-sm text-right focus:ring-2 focus:ring-primary-500"
        />
        <select value={bom.unidadeProduzida}
          onChange={e => setBom(b => ({ ...b, unidadeProduzida: e.target.value as UnidadeMedida }))}
          className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500"
        >
          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        {bom.tempoPreparo !== null ? (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600 whitespace-nowrap">Tempo preparo</span>
            <input type="number" min="1" value={bom.tempoPreparo ?? ''}
              onChange={e => setBom(b => ({ ...b, tempoPreparo: Number(e.target.value) || null }))}
              className="w-16 border rounded-lg px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-500">min</span>
            <button type="button" onClick={() => setBom(b => ({ ...b, tempoPreparo: null }))}
              className="text-gray-300 hover:text-red-400 transition"><XCircle size={14} /></button>
          </div>
        ) : (
          <button type="button" onClick={() => setBom(b => ({ ...b, tempoPreparo: 30 }))}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">
            + tempo de preparo
          </button>
        )}
      </div>

      {/* Componentes */}
      <div ref={comboRef} className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Componente</th>
              <th className="text-right px-3 py-2 font-medium w-28">Quantidade</th>
              <th className="text-center px-3 py-2 font-medium w-20">Un.</th>
              <th className="text-right px-3 py-2 font-medium w-20">% Perda</th>
              <th className="text-right px-3 py-2 font-medium w-36">Custo</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {bom.itens.map((item, idx) => {
              const comp = componentes.find(p => p.id === item.componenteId)
              const custoItem = comp
                ? Number(comp.custoUnitario) * item.quantidade * (1 + item.percPerda / 100)
                : 0
              const busca = buscaComp[idx] ?? ''
              const filtrados = busca.length >= 1
                ? componentes.filter(p =>
                    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
                    p.codigo.includes(busca),
                  ).slice(0, 12)
                : componentes.slice(0, 12)
              return (
                <tr key={idx} className="bg-white hover:bg-gray-50/50">
                  {/* Combobox de busca */}
                  <td className="px-3 py-2 relative">
                    <input
                      type="text"
                      ref={el => { if (!inputRefs.current[idx]) inputRefs.current[idx] = { comp: null, qtd: null }; inputRefs.current[idx].comp = el }}
                      value={abertaComp === idx ? busca : (comp ? `${comp.codigo} — ${comp.nome}` : '')}
                      placeholder="Buscar por nome ou código..."
                      onFocus={() => {
                        setAbertaComp(idx)
                        setBuscaComp(b => ({ ...b, [idx]: '' }))
                      }}
                      onChange={e => setBuscaComp(b => ({ ...b, [idx]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (abertaComp === idx && filtrados.length > 0) {
                            const p = filtrados[0]
                            upd(idx, 'componenteId', p.id)
                            upd(idx, 'unidade', p.unidadeMedida)
                            setBuscaComp(b => ({ ...b, [idx]: '' }))
                          }
                          setAbertaComp(null)
                          inputRefs.current[idx]?.qtd?.focus()
                        }
                      }}
                      className="w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary-500"
                    />
                    {abertaComp === idx && (
                      <div className="absolute left-3 top-full mt-0.5 z-50 w-72 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filtrados.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-gray-400">Nenhum produto encontrado</p>
                        ) : filtrados.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault()
                              upd(idx, 'componenteId', p.id)
                              upd(idx, 'unidade', p.unidadeMedida)
                              setBuscaComp(b => ({ ...b, [idx]: '' }))
                              setAbertaComp(null)
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-primary-50 flex items-center justify-between gap-2"
                          >
                            <span><span className="font-mono text-gray-400">{p.codigo}</span> — {p.nome}</span>
                            <span className="text-gray-400 whitespace-nowrap">{p.unidadeMedida}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" step="0.001" min="0.001" value={item.quantidade}
                      ref={el => { if (!inputRefs.current[idx]) inputRefs.current[idx] = { comp: null, qtd: null }; inputRefs.current[idx].qtd = el }}
                      onChange={e => upd(idx, 'quantidade', Number(e.target.value))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const newIdx = bom.itens.length
                          setBom(b => ({ ...b, itens: [...b.itens, { componenteId: '', quantidade: 1, unidade: 'KG', percPerda: 0, ordem: b.itens.length }] }))
                          setTimeout(() => {
                            setAbertaComp(newIdx)
                            setBuscaComp(b => ({ ...b, [newIdx]: '' }))
                            inputRefs.current[newIdx]?.comp?.focus()
                          }, 30)
                        }
                      }}
                      className="w-full text-right border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select value={item.unidade}
                      onChange={e => upd(idx, 'unidade', e.target.value as UnidadeMedida)}
                      className="w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary-500"
                    >
                      {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.1" min="0" max="100" value={item.percPerda}
                      onChange={e => upd(idx, 'percPerda', Number(e.target.value))}
                      className="w-full text-right border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-mono text-gray-700">
                    {comp ? `R$ ${fmtCusto(custoItem)}` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <button type="button"
                      onClick={() => setBom(b => ({ ...b, itens: b.itens.filter((_, i) => i !== idx) }))}
                      className="p-1 text-gray-300 hover:text-red-500 transition">
                      <XCircle size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
            {bom.itens.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400 text-sm">
                  Nenhum componente — clique em "adicionar" abaixo
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50 border-t">
            <tr>
              <td className="px-3 py-2">
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium transition">
                  <Plus size={12} /> adicionar componente
                </button>
              </td>
              <td colSpan={3} className="px-3 py-2 text-right text-xs text-gray-500">
                Custo do lote ({bom.qtdeProduzida} {bom.unidadeProduzida}):
              </td>
              <td className="px-3 py-2 text-right text-xs font-semibold text-gray-800 font-mono">
                R$ {fmtCusto(custoLote)}
              </td>
              <td />
            </tr>
            <tr>
              <td colSpan={3} />
              <td className="px-3 pb-2 text-right text-xs text-gray-500">Custo unitário calculado:</td>
              <td className="px-3 pb-2 text-right text-sm font-bold text-primary-700 font-mono">
                R$ {fmtCusto(custoUnit)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Instruções */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Instruções / Observações</label>
        <textarea
          value={bom.instrucoes}
          onChange={e => setBom(b => ({ ...b, instrucoes: e.target.value }))}
          rows={3}
          placeholder="Modo de preparo, temperatura, dicas..."
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{erro}</p>}

      <div className="flex items-center gap-3 pt-2 border-t">
        {temBom && (
          <button type="button" onClick={() => remover.mutate()} disabled={remover.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition">
            {remover.isPending ? 'Removendo...' : 'Remover BOM'}
          </button>
        )}
        <button type="button" onClick={() => salvar.mutate()}
          disabled={salvar.isPending || bom.itens.length === 0 || bom.itens.some(i => !i.componenteId)}
          className="ml-auto flex items-center gap-2 px-6 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition">
          <CheckCircle2 size={16} />
          {salvar.isPending ? 'Salvando...' : temBom ? 'Atualizar BOM' : 'Salvar BOM'}
        </button>
      </div>
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function ProdutoForm({
  initialData,
  onSuccess,
  onCancel,
}: {
  initialData?: Produto
  onSuccess: () => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const isEditing = !!initialData
  const [aba, setAba] = useState<'geral' | 'bom' | 'custos'>('geral')
  const [buscaForn, setBuscaForn] = useState('')
  const [abertaForn, setAbertaForn] = useState(false)

  const { data: todasPessoas = [] } = useQuery<Fornecedor[]>({
    queryKey: ['pessoas-all'],
    queryFn: () => api.get('/pessoas').then(r => r.data),
  })
  const fornecedores = todasPessoas.filter(p => p.tipo === 'FORNECEDOR' || p.tipo === 'AMBOS')

  const { data: categorias = [] } = useQuery<{ id: string; nome: string; ativo: boolean }[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then(r => r.data),
  })

  const { register, handleSubmit, watch, control, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData
      ? {
          tipo: initialData.tipo,
          nome: initialData.nome,
          categoriaId: initialData.categoriaId ?? '',
          unidadeMedida: initialData.unidadeMedida as FormData['unidadeMedida'],
          estoqueMinimo: Number(initialData.estoqueMinimo),
          custoUnitario: Number(initialData.custoUnitario),
          precoVenda: initialData.precoVenda ? Number(initialData.precoVenda) : undefined,
          ncm: initialData.ncm ?? '',
          cest: initialData.cest ?? '',
          gtin: initialData.gtin ?? '',
          origem: initialData.origem ?? 0,
          fornecedorId: initialData.fornecedorId ?? '',
          codigoFornecedor: initialData.codigoFornecedor ?? '',
          fatorConversao: initialData.fatorConversao ?? undefined,
          operacaoConversao: initialData.operacaoConversao ?? undefined,
        }
      : {
          tipo: 'INSUMO',
          unidadeMedida: 'KG',
          estoqueMinimo: 0,
          custoUnitario: 0,
          origem: 0,
          fornecedorId: '',
          codigoFornecedor: '',
        },
  })

  const tipo = watch('tipo')
  const mostraEstoque = tipo === 'INSUMO' || tipo === 'INSUMO_PRODUTO'
  const mostraVenda = tipo === 'PRODUTO_ACABADO' || tipo === 'INSUMO_PRODUTO'

  const { data: produtoDetalhe } = useQuery({
    queryKey: ['produto-detalhe', initialData?.id],
    queryFn: () => api.get(`/produtos/${initialData!.id}`).then(r => r.data),
    enabled: !!initialData?.id,
  })
  const temBom = !!produtoDetalhe?.bom

  useEffect(() => {
    if (temBom && produtoDetalhe?.custoUnitario !== undefined) {
      setValue('custoUnitario', Number(produtoDetalhe.custoUnitario))
    }
  }, [temBom, produtoDetalhe?.custoUnitario, setValue])

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        categoriaId: data.categoriaId || null,
        precoVenda: data.precoVenda || undefined,
        ncm: data.ncm || undefined,
        cest: data.cest || undefined,
        gtin: data.gtin || undefined,
        fornecedorId: data.fornecedorId || null,
        codigoFornecedor: data.codigoFornecedor || null,
        fatorConversao: data.fatorConversao || null,
        operacaoConversao: data.fatorConversao ? (data.operacaoConversao ?? 'MULTIPLICAR') : null,
      }
      return isEditing
        ? api.put(`/produtos/${initialData.id}`, payload)
        : api.post('/produtos', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      onSuccess()
    },
  })

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-0 -mt-1">
        {([
          { key: 'geral' as const,   label: 'Produto',            icon: null },
          { key: 'bom' as const,     label: 'Composição (BOM)',   icon: <Layers size={13} /> },
          { key: 'custos' as const,  label: 'Custos',             icon: <History size={13} /> },
        ]).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setAba(t.key)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
              aba === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {aba === 'geral' && (
        <>
          {/* Código + Nome + Tipo */}
          <div className="grid grid-cols-[130px_1fr_180px] gap-3">
            <FormField label="Código">
              <input
                readOnly
                value={initialData?.codigo ?? ''}
                placeholder="—"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-500 cursor-default select-none"
              />
            </FormField>
            <FormField label="Nome" error={errors.nome?.message} required>
              <Input {...register('nome')} placeholder="Ex: Farinha de Trigo" error={!!errors.nome} />
            </FormField>
            <FormField label="Tipo" error={errors.tipo?.message} required>
              <Select {...register('tipo')}>
                <option value="INSUMO">Insumo</option>
                <option value="PRODUTO_ACABADO">Produto Acabado</option>
                <option value="INSUMO_PRODUTO">Insumo + Produto</option>
              </Select>
            </FormField>
          </div>

          {/* Unidade | Categoria | Origem | NCM */}
          <div className="grid grid-cols-[90px_220px_1fr_180px] gap-3">
            <FormField label="Unidade" error={errors.unidadeMedida?.message} required>
              <Select {...register('unidadeMedida')}>
                <option value="KG">KG</option>
                <option value="G">G</option>
                <option value="L">L</option>
                <option value="ML">ML</option>
                <option value="UN">UN</option>
                <option value="CX">CX</option>
                <option value="PCT">PCT</option>
              </Select>
            </FormField>
            <FormField label="Categoria">
              <Select {...register('categoriaId')}>
                <option value="">—</option>
                {categorias.filter(c => c.ativo).map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Origem">
              <Select {...register('origem')}>
                <option value={0}>0 — Nacional</option>
                <option value={1}>1 — Estrangeira (importação direta)</option>
                <option value={2}>2 — Estrangeira (mercado interno)</option>
              </Select>
            </FormField>
            <FormField label="NCM">
              <Input {...register('ncm')} placeholder="19059090" maxLength={8} />
            </FormField>
          </div>

          {/* Fornecedor | Cód. Fornecedor | Conversão | Fator | Preview */}
          <div className="grid grid-cols-[400px_200px_165px_100px_1fr] gap-3 items-end">
            <FormField label="Fornecedor">
              {(() => {
                const fvId = watch('fornecedorId')
                const fv = fornecedores.find(f => f.id === fvId)
                const filtrados = buscaForn.trim()
                  ? fornecedores.filter(f =>
                      (f.nomeFantasia || f.nome).toLowerCase().includes(buscaForn.toLowerCase()) ||
                      (f.documento ?? '').includes(buscaForn.replace(/\D/g, '')))
                  : fornecedores
                return (
                  <div className="relative">
                    <input type="hidden" {...register('fornecedorId')} />
                    <input
                      type="text"
                      value={abertaForn ? buscaForn : (fv ? (fv.nomeFantasia || fv.nome) : '')}
                      placeholder="Nome ou CNPJ..."
                      onChange={e => { setBuscaForn(e.target.value); setAbertaForn(true) }}
                      onFocus={() => { setBuscaForn(''); setAbertaForn(true) }}
                      onBlur={() => setTimeout(() => setAbertaForn(false), 150)}
                      className={clsx(
                        'w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500',
                        fv ? 'border-green-300 bg-green-50 text-green-900 pr-8' : 'border-gray-300',
                      )}
                    />
                    {fv && !abertaForn && (
                      <button type="button" onClick={() => setValue('fornecedorId', '')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition">
                        <XCircle size={14} />
                      </button>
                    )}
                    {abertaForn && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-0.5 bg-white border rounded-lg shadow-xl overflow-hidden">
                        <div className="max-h-44 overflow-y-auto">
                          {filtrados.slice(0, 15).map(f => (
                            <button key={f.id} type="button"
                              onMouseDown={() => { setValue('fornecedorId', f.id); setAbertaForn(false) }}
                              className={clsx('w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition',
                                f.id === fvId && 'bg-primary-50 font-medium text-primary-700')}>
                              <span className="font-medium">{f.nomeFantasia || f.nome}</span>
                              {f.documento && <span className="ml-2 text-xs text-gray-400">{f.documento}</span>}
                            </button>
                          ))}
                          {filtrados.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-3">Nenhum encontrado</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </FormField>
            <FormField label="Cód. Fornecedor">
              <Input {...register('codigoFornecedor')} placeholder="Ex: 12345" />
            </FormField>
            <FormField label="Conversão">
              <Select {...register('operacaoConversao')}>
                <option value="">— Nenhuma —</option>
                <option value="MULTIPLICAR">Multiplicar (×)</option>
                <option value="DIVIDIR">Dividir (÷)</option>
              </Select>
            </FormField>
            <FormField label="Fator" error={errors.fatorConversao?.message}>
              <Input
                {...register('fatorConversao')}
                type="number" step="0.0001" min="0.0001"
                placeholder="Ex: 25"
                disabled={!watch('operacaoConversao')}
              />
            </FormField>
            {(() => {
              const op = watch('operacaoConversao')
              const fator = Number(watch('fatorConversao')) || 0
              const unid = watch('unidadeMedida')
              if (!op || !fator) return <div />
              const resultado = op === 'MULTIPLICAR'
                ? `1 × ${fator} = ${fator} ${unid}`
                : `1 ÷ ${fator} = ${+(1 / fator).toFixed(4)} ${unid}`
              return (
                <div className="pb-2">
                  <p className="text-xs text-gray-400 mb-1">Preview</p>
                  <p className="text-sm font-mono text-gray-700">{resultado}</p>
                  <p className="text-xs text-gray-400">por unidade da NF</p>
                </div>
              )
            })()}
          </div>

          {/* CEST | GTIN | Est. Mínimo | Custo Unitário | Preço de Venda */}
          <div className="grid grid-cols-[110px_200px_120px_150px_150px] gap-3">
            <FormField label="CEST">
              <Input {...register('cest')} placeholder="1700100" maxLength={7} />
            </FormField>
            <FormField label="GTIN / EAN">
              <Input {...register('gtin')} placeholder="SEM GTIN" maxLength={14} />
            </FormField>
            <FormField label="Est. Mínimo" error={errors.estoqueMinimo?.message}>
              <Input {...register('estoqueMinimo')} type="number" step="0.001" min="0" placeholder="0" />
            </FormField>
            <FormField
              label="Custo Unitário"
              error={errors.custoUnitario?.message}
              hint={temBom ? 'Pelo BOM' : undefined}
            >
              <Controller control={control} name="custoUnitario" render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} decimals={4} error={!!errors.custoUnitario} disabled={temBom} />
              )} />
            </FormField>
            <FormField label="Preço de Venda" error={errors.precoVenda?.message}>
              <Controller control={control} name="precoVenda" render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={!!errors.precoVenda} />
              )} />
            </FormField>
          </div>
        </>
      )}

      {aba === 'bom' && (
        <BomTab produtoId={initialData?.id} />
      )}

      {aba === 'custos' && (
        <CustosTab produtoId={initialData?.id} />
      )}

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {(mutation.error as Error)?.message || 'Erro ao salvar produto. Tente novamente.'}
        </p>
      )}

      {aba !== 'bom' && aba !== 'custos' && (
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" loading={mutation.isPending}>
            {isEditing ? 'Salvar Alterações' : 'Salvar Produto'}
          </Button>
        </div>
      )}
    </Form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProdutosPage() {
  const queryClient = useQueryClient()
  const [filtroTipo, setFiltroTipo] = useState('')
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Produto | null>(null)

  const { data: produtos = [], isLoading } = useQuery<Produto[]>({
    queryKey: ['produtos', filtroTipo, busca, mostrarInativos],
    queryFn: () => api.get('/produtos', {
      params: {
        tipo: filtroTipo || undefined,
        busca: busca || undefined,
        mostrarInativos: mostrarInativos || undefined,
      },
    }).then(r => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/produtos/${id}/toggle-ativo`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      setConfirmToggle(null)
    },
  })

  const alertas = produtos.filter(
    p => (p.tipo === 'INSUMO' || p.tipo === 'INSUMO_PRODUTO')
      && p.ativo
      && Number(p.estoqueAtual) <= Number(p.estoqueMinimo),
  )

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
              {editando ? `Editar — ${editando.nome}` : 'Novo Produto / Insumo'}
            </h2>
            <p className="text-xs text-gray-400">Produtos & Insumos</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <ProdutoForm
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
          <h2 className="text-2xl font-bold text-gray-900">Produtos & Insumos</h2>
          <p className="text-gray-500 text-sm">{produtos.length} item(s)</p>
        </div>
        <button
          onClick={() => { setEditando(null); setPanelOpen(true) }}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Novo Item
        </button>
      </div>

      {/* Alerta de estoque baixo */}
      {alertas.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="shrink-0 text-amber-500" />
          <span>
            <strong>{alertas.length} insumo(s)</strong> com estoque abaixo do mínimo:{' '}
            {alertas.map(a => a.nome).join(', ')}
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos os tipos</option>
          <option value="INSUMO">Apenas Insumos</option>
          <option value="PRODUTO_ACABADO">Apenas Produtos</option>
          <option value="INSUMO_PRODUTO">Insumo + Produto</option>
        </select>

        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[200px]"
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
        ) : produtos.length === 0 ? (
          <div className="p-12 text-center">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3 text-right">Estoque Atual</th>
                <th className="px-4 py-3 text-right">Custo Unit.</th>
                <th className="px-4 py-3 text-right">Preço Venda</th>
                <th className="px-4 py-3 text-center">NCM</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {produtos.map(p => {
                const estoqueAlerta = (p.tipo === 'INSUMO' || p.tipo === 'INSUMO_PRODUTO')
                  && Number(p.estoqueAtual) <= Number(p.estoqueMinimo)

                return (
                  <tr key={p.id}
                    onClick={() => { setEditando(p); setPanelOpen(true) }}
                    className={clsx(
                      'hover:bg-gray-50 cursor-pointer transition',
                      !p.ativo && 'opacity-50',
                    )}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.codigo}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.nome}
                      {!p.ativo && <span className="ml-2 text-xs text-red-400 font-normal">inativo</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', tipoCor[p.tipo])}>
                        {tipoLabel[p.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.categoria?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.unidadeMedida}</td>
                    <td className={clsx(
                      'px-4 py-3 text-right font-semibold',
                      estoqueAlerta ? 'text-amber-600' : 'text-gray-700',
                    )}>
                      {(p.tipo === 'INSUMO' || p.tipo === 'INSUMO_PRODUTO')
                        ? Number(p.estoqueAtual).toFixed(3)
                        : '—'}
                      {estoqueAlerta && <AlertTriangle size={12} className="inline ml-1 text-amber-500" />}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {(p.tipo === 'INSUMO' || p.tipo === 'INSUMO_PRODUTO')
                        ? `R$ ${Number(p.custoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {p.precoVenda ? `R$ ${Number(p.precoVenda).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.ncm
                        ? <span className="font-mono text-xs text-green-700">{p.ncm}</span>
                        : <span className="text-xs text-red-400">faltando</span>}
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
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.ativo ? 'Desativar Item' : 'Reativar Item'}
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
