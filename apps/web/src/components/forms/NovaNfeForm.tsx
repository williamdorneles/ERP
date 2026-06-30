import { useEffect, useRef, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Plus, Trash2, AlertTriangle, CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import { api } from '../../lib/api'
import { FormField, Input, Select, Textarea, CurrencyInput } from '../ui/FormField'
import { BuscaInput } from '../ui/BuscaInput'
import { Button } from '../ui/Button'
import { Form } from '../ui/Form'

const itemSchema = z.object({
  produtoId: z.string(),
  quantidade: z.coerce.number(),
  precoUnitario: z.coerce.number(),
  desconto: z.coerce.number().min(0),
})

const schema = z.object({
  naturezaOperacaoId: z.string().min(1, 'Selecione a natureza da operação'),
  finNFe: z.coerce.number().int().min(1).max(4),
  indPres: z.coerce.number().int().min(0).max(9),
  pessoaId: z.string().optional(),
  formaPagamento: z.enum(['DINHEIRO', 'CREDITO', 'DEBITO', 'PIX', 'PRAZO']),
  dataEmissao: z.string().min(1, 'Informe a data'),
  previsaoEntrega: z.string().optional(),
  validadeProposta: z.string().optional(),
  pedidoCliente: z.string().optional(),
  vendedorId: z.string().optional(),
  entregaDiferente: z.boolean(),
  entregaCep: z.string().optional(),
  entregaLogradouro: z.string().optional(),
  entregaNumero: z.string().optional(),
  entregaComplemento: z.string().optional(),
  entregaBairro: z.string().optional(),
  entregaMunicipio: z.string().optional(),
  entregaUf: z.string().optional(),
  entregaCodigoIBGE: z.string().optional(),
  desconto: z.coerce.number().min(0),
  vFrete: z.coerce.number().min(0),
  vSeguro: z.coerce.number().min(0),
  vOutros: z.coerce.number().min(0),
  modalidadeFrete: z.coerce.number().int().min(0).max(9),
  transportadora: z.string().optional(),
  transportadoraDoc: z.string().optional(),
  veiculoPlaca: z.string().optional(),
  veiculoUf: z.string().optional(),
  volumesQtde: z.coerce.number().min(0).optional(),
  volumesEspecie: z.string().optional(),
  pesoBruto: z.coerce.number().min(0).optional(),
  pesoLiquido: z.coerce.number().min(0).optional(),
  observacao: z.string().optional(),
  itens: z.array(itemSchema),
}).superRefine((d, ctx) => {
  const preenchidos = d.itens.filter(i => i.produtoId)
  if (preenchidos.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Adicione ao menos 1 item', path: ['itens'] })
  }
  d.itens.forEach((i, idx) => {
    if (!i.produtoId) return
    if (!(Number(i.quantidade) > 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Deve ser maior que 0', path: ['itens', idx, 'quantidade'] })
    if (!(Number(i.precoUnitario) > 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Deve ser maior que 0', path: ['itens', idx, 'precoUnitario'] })
  })
})

type FormData = z.infer<typeof schema>
interface ParcelaForm { numero: string; vencimento: string; valor: number; meioPagamento: string }
interface Produto {
  id: string; nome: string; precoVenda: number; codigo?: string | null
  ncm?: string | null; unidadeComercial?: string | null; unidadeMedida?: string | null
}
interface Pessoa {
  id: string; nome: string; nomeFantasia?: string | null
  documento?: string | null; ie?: string | null; indicadorIE?: number
  email?: string | null; telefone?: string | null
  cep?: string | null; logradouro?: string | null; numero?: string | null; complemento?: string | null
  bairro?: string | null; municipio?: string | null; uf?: string | null; codigoIBGE?: string | null
}
interface Vendedor { id: string; nome: string; documento?: string | null }
interface Natureza {
  id: string; descricao: string; padraoVenda: boolean
  cfop?: string | null; csosn?: string | null; cstIcms?: string | null; aliquotaIcms?: number | null
  cstPis?: string | null; aliquotaPis?: number | null
  cstCofins?: string | null; aliquotaCofins?: number | null
  cstIpi?: string | null; aliquotaIpi?: number | null
}
interface Props { onClose: () => void; onSuccess: (notaId: string) => void }

const fmt = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const today = () => new Date().toISOString().split('T')[0]
const fmtDate = (s: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const meioPorForma: Record<string, string> = {
  DINHEIRO: 'Dinheiro', CREDITO: 'Cartão de Crédito', DEBITO: 'Cartão de Débito', PIX: 'PIX', PRAZO: 'Boleto',
}
const meiosPagamento = ['Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'PIX', 'Boleto', 'Cheque', 'Outros']
const formaPagNFe: Record<string, string> = {
  DINHEIRO: '01', CREDITO: '03', DEBITO: '04', PIX: '17', PRAZO: '15',
}
const fmtDoc = (d?: string | null) => {
  const s = (d ?? '').replace(/\D/g, '')
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return d ?? ''
}
const fmtCep = (c?: string | null) => {
  const s = (c ?? '').replace(/\D/g, '')
  return s.length === 8 ? s.replace(/(\d{5})(\d{3})/, '$1-$2') : (c ?? '')
}
const indIELabel: Record<number, string> = { 1: 'Contribuinte ICMS', 2: 'Isento de IE', 9: 'Não contribuinte' }

function diasDaCondicao(str: string): number[] {
  const tokens = str.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const dias: number[] = []
  let last = 0
  for (const t of tokens) {
    if (/^\+?\d+x$/.test(t)) {
      const n = parseInt(t.replace('+', ''))
      for (let i = 1; i <= n; i++) dias.push(last + i * 30)
      last = dias[dias.length - 1]
    } else if (/^\d+$/.test(t)) {
      dias.push(parseInt(t)); last = parseInt(t)
    }
  }
  return dias
}

function UltimasVendasPanel({ pessoaId }: { pessoaId: string }) {
  const { data = [], isLoading } = useQuery<{ id: string; numero: string; total: number | string; status: string; criadoEm: string }[]>({
    queryKey: ['cliente-ultimas-vendas', pessoaId],
    queryFn: () => api.get('/vendas/pedidos', { params: { pessoaId, limite: 5 } }).then(r => r.data),
  })
  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Últimas vendas</p>
      {isLoading ? <p className="text-gray-400">Carregando…</p>
        : data.length === 0 ? <p className="text-gray-400">Nenhuma venda anterior para este cliente.</p>
        : (
          <ul className="divide-y divide-gray-200/70">
            {data.map(p => (
              <li key={p.id} className="flex justify-between py-1">
                <span className="text-gray-600">{p.numero} · {new Date(p.criadoEm).toLocaleDateString('pt-BR')}
                  <span className="ml-2 text-gray-400">{p.status}</span>
                </span>
                <span className="tabular-nums font-medium text-gray-800">{fmt(Number(p.total))}</span>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}

function CreditoPanel({ pessoaId }: { pessoaId: string }) {
  const { data, isLoading } = useQuery<{ limiteCredito: number; totalAberto: number; disponivel: number }>({
    queryKey: ['cliente-credito', pessoaId],
    queryFn: () => api.get(`/vendas/clientes/${pessoaId}/credito`).then(r => r.data),
  })
  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Limite de crédito</p>
      {isLoading || !data ? <p className="text-gray-400">Carregando…</p>
        : (
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>Limite: <span className="font-medium text-gray-800 tabular-nums">{fmt(data.limiteCredito)}</span></span>
            <span>A receber: <span className="font-medium text-gray-800 tabular-nums">{fmt(data.totalAberto)}</span></span>
            <span>Disponível: <span className={`font-semibold tabular-nums ${data.disponivel < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmt(data.disponivel)}</span></span>
          </div>
        )}
    </div>
  )
}

export function NovaNfeForm({ onClose, onSuccess }: Props) {
  const [clienteSel, setClienteSel] = useState<Pessoa | null>(null)
  const [produtosSel, setProdutosSel] = useState<Record<string, Produto>>({})
  const [clientePanel, setClientePanel] = useState<'dados' | 'vendas' | 'credito' | null>(null)
  const [itemTab, setItemTab] = useState<'itens' | 'impostos'>('itens')
  const [parcelas, setParcelas] = useState<ParcelaForm[]>([
    { numero: '001', vencimento: today(), valor: 0, meioPagamento: 'Dinheiro' },
  ])
  const [condicao, setCondicao] = useState('')

  const { data: naturezas = [] } = useQuery<Natureza[]>({
    queryKey: ['naturezas-venda'],
    queryFn: () => api.get('/naturezas-operacao', { params: { tipo: 'SAIDA', ativo: true } }).then(r => r.data),
  })

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      naturezaOperacaoId: '',
      finNFe: 1,
      indPres: 1,
      formaPagamento: 'DINHEIRO',
      dataEmissao: today(),
      previsaoEntrega: '',
      validadeProposta: '',
      pedidoCliente: '',
      vendedorId: '',
      entregaDiferente: false,
      entregaCep: '', entregaLogradouro: '', entregaNumero: '', entregaComplemento: '',
      entregaBairro: '', entregaMunicipio: '', entregaUf: '', entregaCodigoIBGE: '',
      desconto: 0, vFrete: 0, vSeguro: 0, vOutros: 0,
      modalidadeFrete: 9,
      transportadora: '', transportadoraDoc: '', veiculoPlaca: '', veiculoUf: '',
      volumesQtde: 0, volumesEspecie: '', pesoBruto: 0, pesoLiquido: 0,
      itens: [{ produtoId: '', quantidade: 1, precoUnitario: 0, desconto: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })
  const itensRef = useRef<HTMLDivElement>(null)

  function adicionarItem() {
    append({ produtoId: '', quantidade: 1, precoUnitario: 0, desconto: 0 })
    setTimeout(() => {
      const inputs = itensRef.current?.querySelectorAll<HTMLInputElement>('[data-produto-cell] input')
      inputs?.[inputs.length - 1]?.focus()
    }, 0)
  }

  const watchItens = watch('itens')
  const watchDesconto = watch('desconto') ?? 0
  const watchFrete = watch('vFrete') ?? 0
  const watchSeguro = watch('vSeguro') ?? 0
  const watchOutros = watch('vOutros') ?? 0
  const watchNaturezaId = watch('naturezaOperacaoId')
  const watchForma = watch('formaPagamento')

  useEffect(() => {
    if (naturezas.length === 0 || watchNaturezaId) return
    const padrao = naturezas.find(n => n.padraoVenda) ?? naturezas[0]
    if (padrao) setValue('naturezaOperacaoId', padrao.id)
  }, [naturezas, watchNaturezaId, setValue])

  const subtotal = watchItens?.reduce((acc, item) =>
    acc + Number(item.quantidade) * Number(item.precoUnitario), 0) ?? 0
  const descontoItens = watchItens?.reduce((acc, item) => acc + Number(item.desconto ?? 0), 0) ?? 0
  const total = subtotal - descontoItens - Number(watchDesconto)
    + Number(watchFrete) + Number(watchSeguro) + Number(watchOutros)
  const totalFinal = Math.max(total, 0)
  const numItens = (watchItens ?? []).filter(i => i.produtoId).length
  const somaQtdes = (watchItens ?? []).filter(i => i.produtoId).reduce((a, i) => a + Number(i.quantidade || 0), 0)

  const naturezaSel = naturezas.find(n => n.id === watchNaturezaId)
  const baseImpostos = Math.max(subtotal - descontoItens - Number(watchDesconto), 0)
  const pct = (a?: number | null) => Number(a ?? 0) / 100
  const imp = {
    vICMS: baseImpostos * pct(naturezaSel?.aliquotaIcms),
    vPIS: baseImpostos * pct(naturezaSel?.aliquotaPis),
    vCOFINS: baseImpostos * pct(naturezaSel?.aliquotaCofins),
    vIPI: baseImpostos * pct(naturezaSel?.aliquotaIpi),
  }

  const totalParcelas = parcelas.reduce((s, p) => s + Number(p.valor || 0), 0)
  const parcelasBatem = Math.abs(totalParcelas - totalFinal) <= 0.02

  useEffect(() => {
    setParcelas(current => {
      if (current.length !== 1) return current
      if (current[0].valor === 0 || Math.abs(current.reduce((s, p) => s + Number(p.valor || 0), 0) - totalFinal) > 0.02) {
        return [{ ...current[0], valor: Number(totalFinal.toFixed(2)) }]
      }
      return current
    })
  }, [totalFinal])

  function gerarParcelas() {
    const dias = diasDaCondicao(condicao)
    if (dias.length === 0) return
    const valorBase = Number((totalFinal / dias.length).toFixed(2))
    const resto = Number((totalFinal - valorBase * dias.length).toFixed(2))
    const meio = meioPorForma[watchForma] ?? 'Dinheiro'
    const base = new Date(today() + 'T12:00:00')
    setParcelas(dias.map((d, i) => {
      const dt = new Date(base); dt.setDate(dt.getDate() + d)
      return {
        numero: String(i + 1).padStart(3, '0'),
        vencimento: dt.toISOString().split('T')[0],
        valor: i === 0 ? Number((valorBase + resto).toFixed(2)) : valorBase,
        meioPagamento: meio,
      }
    }))
  }
  function setParcela<K extends keyof ParcelaForm>(idx: number, campo: K, valor: ParcelaForm[K]) {
    setParcelas(prev => prev.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)))
  }

  // Prontidão para emissão
  const pendencias: string[] = []
  if (!clienteSel) {
    pendencias.push('NF-e exige destinatário identificado — selecione um cliente (NFC-e a consumidor final dispensa).')
  } else {
    if (!clienteSel.documento) pendencias.push('Cliente sem CPF/CNPJ cadastrado.')
    if (!clienteSel.logradouro || !clienteSel.municipio || !clienteSel.uf)
      pendencias.push('Cliente sem endereço completo (logradouro, município e UF).')
  }
  const itensSemFiscal = (watchItens ?? [])
    .map(it => { const p = it.produtoId ? produtosSel[it.produtoId] : undefined; return p && !p.ncm ? `${p.nome}: falta NCM` : null })
    .filter((x): x is string => x !== null)
  const prontoParaNFe = pendencias.length === 0 && itensSemFiscal.length === 0

  const cepEntregaReg = register('entregaCep')
  const watchEntregaDif = watch('entregaDiferente')

  const enderecoCliente = clienteSel ? [
    clienteSel.logradouro ? `${clienteSel.logradouro}${clienteSel.numero ? `, ${clienteSel.numero}` : ''}` : null,
    clienteSel.bairro || null,
    clienteSel.municipio && clienteSel.uf ? `${clienteSel.municipio}/${clienteSel.uf}` : (clienteSel.municipio || null),
    clienteSel.cep ? `CEP ${fmtCep(clienteSel.cep)}` : null,
  ].filter(Boolean).join(' — ') : ''

  async function buscarCepEntrega(cep: string) {
    const d = cep.replace(/\D/g, '')
    if (d.length !== 8) return
    try {
      const { data: e } = await api.get(`/lookup/cep/${d}`)
      if (e.logradouro) setValue('entregaLogradouro', e.logradouro)
      if (e.bairro) setValue('entregaBairro', e.bairro)
      if (e.municipio) setValue('entregaMunicipio', e.municipio)
      if (e.uf) setValue('entregaUf', e.uf)
      if (e.codigoIBGE) setValue('entregaCodigoIBGE', e.codigoIBGE)
    } catch { /* CEP não encontrado */ }
  }

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const natureza = naturezas.find(n => n.id === data.naturezaOperacaoId)
      const clean = (s?: string) => (s && s.trim() ? s.trim() : undefined)
      const entrega = data.entregaDiferente

      const payload = {
        naturezaOperacao: natureza?.descricao ?? '',
        finNFe: Number(data.finNFe),
        destNome: clienteSel?.nome ?? '',
        destCpfCnpj: clienteSel?.documento?.replace(/\D/g, '') || undefined,
        destIndicadorIE: clienteSel?.indicadorIE ?? 9,
        destIE: clienteSel?.ie || undefined,
        destCep: entrega ? clean(data.entregaCep)?.replace(/\D/g, '') : (clienteSel?.cep?.replace(/\D/g, '') || undefined),
        destLogradouro: entrega ? clean(data.entregaLogradouro) : (clienteSel?.logradouro || undefined),
        destNumero: entrega ? clean(data.entregaNumero) : (clienteSel?.numero || undefined),
        destBairro: entrega ? clean(data.entregaBairro) : (clienteSel?.bairro || undefined),
        destMunicipio: entrega ? clean(data.entregaMunicipio) : (clienteSel?.municipio || undefined),
        destUf: entrega ? clean(data.entregaUf)?.toUpperCase() : (clienteSel?.uf || undefined),
        destCodigoIBGE: entrega ? clean(data.entregaCodigoIBGE) : (clienteSel?.codigoIBGE || undefined),
        formaPagamento: formaPagNFe[data.formaPagamento] ?? '01',
        vDesconto: Number(data.desconto),
        vFrete: Number(data.vFrete),
        infCpl: clean(data.observacao),
        itens: data.itens.filter(i => i.produtoId).map((i, idx) => {
          const prod = produtosSel[i.produtoId]
          const vProd = Math.max(Number(i.quantidade) * Number(i.precoUnitario) - Number(i.desconto), 0)
          return {
            nItem: idx + 1,
            cProd: prod?.codigo || String(idx + 1).padStart(3, '0'),
            xProd: prod?.nome ?? '',
            ncm: prod?.ncm ?? '',
            cfop: natureza?.cfop ?? '5102',
            uCom: prod?.unidadeComercial || prod?.unidadeMedida || 'UN',
            qCom: Number(i.quantidade),
            vUnCom: Number(i.precoUnitario),
            vProd,
            csosn: natureza?.csosn || undefined,
            cstPIS: natureza?.cstPis || undefined,
            cstCOFINS: natureza?.cstCofins || undefined,
            pPIS: Number(natureza?.aliquotaPis ?? 0),
            pCOFINS: Number(natureza?.aliquotaCofins ?? 0),
          }
        }),
      }
      return api.post('/fiscal/nfe', payload).then(r => r.data)
    },
    onSuccess: (data) => onSuccess(data.id),
  })

  const col = { num: 'w-8', sku: 'w-24', un: 'w-14', qtd: 'w-20', preco: 'w-32', desc: 'w-28', total: 'w-28', acao: 'w-8' }

  return (
    <Form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-6">

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <FormField label="Natureza da Operação" error={errors.naturezaOperacaoId?.message} required>
              <Select {...register('naturezaOperacaoId')}>
                <option value="">— selecione —</option>
                {naturezas.map(n => <option key={n.id} value={n.id}>{n.descricao}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Número" hint="Gerado automaticamente ao salvar">
            <Input value="Automático" disabled readOnly className="text-gray-400" />
          </FormField>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <FormField label="Cliente / Destinatário" error={errors.pessoaId?.message}
              hint="Digite o nome, CPF/CNPJ ou e-mail. Em branco = consumidor final (só NFC-e)">
              <BuscaInput<Pessoa>
                value={watch('pessoaId') ?? ''}
                endpoint="/pessoas"
                params={{ tipo: 'CLIENTE' }}
                queryKeyBase="clientes-busca"
                getId={p => p.id}
                getLabel={p => p.nome}
                getSub={p => p.documento ?? ''}
                placeholder="Pesquise pelas iniciais do nome, pelo CPF/CNPJ ou pelo e-mail"
                onSelect={p => { setValue('pessoaId', p?.id ?? ''); setClienteSel(p) }}
              />
            </FormField>
          </div>
          <FormField label="Vendedor">
            <BuscaInput<Vendedor>
              value={watch('vendedorId') ?? ''}
              endpoint="/vendedores"
              params={{ ativo: 'true' }}
              queryKeyBase="vendedores-busca"
              getId={v => v.id}
              getLabel={v => v.nome}
              getSub={v => v.documento ?? ''}
              placeholder="Nome do vendedor"
              onSelect={v => setValue('vendedorId', v?.id ?? '')}
            />
          </FormField>
        </div>

        {clienteSel && (
          <div className="-mt-1">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {(['dados', 'vendas', 'credito'] as const).map(k => (
                <button key={k} type="button" tabIndex={-1}
                  onClick={() => setClientePanel(p => (p === k ? null : k))}
                  className={`hover:underline ${clientePanel === k ? 'text-primary-700 font-medium' : 'text-primary-600'}`}>
                  {k === 'dados' ? 'dados do cliente' : k === 'vendas' ? 'últimas vendas' : 'limite de crédito'}
                </button>
              ))}
            </div>
            {clientePanel === 'dados' && (
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs space-y-1">
                <p className="text-sm font-semibold text-gray-800">
                  {clienteSel.nome}
                  {clienteSel.nomeFantasia ? <span className="font-normal text-gray-500"> · {clienteSel.nomeFantasia}</span> : null}
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-gray-600">
                  {clienteSel.documento && <span>Doc: <span className="font-mono">{fmtDoc(clienteSel.documento)}</span></span>}
                  {clienteSel.ie && <span>IE: <span className="font-mono">{clienteSel.ie}</span></span>}
                  <span>{indIELabel[clienteSel.indicadorIE ?? 9] ?? '—'}</span>
                  {clienteSel.telefone && <span>Tel: {clienteSel.telefone}</span>}
                  {clienteSel.email && <span>{clienteSel.email}</span>}
                </div>
                <p className={enderecoCliente ? 'text-gray-500' : 'text-amber-600'}>
                  {enderecoCliente || 'Sem endereço cadastrado — necessário para NF-e.'}
                </p>
              </div>
            )}
            {clientePanel === 'vendas' && <UltimasVendasPanel pessoaId={clienteSel.id} />}
            {clientePanel === 'credito' && <CreditoPanel pessoaId={clienteSel.id} />}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input type="checkbox" {...register('entregaDiferente')}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            Entregar em endereço diferente do cadastro
          </label>
          {watchEntregaDif && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              <FormField label="CEP">
                <Input {...cepEntregaReg} onBlur={e => { cepEntregaReg.onBlur(e); buscarCepEntrega(e.target.value) }} placeholder="00000-000" />
              </FormField>
              <div className="lg:col-span-2">
                <FormField label="Logradouro">
                  <Input {...register('entregaLogradouro')} placeholder="Rua, avenida..." />
                </FormField>
              </div>
              <FormField label="Número">
                <Input {...register('entregaNumero')} placeholder="Nº" />
              </FormField>
              <FormField label="Bairro"><Input {...register('entregaBairro')} /></FormField>
              <div className="lg:col-span-2">
                <FormField label="Complemento">
                  <Input {...register('entregaComplemento')} placeholder="Bloco, sala, referência..." />
                </FormField>
              </div>
              <FormField label="Município"><Input {...register('entregaMunicipio')} /></FormField>
              <FormField label="UF">
                <Input {...register('entregaUf')} maxLength={2} className="uppercase" placeholder="UF" />
              </FormField>
            </div>
          )}
        </div>
      </section>

      {/* ── Itens / Impostos ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-4 border-b border-gray-200 mb-3">
          <button type="button" tabIndex={-1} onClick={() => setItemTab('itens')}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition ${itemTab === 'itens' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Itens de produtos ou serviços
          </button>
          <button type="button" tabIndex={-1} onClick={() => setItemTab('impostos')}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition ${itemTab === 'impostos' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Impostos
          </button>
          {errors.itens?.root && <p className="ml-auto text-xs text-red-500">{errors.itens.root.message}</p>}
        </div>

        {itemTab === 'itens' && (
          <div className="border rounded-xl">
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50 text-xs font-medium text-gray-500">
              <div className={`${col.num} text-center`}>Nº</div>
              <div className="flex-1">Descrição</div>
              <div className={col.sku}>Código (SKU)</div>
              <div className={`${col.qtd} text-center`}>Qtde</div>
              <div className={`${col.un} text-center`}>UN</div>
              <div className={`${col.preco} text-right`}>Preço un</div>
              <div className={`${col.desc} text-right`}>Desconto</div>
              <div className={`${col.total} text-right`}>Total</div>
              <div className={col.acao} />
            </div>
            <div className="divide-y" ref={itensRef}>
              {fields.map((field, index) => {
                const item = watchItens?.[index]
                const subtotalLinha = (Number(item?.quantidade ?? 0) * Number(item?.precoUnitario ?? 0)) - Number(item?.desconto ?? 0)
                const prod = item?.produtoId ? produtosSel[item.produtoId] : undefined
                return (
                  <div key={field.id} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className={`${col.num} text-center text-xs text-gray-400 tabular-nums`}>{index + 1}</div>
                      <div className="flex-1" data-produto-cell>
                        <BuscaInput<Produto>
                          value={item?.produtoId ?? ''}
                          endpoint="/produtos"
                          params={{ tipo: 'PRODUTO_ACABADO' }}
                          queryKeyBase="produtos-venda-busca"
                          getId={p => p.id}
                          getLabel={p => p.nome}
                          getSub={p => p.ncm ? `NCM ${p.ncm}` : 'sem NCM'}
                          placeholder="Pesquise por descrição, código (SKU) ou GTIN..."
                          error={!!errors.itens?.[index]?.produtoId}
                          onSelect={p => {
                            setValue(`itens.${index}.produtoId`, p?.id ?? '', { shouldValidate: true })
                            if (p) {
                              setProdutosSel(m => ({ ...m, [p.id]: p }))
                              setValue(`itens.${index}.precoUnitario`, Number(p.precoVenda) || 0)
                            }
                          }}
                        />
                      </div>
                      <div className={`${col.sku} text-xs text-gray-500 font-mono truncate`}>{prod?.codigo ?? '—'}</div>
                      <div className={col.qtd}>
                        <Input {...register(`itens.${index}.quantidade`)} type="number" step="0.001" min="0.001"
                          placeholder="1" className="text-center" error={!!errors.itens?.[index]?.quantidade} />
                      </div>
                      <div className={`${col.un} text-center text-xs text-gray-500 tabular-nums`}>
                        {prod?.unidadeComercial || prod?.unidadeMedida || '—'}
                      </div>
                      <div className={col.preco}>
                        <Controller control={control} name={`itens.${index}.precoUnitario`} render={({ field }) => (
                          <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                            error={!!errors.itens?.[index]?.precoUnitario} />
                        )} />
                      </div>
                      <div className={col.desc}>
                        <Controller control={control} name={`itens.${index}.desconto`} render={({ field }) => (
                          <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarItem() } }} />
                        )} />
                      </div>
                      <div className={`${col.total} text-right text-xs font-semibold text-gray-700 tabular-nums`}>
                        {subtotalLinha > 0 ? fmt(subtotalLinha) : '—'}
                      </div>
                      <button type="button" onClick={() => remove(index)} disabled={fields.length === 1} tabIndex={-1}
                        className={`${col.acao} flex items-center justify-center text-gray-400 hover:text-red-500 disabled:opacity-30`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {prod && !prod.ncm && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
                        <AlertTriangle size={12} /> Produto sem NCM — necessário para emissão fiscal.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            <button type="button" onClick={adicionarItem}
              className="w-full flex items-center justify-center gap-2 py-2 border-t text-sm text-primary-600 hover:bg-primary-50 transition rounded-b-xl">
              <Plus size={15} /> Adicionar Item
            </button>
          </div>
        )}

        {itemTab === 'impostos' && (
          <div className="border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50 text-xs font-medium text-gray-500">
              <div className="w-8 text-center">Nº</div>
              <div className="flex-1">Descrição</div>
              <div className="w-24">NCM</div>
              <div className="w-16 text-center">CFOP</div>
              <div className="w-16 text-center">CST</div>
              <div className="w-24 text-right">Vlr Produto</div>
              <div className="w-24 text-right">ICMS</div>
              <div className="w-24 text-right">PIS</div>
              <div className="w-24 text-right">COFINS</div>
            </div>
            <div className="divide-y">
              {(watchItens ?? []).filter(it => it.produtoId).map((it, i) => {
                const prod = it.produtoId ? produtosSel[it.produtoId] : undefined
                const vProd = Math.max(Number(it.quantidade || 0) * Number(it.precoUnitario || 0) - Number(it.desconto || 0), 0)
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <div className="w-8 text-center text-gray-400 tabular-nums">{i + 1}</div>
                    <div className="flex-1 truncate text-gray-700">{prod?.nome ?? <span className="text-gray-300">—</span>}</div>
                    <div className="w-24 font-mono text-gray-500">{prod?.ncm ?? '—'}</div>
                    <div className="w-16 text-center text-gray-500">{naturezaSel?.cfop ?? '—'}</div>
                    <div className="w-16 text-center text-gray-500">{naturezaSel?.csosn ?? naturezaSel?.cstIcms ?? '—'}</div>
                    <div className="w-24 text-right tabular-nums text-gray-700">{fmt(vProd)}</div>
                    <div className="w-24 text-right tabular-nums text-gray-600">{fmt(vProd * pct(naturezaSel?.aliquotaIcms))}</div>
                    <div className="w-24 text-right tabular-nums text-gray-600">{fmt(vProd * pct(naturezaSel?.aliquotaPis))}</div>
                    <div className="w-24 text-right tabular-nums text-gray-600">{fmt(vProd * pct(naturezaSel?.aliquotaCofins))}</div>
                  </div>
                )
              })}
            </div>
            <p className="px-3 py-2 text-[11px] text-gray-400 border-t">
              Impostos estimados pela natureza de operação ({naturezaSel?.descricao ?? '—'}). Cálculo definitivo na emissão da NF-e.
            </p>
          </div>
        )}
      </section>

      {/* ── Transporte ────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Transporte</h3>
        <div className="grid grid-cols-4 gap-3">
          <FormField label="Modalidade do Frete">
            <Select {...register('modalidadeFrete')}>
              <option value={9}>Sem frete</option>
              <option value={0}>Emitente (CIF)</option>
              <option value={1}>Destinatário (FOB)</option>
              <option value={2}>Terceiros</option>
            </Select>
          </FormField>
          <div className="col-span-2">
            <FormField label="Transportadora">
              <Input {...register('transportadora')} placeholder="Nome / razão social" />
            </FormField>
          </div>
          <FormField label="CPF/CNPJ Transp.">
            <Input {...register('transportadoraDoc')} placeholder="Documento" />
          </FormField>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-3">
          <FormField label="Placa"><Input {...register('veiculoPlaca')} placeholder="ABC1D23" /></FormField>
          <FormField label="UF"><Input {...register('veiculoUf')} maxLength={2} placeholder="UF" className="uppercase" /></FormField>
          <FormField label="Volumes (qtd)"><Input {...register('volumesQtde')} type="number" min="0" step="1" placeholder="0" /></FormField>
          <FormField label="Espécie"><Input {...register('volumesEspecie')} placeholder="Caixa, fardo..." /></FormField>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-3">
          <FormField label="Peso Bruto (kg)"><Input {...register('pesoBruto')} type="number" min="0" step="0.001" placeholder="0,000" /></FormField>
          <FormField label="Peso Líquido (kg)"><Input {...register('pesoLiquido')} type="number" min="0" step="0.001" placeholder="0,000" /></FormField>
        </div>
      </section>

      {/* ── Detalhes da NF-e ──────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detalhes da NF-e</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <FormField label="Data de Emissão" error={errors.dataEmissao?.message} required>
            <Input type="date" {...register('dataEmissao')} error={!!errors.dataEmissao} />
          </FormField>
          <FormField label="Previsão de Entrega">
            <Input type="date" {...register('previsaoEntrega')} />
          </FormField>
          <FormField label="Finalidade">
            <Select {...register('finNFe')}>
              <option value={1}>1 — Normal</option>
              <option value={2}>2 — Complementar</option>
              <option value={3}>3 — Ajuste</option>
              <option value={4}>4 — Devolução/Retorno</option>
            </Select>
          </FormField>
          <FormField label="Nº do Pedido do Cliente">
            <Input {...register('pedidoCliente')} placeholder="OC / referência" />
          </FormField>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <FormField label="Desconto Geral">
            <Controller control={control} name="desconto" render={({ field }) => (
              <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )} />
          </FormField>
          <FormField label="Frete (pago pelo cliente)">
            <Controller control={control} name="vFrete" render={({ field }) => (
              <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )} />
          </FormField>
          <FormField label="Seguro">
            <Controller control={control} name="vSeguro" render={({ field }) => (
              <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )} />
          </FormField>
          <FormField label="Outras Despesas">
            <Controller control={control} name="vOutros" render={({ field }) => (
              <CurrencyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )} />
          </FormField>
        </div>
      </section>

      {/* ── Cobrança ──────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Cobrança</h3>
        <div className="flex items-end gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Condição de pagamento</label>
            <Input value={condicao} onChange={e => setCondicao(e.target.value)}
              placeholder="Ex.: à vista, 30 60, 2x, 15 +2x" />
          </div>
          <Button type="button" variant="secondary" onClick={gerarParcelas}>
            <RotateCcw size={14} className="mr-1.5" /> Gerar parcelas
          </Button>
        </div>
        <div className="border rounded-xl">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50 text-xs font-medium text-gray-500">
            <div className="w-10 text-center">Nº</div>
            <div className="w-44">Vencimento</div>
            <div className="w-36 text-right">Valor</div>
            <div className="flex-1">Meio de Pagamento</div>
            <div className="w-8" />
          </div>
          <div className="divide-y">
            {parcelas.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2">
                <div className="w-10 text-center text-xs text-gray-500 tabular-nums">{idx + 1}</div>
                <div className="w-44">
                  <Input type="date" value={p.vencimento} onChange={e => setParcela(idx, 'vencimento', e.target.value)} />
                </div>
                <div className="w-36">
                  <CurrencyInput value={p.valor} onChange={v => setParcela(idx, 'valor', v)} />
                </div>
                <div className="flex-1">
                  <Select value={p.meioPagamento} onChange={e => setParcela(idx, 'meioPagamento', e.target.value)}>
                    {meiosPagamento.map(m => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </div>
                <button type="button" tabIndex={-1}
                  onClick={() => setParcelas(prev => prev.filter((_, i) => i !== idx))}
                  disabled={parcelas.length === 1}
                  className="w-8 flex items-center justify-center text-gray-400 hover:text-red-500 disabled:opacity-30">
                  <XCircle size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50/60">
            <button type="button"
              onClick={() => setParcelas(prev => [...prev, {
                numero: String(prev.length + 1).padStart(3, '0'),
                vencimento: today(), valor: 0, meioPagamento: meioPorForma[watchForma] ?? 'Dinheiro',
              }])}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
              <Plus size={13} /> adicionar parcela
            </button>
            <span className={`text-xs tabular-nums ${parcelasBatem ? 'text-gray-500' : 'text-red-500 font-medium'}`}>
              {fmt(totalParcelas)} {parcelasBatem ? '' : `≠ ${fmt(totalFinal)}`}
            </span>
          </div>
        </div>
        {parcelas.length === 1 && (
          <p className="text-xs text-gray-400 mt-1">Vencimento em {fmtDate(parcelas[0].vencimento)} — {parcelas[0].meioPagamento}.</p>
        )}
      </section>

      {/* ── Totais ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Totais</h3>
          {naturezaSel && (
            <span className="text-xs text-gray-400">
              {naturezaSel.csosn ? `CSOSN ${naturezaSel.csosn}` : naturezaSel.cstIcms ? `CST ${naturezaSel.cstIcms}` : ''}
              {naturezaSel.cfop ? ` · CFOP ${naturezaSel.cfop}` : ''}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Nº de itens', txt: String(numItens) },
            { label: 'Soma das qtdes', txt: somaQtdes.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) },
            { label: 'Total produtos', txt: fmt(subtotal) },
            { label: 'Valor IPI', txt: fmt(imp.vIPI) },
            { label: 'Valor ICMS', txt: fmt(imp.vICMS) },
            { label: 'Valor PIS', txt: fmt(imp.vPIS) },
            { label: 'Valor COFINS', txt: fmt(imp.vCOFINS) },
            { label: 'Total da NF-e', txt: fmt(totalFinal), strong: true },
          ].map(c => (
            <div key={c.label} className={`rounded-lg border px-3 py-2 ${c.strong ? 'border-primary-200 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">{c.label}</p>
              <p className={`text-sm font-semibold tabular-nums ${c.strong ? 'text-primary-700' : 'text-gray-800'}`}>{c.txt}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {(descontoItens + Number(watchDesconto)) > 0 && <>Desconto {fmt(descontoItens + Number(watchDesconto))} · </>}
          {(Number(watchFrete) + Number(watchSeguro) + Number(watchOutros)) > 0 && <>Frete/seguro/outros {fmt(Number(watchFrete) + Number(watchSeguro) + Number(watchOutros))} · </>}
          Impostos calculados pela natureza sobre {fmt(baseImpostos)} — confirmação na emissão.
        </p>
      </section>

      {/* ── Prontidão para emissão ────────────────────────────────────── */}
      <div className={prontoParaNFe
        ? 'rounded-xl border border-green-200 bg-green-50 px-4 py-3'
        : 'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3'}>
        {prontoParaNFe ? (
          <p className="flex items-center gap-2 text-sm font-medium text-green-700">
            <CheckCircle2 size={16} /> Pronto para emissão fiscal (NF-e ou NFC-e).
          </p>
        ) : (
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-700">
              <AlertTriangle size={16} /> Pendências para emissão fiscal:
            </p>
            <ul className="ml-6 list-disc text-xs text-amber-700 space-y-0.5">
              {pendencias.map((p, i) => <li key={`p${i}`}>{p}</li>)}
              {itensSemFiscal.map((p, i) => <li key={`i${i}`}>{p}</li>)}
            </ul>
            <p className="ml-6 text-[11px] text-amber-600/80">O rascunho pode ser salvo; a transmissão fica bloqueada até resolver.</p>
          </div>
        )}
      </div>

      <FormField label="Observação / Informações Complementares (infCpl)" error={errors.observacao?.message}>
        <Textarea {...register('observacao')} placeholder="Informações complementares (aparecem no DANFE)..." />
      </FormField>

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao criar NF-e. Verifique os dados e tente novamente.'}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={mutation.isPending}>
          Criar NF-e Pendente — {fmt(totalFinal)}
        </Button>
      </div>
    </Form>
  )
}
