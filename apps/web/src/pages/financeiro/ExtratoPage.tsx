import { useState, useEffect, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, SlidersHorizontal, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '../../lib/api'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { Form } from '../../components/ui/Form'
import clsx from 'clsx'

interface ContaFinanceira { id: string; codigo: string; nome: string }
interface Lancamento {
  id: string; data: string; descricao: string | null; nomeOriginal: string | null
  tipo: 'DEBITO' | 'CREDITO'; valor: number; status: string
  fonteClassificacao: string | null
  contaFinanceira: { id: string; codigo: string; nome: string } | null
}
interface ExtratoResponse {
  conta: { id: string; nome: string; isCaixa: boolean; saldoInicial: number; saldoAntes: number }
  lancamentos: Lancamento[]
  total: number; pagina: number; limite: number; paginas: number
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

// ─── Modal Lançamento Manual ──────────────────────────────────────────────────

function ModalLancamento({
  contaBancariaId,
  contasFinanceiras,
  onClose,
  onSuccess,
}: {
  contaBancariaId: string
  contasFinanceiras: ContaFinanceira[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [tipo, setTipo] = useState<'DEBITO' | 'CREDITO'>('DEBITO')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [descricao, setDescricao] = useState('')
  const [contaFinanceiraId, setContaFinanceiraId] = useState('')
  const [erro, setErro] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post(`/financeiro/contas-bancarias/${contaBancariaId}/lancamento`, {
      tipo, valor: Number(valor), data, descricao, contaFinanceiraId: contaFinanceiraId || undefined,
    }),
    onSuccess,
    onError: () => setErro('Erro ao salvar lançamento. Verifique os dados.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!valor || Number(valor) <= 0) { setErro('Valor deve ser maior que zero.'); return }
    if (!descricao.trim()) { setErro('Descrição obrigatória.'); return }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Novo Lançamento Manual</h3>

        <Form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            {(['DEBITO', 'CREDITO'] as const).map(t => (
              <button
                key={t} type="button"
                onClick={() => setTipo(t)}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition',
                  tipo === t
                    ? t === 'DEBITO' ? 'bg-red-50 border-red-400 text-red-700' : 'bg-green-50 border-green-400 text-green-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400',
                )}
              >
                {t === 'DEBITO' ? <TrendingDown size={15} /> : <TrendingUp size={15} />}
                {t === 'DEBITO' ? 'Saída (Débito)' : 'Entrada (Crédito)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Valor (R$)" required>
              <Input type="number" step="0.01" min="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
            </FormField>
            <FormField label="Data" required>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} />
            </FormField>
          </div>

          <FormField label="Descrição" required>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Pagamento fornecedor, Venda balcão..." />
          </FormField>

          <FormField label="Conta do Plano (opcional)">
            <Select value={contaFinanceiraId} onChange={e => setContaFinanceiraId(e.target.value)}>
              <option value="">Sem classificação</option>
              {contasFinanceiras.map(c => (
                <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
              ))}
            </Select>
          </FormField>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={mutation.isPending}>Lançar</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

// ─── Modal Ajuste de Saldo ────────────────────────────────────────────────────

function ModalAjuste({
  contaBancariaId,
  saldoAtual,
  onClose,
  onSuccess,
}: {
  contaBancariaId: string
  saldoAtual: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [saldoDesejado, setSaldoDesejado] = useState(String(saldoAtual.toFixed(2)))
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [descricao, setDescricao] = useState('Ajuste de saldo')
  const [erro, setErro] = useState('')

  const diferenca = Number(saldoDesejado) - saldoAtual

  const mutation = useMutation({
    mutationFn: () => api.post(`/financeiro/contas-bancarias/${contaBancariaId}/ajuste-saldo`, {
      saldoDesejado: Number(saldoDesejado), data, descricao,
    }),
    onSuccess,
    onError: (err: { response?: { data?: { error?: string } } }) => setErro(err.response?.data?.error ?? 'Erro ao ajustar saldo.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Ajuste de Saldo</h3>
        <p className="text-sm text-gray-500">Saldo atual: <strong>{fmt(saldoAtual)}</strong></p>

        <Form onSubmit={e => { e.preventDefault(); setErro(''); mutation.mutate() }} className="space-y-4">
          <FormField label="Saldo correto (R$)" required>
            <Input type="number" step="0.01" value={saldoDesejado} onChange={e => setSaldoDesejado(e.target.value)} />
          </FormField>

          {saldoDesejado && !isNaN(Number(saldoDesejado)) && Math.abs(diferenca) >= 0.01 && (
            <div className={clsx('px-3 py-2 rounded-lg text-sm', diferenca > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
              {diferenca > 0 ? 'Entrada' : 'Saída'} de <strong>{fmt(Math.abs(diferenca))}</strong> será lançada automaticamente.
            </div>
          )}

          <FormField label="Data do ajuste">
            <Input type="date" value={data} onChange={e => setData(e.target.value)} />
          </FormField>

          <FormField label="Observação">
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} />
          </FormField>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={mutation.isPending}>Ajustar</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

interface ContaBancariaSimples {
  id: string; nome: string; isCaixa: boolean; saldoAtual: number; ativo: boolean
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ExtratoPage() {
  const { id: idParam } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const hoje = new Date().toISOString().slice(0, 10)
  const primeiroDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  // Modo Caixa: sem id na URL — o usuário escolhe a conta
  const modoCaixa = !idParam
  const [contaSelecionadaId, setContaSelecionadaId] = useState<string | undefined>(undefined)
  const id = idParam ?? contaSelecionadaId

  const [dataInicio, setDataInicio] = useState(primeiroDiaMes)
  const [dataFim, setDataFim] = useState(hoje)
  const [pagina, setPagina] = useState(1)
  const [showLancamento, setShowLancamento] = useState(false)
  const [showAjuste, setShowAjuste] = useState(false)

  // Carrega lista de contas apenas no modo Caixa
  const { data: todasContas = [] } = useQuery<ContaBancariaSimples[]>({
    queryKey: ['contas-bancarias'],
    queryFn: () => api.get('/financeiro/contas-bancarias').then(r => r.data),
    enabled: modoCaixa,
  })

  // Seleciona automaticamente a primeira conta (caixas têm prioridade)
  useEffect(() => {
    if (modoCaixa && todasContas.length > 0 && !contaSelecionadaId) {
      const caixa = todasContas.find(c => c.ativo && c.isCaixa)
      const primeira = todasContas.find(c => c.ativo)
      setContaSelecionadaId((caixa ?? primeira)?.id)
    }
  }, [modoCaixa, todasContas, contaSelecionadaId])

  const { data, isLoading } = useQuery<ExtratoResponse>({
    queryKey: ['extrato', id, dataInicio, dataFim, pagina],
    queryFn: () => api.get(`/financeiro/contas-bancarias/${id}/extrato`, {
      params: { dataInicio, dataFim, pagina, limite: 50 },
    }).then(r => r.data),
    enabled: !!id,
  })

  const { data: contasFinanceiras = [] } = useQuery<ContaFinanceira[]>({
    queryKey: ['contas-flat'],
    queryFn: () => api.get('/financeiro/contas').then(r => r.data),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['extrato', id] })
    qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
  }

  const lancamentos = data?.lancamentos ?? []
  let saldoCorrente = data?.conta.saldoAntes ?? 0
  const lancamentosComSaldo = [...lancamentos].reverse().map(l => {
    saldoCorrente += l.tipo === 'CREDITO' ? Number(l.valor) : -Number(l.valor)
    return { ...l, saldo: saldoCorrente }
  }).reverse()

  const saldoAtual = lancamentosComSaldo[0]?.saldo ?? data?.conta.saldoAntes ?? 0

  // Agrupa lançamentos por dia (lista já está em ordem decrescente)
  const porDia = lancamentosComSaldo.reduce<Map<string, typeof lancamentosComSaldo>>((acc, l) => {
    const dia = l.data.slice(0, 10)
    if (!acc.has(dia)) acc.set(dia, [])
    acc.get(dia)!.push(l)
    return acc
  }, new Map())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {!modoCaixa && (
          <button onClick={() => navigate('/financeiro/contas-bancarias')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{modoCaixa ? 'Caixa' : (data?.conta.nome ?? 'Extrato')}</h1>
          <p className="text-sm text-gray-500">Extrato de movimentações</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowAjuste(true)} disabled={!id}>
            <SlidersHorizontal size={14} /> Ajustar Saldo
          </Button>
          <Button size="sm" onClick={() => setShowLancamento(true)} disabled={!id}>
            <Plus size={14} /> Lançamento
          </Button>
        </div>
      </div>

      {/* Saldo + Filtros */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-4">
          <div>
            <p className="text-xs text-gray-400">Saldo no período</p>
            <p className={clsx('text-xl font-bold', saldoAtual >= 0 ? 'text-green-700' : 'text-red-700')}>{fmt(saldoAtual)}</p>
          </div>
        </div>
        <div className="flex items-end gap-3 flex-1">
          {modoCaixa && todasContas.filter(c => c.ativo).length > 0 && (
            <FormField label="Conta">
              <select
                value={contaSelecionadaId ?? ''}
                onChange={e => { setContaSelecionadaId(e.target.value); setPagina(1) }}
                className="w-full min-w-[280px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {todasContas.filter(c => c.ativo).map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="De">
            <Input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPagina(1) }} />
          </FormField>
          <FormField label="Até">
            <Input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPagina(1) }} />
          </FormField>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400 font-medium">
              <th className="text-left px-4 py-3">Data</th>
              <th className="text-left px-4 py-3">Descrição</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Conta</th>
              <th className="text-right px-4 py-3">Valor</th>
              <th className="text-right px-4 py-3">Saldo</th>
            </tr>
          </thead>
          {/* Saldo do dia anterior à data inicial */}
          {data && (
            <tbody>
              <tr className="bg-blue-50 border-b border-blue-100">
                <td className="px-4 py-2 text-xs font-semibold text-blue-600 whitespace-nowrap">
                  Saldo anterior
                </td>
                <td className="px-4 py-2 text-xs text-blue-400">
                  até {fmtDate(new Date(new Date(dataInicio + 'T12:00:00').getTime() - 86400000).toISOString().slice(0, 10))}
                </td>
                <td className="hidden md:table-cell" />
                <td />
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <span className={clsx('text-sm font-bold', data.conta.saldoAntes >= 0 ? 'text-blue-700' : 'text-red-700')}>
                    {fmt(data.conta.saldoAntes)}
                  </span>
                </td>
              </tr>
            </tbody>
          )}

          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Carregando...</td></tr>
            ) : lancamentosComSaldo.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Nenhum lançamento no período</td></tr>
            ) : Array.from(porDia.entries()).map(([dia, lancsDia]) => {
              const saldoDia = lancsDia[0].saldo
              const entradas = lancsDia.filter(l => l.tipo === 'CREDITO').reduce((s, l) => s + Number(l.valor), 0)
              const saidas   = lancsDia.filter(l => l.tipo === 'DEBITO').reduce((s, l) => s + Number(l.valor), 0)
              const liquido  = entradas - saidas
              return (
                <Fragment key={dia}>
                  {lancsDia.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(l.data)}</td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{l.descricao || l.nomeOriginal || '—'}</p>
                        {l.fonteClassificacao === 'MANUAL' && (
                          <span className="text-xs text-gray-400">Manual</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                        {l.contaFinanceira ? `${l.contaFinanceira.codigo} — ${l.contaFinanceira.nome}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                        <span className={l.tipo === 'CREDITO' ? 'text-green-600' : 'text-red-600'}>
                          {l.tipo === 'CREDITO' ? '+' : '-'} {fmt(Number(l.valor))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={clsx('font-semibold', l.saldo >= 0 ? 'text-gray-800' : 'text-red-700')}>{fmt(l.saldo)}</span>
                      </td>
                    </tr>
                  ))}
                  {/* Linha de saldo do dia */}
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td className="px-4 py-2 text-xs font-semibold text-gray-500 whitespace-nowrap">
                      Saldo do dia
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap">
                      {lancsDia.length} lançamento{lancsDia.length !== 1 ? 's' : ''}
                      {entradas > 0 && <span className="ml-2 text-green-600">+{fmt(entradas)}</span>}
                      {saidas > 0 && <span className="ml-1 text-red-500">-{fmt(saidas)}</span>}
                      {' · '}
                      <span className={clsx('font-medium', liquido >= 0 ? 'text-green-600' : 'text-red-600')}>
                        {liquido >= 0 ? '+' : ''}{fmt(liquido)}
                      </span>
                    </td>
                    <td className="hidden md:table-cell" />
                    <td />
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <span className={clsx('text-sm font-bold', saldoDia >= 0 ? 'text-gray-800' : 'text-red-700')}>
                        {fmt(saldoDia)}
                      </span>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>

        {/* Paginação */}
        {data && data.paginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">{data.total} lançamentos</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</Button>
              <span className="text-sm text-gray-500 self-center">Página {pagina} de {data.paginas}</span>
              <Button variant="secondary" size="sm" disabled={pagina === data.paginas} onClick={() => setPagina(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </div>

      {showLancamento && id && (
        <ModalLancamento
          contaBancariaId={id}
          contasFinanceiras={contasFinanceiras}
          onClose={() => setShowLancamento(false)}
          onSuccess={() => { invalidate(); setShowLancamento(false) }}
        />
      )}

      {showAjuste && id && (
        <ModalAjuste
          contaBancariaId={id}
          saldoAtual={saldoAtual}
          onClose={() => setShowAjuste(false)}
          onSuccess={() => { invalidate(); setShowAjuste(false) }}
        />
      )}
    </div>
  )
}
