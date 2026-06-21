import { useState, useRef, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, AlertTriangle, ChevronRight,
  TrendingDown, TrendingUp, ArrowLeftRight, Search,
  Upload, FileText, CheckCircle, XCircle, Clock, RefreshCw,
  Plus, Edit2, Trash2, Zap, ChevronUp, ChevronDown,
  ToggleLeft, ToggleRight, ChevronLeft as ChevronLeftIcon, ArrowLeft,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../lib/api'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import { Form } from '../../components/ui/Form'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'

// ══════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════

interface ContaBancaria { id: string; nome: string; isCaixa?: boolean; banco?: string }
interface ContaFinanceira { id: string; codigo: string; nome: string; isAnalitica?: boolean }

interface Sugestao {
  parcelaId: string; numero: number; tituloId: string; tituloDescricao: string
  pessoaId: string | null; pessoaNome: string | null
  valor: number; vencimento: string; diffValor: number; diffDias: number; score: number
}

interface TransacaoConciliacao {
  id: string; data: string; valor: number; tipo: 'DEBITO' | 'CREDITO'
  descricao: string | null; nomeOriginal: string | null; status: string
  fonteClassificacao: string | null
  contaFinanceira: { id: string; codigo: string; nome: string } | null
  sugestoes: Sugestao[]; melhorScore: number; confianca: 'ALTA' | 'MEDIA' | 'BAIXA' | null
}

interface ConciliacaoData {
  conta: ContaBancaria
  transacoes: TransacaoConciliacao[]
  stats: { total: number; debitos: number; creditos: number; comSugestaoAlta: number }
}

interface TransacaoList {
  id: string; fitid: string; data: string; valor: string; tipo: 'DEBITO' | 'CREDITO'
  descricao: string | null; nomeOriginal: string | null
  status: 'PENDENTE' | 'SUGERIDO' | 'CLASSIFICADO' | 'REVISADO'
  fonteClassificacao: string | null
  contaBancaria: { id: string; nome: string }
  contaFinanceira: ContaFinanceira | null
}

interface TransacoesResponse {
  dados: TransacaoList[]; total: number; pagina: number; limite: number; paginas: number
}

interface ResultadoImportacao {
  importacaoId: string; total: number; novas: number; duplicadas: number
  classificadas: number; pendentes: number; contaBancariaId: string
}

interface ImportacaoOFX {
  id: string; arquivo: string; status: 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO'
  totalTransacoes: number; novas: number; duplicadas: number; classificadas: number
  erro: string | null; criadoEm: string; contaBancaria?: { nome: string } | null
}

type CampoRegra = 'NOME' | 'MEMO' | 'NOME_OU_MEMO' | 'VALOR'
type TipoCorrespondencia = 'CONTEM' | 'COMECA_COM' | 'TERMINA_COM' | 'IGUAL' | 'REGEX' | 'INTERVALO'
type TipoTransacao = 'QUALQUER' | 'DEBITO' | 'CREDITO'

interface Regra {
  id: string; nome: string; prioridade: number; ativo: boolean
  campo: CampoRegra; tipoCorrespondencia: TipoCorrespondencia
  valorCorrespondencia: string | null; valorMin: number | null; valorMax: number | null
  tipoTransacao: TipoTransacao; contaFinanceiraId: string; totalMatchs: number
  contaFinanceira: { id: string; codigo: string; nome: string }
}

interface FormStateRegra {
  nome: string; prioridade: number; ativo: boolean; campo: CampoRegra
  tipoCorrespondencia: TipoCorrespondencia; valorCorrespondencia: string
  valorMin: string; valorMax: string; tipoTransacao: TipoTransacao; contaFinanceiraId: string
}

// ══════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════

const fmt = (v: number | string) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (s: string) =>
  new Date(s + (s.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR')

function defaultInicio() { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] }
function defaultFim() { return new Date().toISOString().split('T')[0] }

const CONFIANCA_CONFIG = {
  ALTA:  { label: 'Alta',  color: 'bg-green-100 text-green-700 border-green-200' },
  MEDIA: { label: 'Média', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  BAIXA: { label: 'Baixa', color: 'bg-gray-100 text-gray-500 border-gray-200' },
}
const STATUS_CONFIG = {
  PENDENTE:    { label: 'Pendente',    color: 'bg-yellow-100 text-yellow-700' },
  SUGERIDO:    { label: 'Sugerido',    color: 'bg-blue-100 text-blue-700' },
  CLASSIFICADO: { label: 'Classificado', color: 'bg-green-100 text-green-700' },
  REVISADO:    { label: 'Revisado',    color: 'bg-gray-100 text-gray-600' },
}
const CAMPO_LABELS: Record<CampoRegra, string> = {
  NOME: 'Nome do lançamento', MEMO: 'Memo', NOME_OU_MEMO: 'Nome ou Memo', VALOR: 'Valor',
}
const CORRESPONDENCIA_LABELS: Record<TipoCorrespondencia, string> = {
  CONTEM: 'Contém', COMECA_COM: 'Começa com', TERMINA_COM: 'Termina com',
  IGUAL: 'Igual a', REGEX: 'Regex', INTERVALO: 'Intervalo de valor',
}
const TIPO_TX_LABELS: Record<TipoTransacao, string> = {
  QUALQUER: 'Qualquer', DEBITO: 'Débito', CREDITO: 'Crédito',
}
const CORRESPONDENCIAS_POR_CAMPO: Record<CampoRegra, TipoCorrespondencia[]> = {
  NOME: ['CONTEM', 'COMECA_COM', 'TERMINA_COM', 'IGUAL', 'REGEX'],
  MEMO: ['CONTEM', 'COMECA_COM', 'TERMINA_COM', 'IGUAL', 'REGEX'],
  NOME_OU_MEMO: ['CONTEM', 'COMECA_COM', 'TERMINA_COM', 'IGUAL', 'REGEX'],
  VALOR: ['INTERVALO', 'IGUAL'],
}
const EMPTY_FORM_REGRA: FormStateRegra = {
  nome: '', prioridade: 0, ativo: true, campo: 'NOME_OU_MEMO',
  tipoCorrespondencia: 'CONTEM', valorCorrespondencia: '',
  valorMin: '', valorMax: '', tipoTransacao: 'QUALQUER', contaFinanceiraId: '',
}
function describeRegra(r: Regra): string {
  if (r.campo === 'VALOR') {
    const min = r.valorMin != null ? `R$ ${Number(r.valorMin).toFixed(2)}` : '0'
    const max = r.valorMax != null ? `R$ ${Number(r.valorMax).toFixed(2)}` : '∞'
    return `Valor entre ${min} e ${max}`
  }
  return `${CAMPO_LABELS[r.campo]} ${CORRESPONDENCIA_LABELS[r.tipoCorrespondencia].toLowerCase()} "${r.valorCorrespondencia ?? ''}"`
}

// ══════════════════════════════════════════════════════════════════
// Modal Importar OFX
// ══════════════════════════════════════════════════════════════════

function ModalImportarOFX({ open, onClose, onVerTransacoes }: {
  open: boolean
  onClose: () => void
  onVerTransacoes: () => void
}) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [contaBancariaId, setContaBancariaId] = useState('')
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)
  const [erroImportacao, setErroImportacao] = useState<string | null>(null)

  const { data: contasBancarias = [] } = useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias'],
    queryFn: () => api.get('/financeiro/contas-bancarias').then(r => r.data),
    enabled: open,
  })

  const { data: historico = [], isLoading: loadingHistorico } = useQuery<ImportacaoOFX[]>({
    queryKey: ['importacoes-ofx'],
    queryFn: () => api.get('/financeiro/ofx/importacoes').then(r => r.data),
    refetchInterval: open ? 5000 : false,
    enabled: open,
  })

  const importarMutation = useMutation({
    mutationFn: async ({ conteudo, arquivo, contaBancariaId: cbId }: { conteudo: string; arquivo: string; contaBancariaId?: string }) => {
      const res = await api.post('/financeiro/ofx/importar', { conteudo, arquivo, contaBancariaId: cbId || undefined })
      return res.data as ResultadoImportacao
    },
    onSuccess: (data) => {
      setResultado(data)
      setErroImportacao(null)
      qc.invalidateQueries({ queryKey: ['importacoes-ofx'] })
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
      qc.invalidateQueries({ queryKey: ['transacoes'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao importar arquivo.'
      setErroImportacao(msg)
      setResultado(null)
    },
  })

  const readFileAsLatin1 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
      reader.readAsText(file, 'latin1')
    })

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.ofx')) {
      setErroImportacao('Selecione um arquivo com extensão .OFX')
      return
    }
    setSelectedFile(file)
    setResultado(null)
    setErroImportacao(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  async function handleImportar() {
    if (!selectedFile) return
    setErroImportacao(null)
    try {
      const conteudo = await readFileAsLatin1(selectedFile)
      importarMutation.mutate({ conteudo, arquivo: selectedFile.name, contaBancariaId: contaBancariaId || undefined })
    } catch {
      setErroImportacao('Erro ao ler o arquivo.')
    }
  }

  function handleReset() {
    setSelectedFile(null)
    setResultado(null)
    setErroImportacao(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const statusIcon = (status: ImportacaoOFX['status']) => {
    if (status === 'CONCLUIDO') return <CheckCircle size={16} className="text-green-500" />
    if (status === 'ERRO') return <XCircle size={16} className="text-red-500" />
    return <Clock size={16} className="text-yellow-500" />
  }

  return (
    <Modal open={open} onClose={onClose} title="Importar OFX" size="xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna upload */}
        <div className="space-y-4">
          <FormField label="Conta bancária (opcional)">
            <Select value={contaBancariaId} onChange={e => setContaBancariaId(e.target.value)}>
              <option value="">Detectar automaticamente pelo arquivo</option>
              {contasBancarias.map(cb => (
                <option key={cb.id} value={cb.id}>{cb.nome}{cb.banco ? ` — ${cb.banco}` : ''}</option>
              ))}
            </Select>
          </FormField>

          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition',
              isDragging ? 'border-primary-400 bg-primary-50'
                : selectedFile ? 'border-green-300 bg-green-50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50',
            )}
          >
            <input ref={fileInputRef} type="file" accept=".ofx,.OFX" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            {selectedFile ? (
              <div className="space-y-2">
                <FileText size={36} className="mx-auto text-green-500" />
                <p className="font-medium text-green-700">{selectedFile.name}</p>
                <p className="text-xs text-green-600">{(selectedFile.size / 1024).toFixed(1)} KB — clique para trocar</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload size={36} className="mx-auto text-gray-400" />
                <p className="font-medium text-gray-600">Arraste o arquivo .OFX aqui</p>
                <p className="text-xs text-gray-400">ou clique para selecionar</p>
              </div>
            )}
          </div>

          {erroImportacao && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <XCircle size={16} className="shrink-0 mt-0.5" />{erroImportacao}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleImportar} disabled={!selectedFile} loading={importarMutation.isPending} className="flex-1">
              <Upload size={16} /> Importar
            </Button>
            {(selectedFile || resultado) && (
              <Button variant="secondary" onClick={handleReset}>
                <RefreshCw size={16} /> Limpar
              </Button>
            )}
          </div>

          {resultado && (
            <div className="bg-white rounded-xl border border-green-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-500" />
                <h3 className="text-sm font-semibold text-gray-800">Importação concluída</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: resultado.total,        label: 'Total no arquivo',   cls: 'bg-gray-50 text-gray-900' },
                  { v: resultado.novas,        label: 'Novas transações',   cls: 'bg-green-50 text-green-700' },
                  { v: resultado.classificadas, label: 'Auto-classificadas', cls: 'bg-blue-50 text-blue-700' },
                  { v: resultado.pendentes,    label: 'Pendentes',          cls: 'bg-yellow-50 text-yellow-700' },
                ].map(({ v, label, cls }) => (
                  <div key={label} className={clsx('rounded-lg p-2 text-center', cls.split(' ')[0])}>
                    <p className={clsx('text-xl font-bold', cls.split(' ')[1])}>{v}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
              {resultado.duplicadas > 0 && (
                <p className="text-xs text-gray-400 text-center">{resultado.duplicadas} duplicadas ignoradas</p>
              )}
              <Button className="w-full" onClick={onVerTransacoes}>
                Ver transações importadas
              </Button>
            </div>
          )}
        </div>

        {/* Histórico */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-semibold text-gray-800">Histórico de importações</h3>
            <button onClick={() => qc.invalidateQueries({ queryKey: ['importacoes-ofx'] })}
              className="text-gray-400 hover:text-gray-600 transition" title="Atualizar">
              <RefreshCw size={14} />
            </button>
          </div>
          {loadingHistorico ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-400">Carregando...</div>
          ) : historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <FileText size={28} className="text-gray-300" />
              <p className="text-sm text-gray-400">Nenhuma importação realizada</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
              {historico.map(imp => (
                <div key={imp.id} className="px-4 py-3 hover:bg-white transition">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">{statusIcon(imp.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{imp.arquivo}</p>
                        <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0',
                          imp.status === 'CONCLUIDO' && 'bg-green-100 text-green-700',
                          imp.status === 'ERRO' && 'bg-red-100 text-red-700',
                          imp.status === 'PROCESSANDO' && 'bg-yellow-100 text-yellow-700',
                        )}>
                          {imp.status === 'CONCLUIDO' ? 'Concluído' : imp.status === 'ERRO' ? 'Erro' : 'Processando'}
                        </span>
                      </div>
                      {imp.contaBancaria && <p className="text-xs text-gray-400">{imp.contaBancaria.nome}</p>}
                      {imp.status === 'CONCLUIDO' && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {imp.totalTransacoes} total · {imp.novas} novas · {imp.duplicadas} dup. · {imp.classificadas} class.
                        </p>
                      )}
                      {imp.status === 'ERRO' && imp.erro && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">{imp.erro}</p>
                      )}
                      <p className="text-xs text-gray-300 mt-0.5">{new Date(imp.criadoEm).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════
// Tab Conciliar — componentes internos
// ══════════════════════════════════════════════════════════════════

function PainelSugestoes({ tx, onConfirmar, confirmando }: {
  tx: TransacaoConciliacao
  onConfirmar: (transacaoId: string, parcelaId: string) => void
  confirmando: string | null
}) {
  const isDeb = tx.tipo === 'DEBITO'
  return (
    <div className="flex flex-col h-full">
      <div className={clsx('p-4 rounded-xl border mb-4', isDeb ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100')}>
        <div className="flex items-center gap-3">
          <div className={clsx('p-2 rounded-lg', isDeb ? 'bg-red-100' : 'bg-green-100')}>
            {isDeb ? <TrendingDown size={18} className="text-red-600" /> : <TrendingUp size={18} className="text-green-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{tx.nomeOriginal || tx.descricao || '—'}</p>
            <p className="text-sm text-gray-500">{fmtDate(tx.data)}</p>
          </div>
          <p className={clsx('text-xl font-bold', isDeb ? 'text-red-700' : 'text-green-700')}>
            {isDeb ? '-' : '+'}{fmt(tx.valor)}
          </p>
        </div>
        {tx.contaFinanceira && (
          <p className="text-xs text-gray-500 mt-2 pl-11">Conta: {tx.contaFinanceira.codigo} — {tx.contaFinanceira.nome}</p>
        )}
      </div>

      <p className="text-sm font-medium text-gray-700 mb-3">
        {tx.sugestoes.length === 0
          ? 'Sem sugestões de conciliação'
          : `${tx.sugestoes.length} parcela(s) candidata(s) — confirme a correspondência:`}
      </p>

      {tx.sugestoes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed rounded-xl p-6">
          <Search size={32} className="mb-2 opacity-30" />
          <p className="text-sm font-medium">Nenhuma parcela encontrada</p>
          <p className="text-xs mt-1 text-center">
            Verifique se existe um título a {isDeb ? 'pagar' : 'receber'} com valor e vencimento próximos
          </p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {tx.sugestoes.map((s, i) => {
            const conf = s.score >= 150 ? 'ALTA' : s.score >= 80 ? 'MEDIA' : 'BAIXA'
            const isConfirmando = confirmando === `${tx.id}-${s.parcelaId}`
            return (
              <div key={s.parcelaId} className={clsx(
                'border rounded-xl p-4 transition',
                i === 0 && s.score >= 150
                  ? 'border-green-300 bg-green-50/50 ring-1 ring-green-200'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium', CONFIANCA_CONFIG[conf].color)}>
                        {CONFIANCA_CONFIG[conf].label} · {s.score}pts
                      </span>
                      {i === 0 && s.score >= 150 && <span className="text-xs text-green-600 font-medium">Melhor match</span>}
                    </div>
                    <p className="font-medium text-gray-900 text-sm truncate">{s.tituloDescricao}</p>
                    {s.pessoaNome && <p className="text-xs text-gray-500">{s.pessoaNome}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Parcela {s.numero} · Venc. {fmtDate(s.vencimento)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">{fmt(s.valor)}</p>
                    {Math.abs(s.diffValor) > 0.01 && (
                      <p className={clsx('text-xs mt-0.5', Math.abs(s.diffValor / s.valor) <= 0.02 ? 'text-amber-600' : 'text-red-500')}>
                        {s.diffValor > 0 ? '+' : ''}{fmt(s.diffValor)}
                      </p>
                    )}
                    <p className={clsx('text-xs mt-0.5',
                      Math.abs(s.diffDias) <= 3 ? 'text-green-600' : Math.abs(s.diffDias) <= 7 ? 'text-amber-600' : 'text-gray-400',
                    )}>
                      {s.diffDias === 0 ? 'Mesmo dia' : s.diffDias > 0 ? `+${s.diffDias}d` : `${s.diffDias}d`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onConfirmar(tx.id, s.parcelaId)}
                  disabled={!!confirmando}
                  className={clsx(
                    'mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg font-medium transition disabled:opacity-50',
                    i === 0 && s.score >= 150
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
                  )}
                >
                  <CheckCircle2 size={15} />
                  {isConfirmando ? 'Conciliando...' : 'Confirmar conciliação'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TxRow({ tx, selected, onClick }: { tx: TransacaoConciliacao; selected: boolean; onClick: () => void }) {
  const isDeb = tx.tipo === 'DEBITO'
  const conf = tx.confianca
  return (
    <button onClick={onClick} className={clsx(
      'w-full text-left px-4 py-3 border-b last:border-b-0 transition hover:bg-gray-50',
      selected && 'bg-primary-50 border-l-4 border-l-primary-500',
      !selected && 'border-l-4 border-l-transparent',
    )}>
      <div className="flex items-center gap-3">
        <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isDeb ? 'bg-red-100' : 'bg-green-100')}>
          {isDeb ? <TrendingDown size={14} className="text-red-600" /> : <TrendingUp size={14} className="text-green-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{tx.nomeOriginal || tx.descricao || '—'}</p>
          <p className="text-xs text-gray-400">{fmtDate(tx.data)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <p className={clsx('text-sm font-semibold', isDeb ? 'text-red-700' : 'text-green-700')}>{fmt(tx.valor)}</p>
          {conf && (
            <span className={clsx('text-xs px-1.5 py-0.5 rounded-full border', CONFIANCA_CONFIG[conf].color)}>
              {CONFIANCA_CONFIG[conf].label}
            </span>
          )}
          {!conf && tx.sugestoes.length === 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full border border-gray-100 text-gray-400 bg-gray-50">Sem match</span>
          )}
          <ChevronRight size={14} className="text-gray-300" />
        </div>
      </div>
    </button>
  )
}

function TabConciliar() {
  const qc = useQueryClient()
  const [contaId, setContaId] = useState('')
  const [dataInicio, setDataInicio] = useState(defaultInicio)
  const [dataFim, setDataFim] = useState(defaultFim)
  const [txSelecionada, setTxSelecionada] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [filtroConfianca, setFiltroConfianca] = useState<string>('TODAS')

  const { data: contas } = useQuery<{ dados: ContaBancaria[] }>({
    queryKey: ['contas-bancarias-lista'],
    queryFn: () => api.get('/financeiro/contas-bancarias').then(r => r.data),
  })

  const { data, isLoading, refetch } = useQuery<ConciliacaoData>({
    queryKey: ['conciliacao', contaId, dataInicio, dataFim],
    queryFn: () => api.get(`/conciliacao/${contaId}?dataInicio=${dataInicio}&dataFim=${dataFim}`).then(r => r.data),
    enabled: !!contaId,
  })

  const confirmar = useMutation({
    mutationFn: ({ transacaoId, parcelaId }: { transacaoId: string; parcelaId: string }) =>
      api.post('/conciliacao/confirmar', { transacaoId, parcelaId }),
    onSuccess: (_r, vars) => {
      setConfirmando(null)
      if (txSelecionada === vars.transacaoId) setTxSelecionada(null)
      qc.invalidateQueries({ queryKey: ['conciliacao'] })
      qc.invalidateQueries({ queryKey: ['titulos'] })
      qc.invalidateQueries({ queryKey: ['titulos-resumo'] })
    },
    onError: () => setConfirmando(null),
  })

  function handleConfirmar(transacaoId: string, parcelaId: string) {
    setConfirmando(`${transacaoId}-${parcelaId}`)
    confirmar.mutate({ transacaoId, parcelaId })
  }

  const transacoes = useMemo(() => {
    const list = data?.transacoes ?? []
    let filtered = list
    if (busca.trim()) {
      const q = busca.toLowerCase()
      filtered = filtered.filter(t =>
        t.nomeOriginal?.toLowerCase().includes(q) || t.descricao?.toLowerCase().includes(q)
      )
    }
    if (filtroConfianca === 'ALTA') filtered = filtered.filter(t => t.confianca === 'ALTA')
    if (filtroConfianca === 'SEM') filtered = filtered.filter(t => t.sugestoes.length === 0)
    return filtered
  }, [data, busca, filtroConfianca])

  const txAtual = transacoes.find(t => t.id === txSelecionada) ?? transacoes[0] ?? null

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 bg-white border rounded-xl p-4">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">Conta Bancária</label>
          <select value={contaId} onChange={e => { setContaId(e.target.value); setTxSelecionada(null) }}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
            <option value="">— Selecionar —</option>
            {(contas?.dados ?? []).map(c => (
              <option key={c.id} value={c.id}>{c.nome}{c.isCaixa ? ' (Caixa)' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
          <div className="flex items-center gap-2">
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            <span className="text-gray-400 text-sm">até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>
        </div>
        <button onClick={() => refetch()} disabled={!contaId || isLoading}
          className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition">
          {isLoading ? 'Carregando...' : 'Buscar'}
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'A conciliar', value: data.stats.total, color: 'text-gray-900' },
            { label: 'Débitos', value: data.stats.debitos, color: 'text-red-700' },
            { label: 'Créditos', value: data.stats.creditos, color: 'text-green-700' },
            { label: 'Match automático', value: data.stats.comSugestaoAlta, color: 'text-primary-700' },
          ].map(s => (
            <div key={s.label} className="bg-white border rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={clsx('text-2xl font-bold mt-0.5', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Split view */}
      {!contaId ? (
        <div className="flex items-center justify-center text-gray-400 border-2 border-dashed rounded-xl py-16">
          <div className="text-center">
            <ArrowLeftRight size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Selecione uma conta bancária para iniciar</p>
          </div>
        </div>
      ) : data && data.transacoes.length === 0 ? (
        <div className="flex items-center justify-center text-gray-400 border-2 border-dashed rounded-xl py-16">
          <div className="text-center">
            <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30 text-green-400" />
            <p className="font-medium text-green-600">Tudo conciliado!</p>
            <p className="text-sm mt-1">Não há transações pendentes neste período</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-4" style={{ minHeight: 500 }}>
          <div className="w-2/5 flex flex-col bg-white border rounded-xl overflow-hidden">
            <div className="p-3 border-b space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Buscar transação..." value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
              <div className="flex gap-1.5">
                {[{ key: 'TODAS', label: 'Todas' }, { key: 'ALTA', label: 'Alta confiança' }, { key: 'SEM', label: 'Sem sugestão' }].map(f => (
                  <button key={f.key} onClick={() => setFiltroConfianca(f.key)}
                    className={clsx('px-2.5 py-1 text-xs rounded-full font-medium transition',
                      filtroConfianca === f.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {transacoes.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Nenhuma transação encontrada</p>
              ) : transacoes.map(tx => (
                <TxRow key={tx.id} tx={tx} selected={tx.id === (txAtual?.id ?? null)} onClick={() => setTxSelecionada(tx.id)} />
              ))}
            </div>
            <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
              {transacoes.length} transação(ões) · clique para ver sugestões
            </div>
          </div>

          <div className="flex-1 bg-white border rounded-xl p-4 overflow-y-auto">
            {txAtual ? (
              <PainelSugestoes tx={txAtual} onConfirmar={handleConfirmar} confirmando={confirmando} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Selecione uma transação para ver as sugestões</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// Tab Transações
// ══════════════════════════════════════════════════════════════════

function ClassificaPanel({ tx, contas, onClose, onSave, loading }: {
  tx: TransacaoList
  contas: ContaFinanceira[]
  onClose: () => void
  onSave: (contaFinanceiraId: string, aplicarSimilares: boolean) => void
  loading: boolean
}) {
  const [busca, setBusca] = useState('')
  const [contaSelecionada, setContaSelecionada] = useState(tx.contaFinanceira?.id ?? '')
  const [aplicarSimilares, setAplicarSimilares] = useState(false)
  const contasFiltradas = busca.trim()
    ? contas.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()) || c.codigo.includes(busca))
    : contas

  return (
    <div className="mt-2 mb-1 mx-2 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-blue-800">Classificar transação</span>
        <button onClick={onClose} className="text-blue-400 hover:text-blue-600"><XCircle size={14} /></button>
      </div>
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar conta..."
          className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>
      <div className="max-h-40 overflow-y-auto space-y-0.5">
        {contasFiltradas.slice(0, 20).map(conta => (
          <button key={conta.id} onClick={() => setContaSelecionada(conta.id)}
            className={clsx('w-full text-left px-2 py-1.5 rounded text-xs transition',
              contaSelecionada === conta.id ? 'bg-primary-600 text-white' : 'hover:bg-white text-gray-700')}>
            <span className="font-mono text-gray-400 mr-2">{conta.codigo}</span>{conta.nome}
          </button>
        ))}
        {contasFiltradas.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Nenhuma conta encontrada</p>}
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={aplicarSimilares} onChange={e => setAplicarSimilares(e.target.checked)}
          className="h-3.5 w-3.5 accent-primary-600" />
        <span className="text-xs text-gray-600">Aplicar a transações similares pendentes</span>
      </label>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button size="sm" disabled={!contaSelecionada} loading={loading}
          onClick={() => contaSelecionada && onSave(contaSelecionada, aplicarSimilares)}>
          Salvar
        </Button>
      </div>
    </div>
  )
}

function TabTransacoes() {
  const qc = useQueryClient()
  const [statusFiltro, setStatusFiltro] = useState<string>('')
  const [contaBancariaId, setContaBancariaId] = useState('')
  const [pagina, setPagina] = useState(1)
  const [classificandoId, setClassificandoId] = useState<string | null>(null)

  const { data: contasBancarias = [] } = useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias'],
    queryFn: () => api.get('/financeiro/contas-bancarias').then(r => r.data),
  })
  const { data: contas = [] } = useQuery<ContaFinanceira[]>({
    queryKey: ['contas-flat'],
    queryFn: () => api.get('/financeiro/contas').then(r => r.data),
  })
  const { data, isLoading } = useQuery<TransacoesResponse>({
    queryKey: ['transacoes', statusFiltro, contaBancariaId, pagina],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFiltro) params.set('status', statusFiltro)
      if (contaBancariaId) params.set('contaBancariaId', contaBancariaId)
      params.set('pagina', String(pagina))
      params.set('limite', '50')
      return api.get(`/financeiro/transacoes?${params}`).then(r => r.data)
    },
  })

  const aprovarMutation = useMutation({
    mutationFn: (id: string) => api.put(`/financeiro/transacoes/${id}/aprovar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transacoes'] }),
  })
  const classificarMutation = useMutation({
    mutationFn: ({ id, contaFinanceiraId, aplicarSimilares }: { id: string; contaFinanceiraId: string; aplicarSimilares: boolean }) =>
      api.put(`/financeiro/transacoes/${id}/classificar`, { contaFinanceiraId, aplicarSimilares }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transacoes'] }); setClassificandoId(null) },
  })
  const aprovarLoteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/financeiro/transacoes/aprovar-lote', { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transacoes'] }),
  })
  const reclassificarMutation = useMutation({
    mutationFn: () => api.post('/financeiro/transacoes/reclassificar-pendentes'),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['transacoes'] })
      const d = res.data as { reclassificadas: number; porRegra: number; porHistorico: number }
      if (d.reclassificadas === 0) {
        alert('Nenhuma transação pendente encontrada ou sem histórico suficiente.')
      } else {
        alert(`${d.reclassificadas} transação(ões) reclassificada(s): ${d.porRegra} por regra, ${d.porHistorico} por histórico.`)
      }
    },
  })

  const transacoes = data?.dados ?? []
  const sugestoes = transacoes.filter(t => t.status === 'SUGERIDO')

  const statusPills = [
    { value: '', label: 'Todas' },
    { value: 'PENDENTE', label: 'Pendente' },
    { value: 'SUGERIDO', label: 'Sugerido' },
    { value: 'CLASSIFICADO', label: 'Classificado' },
    { value: 'REVISADO', label: 'Revisado' },
  ]

  return (
    <div className="space-y-4">
      {/* Sub-header com ações */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {data ? `${data.total} transações encontradas` : 'Carregando...'}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" loading={reclassificarMutation.isPending}
            onClick={() => reclassificarMutation.mutate()}
            title="Re-processa transações PENDENTE usando regras e histórico">
            Reclassificar pendentes
          </Button>
          {sugestoes.length > 0 && (
            <Button variant="secondary" loading={aprovarLoteMutation.isPending}
              onClick={() => aprovarLoteMutation.mutate(sugestoes.map(t => t.id))}>
              <CheckCircle size={16} className="text-green-500" />
              Aprovar {sugestoes.length} sugestão{sugestoes.length > 1 ? 'ões' : ''}
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="flex gap-1.5 flex-wrap">
          {statusPills.map(pill => (
            <button key={pill.value} onClick={() => { setStatusFiltro(pill.value); setPagina(1) }}
              className={clsx('px-3 py-1.5 rounded-full text-xs font-medium transition',
                statusFiltro === pill.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {pill.label}
            </button>
          ))}
        </div>
        <div className="w-52">
          <Select value={contaBancariaId} onChange={e => { setContaBancariaId(e.target.value); setPagina(1) }}>
            <option value="">Todas as contas</option>
            {contasBancarias.map(cb => <option key={cb.id} value={cb.id}>{cb.nome}</option>)}
          </Select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">Carregando transações...</div>
        ) : transacoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-gray-500 font-medium">Nenhuma transação encontrada</p>
            <p className="text-sm text-gray-400">Importe um arquivo OFX para começar.</p>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-[120px_1fr_130px_1fr_120px_80px] gap-3 px-4 py-2 border-b border-gray-100 text-xs text-gray-400 font-medium">
              <span>Data</span><span>Descrição</span><span className="text-right">Valor</span>
              <span>Conta</span><span className="text-center">Status</span><span className="text-center">Ações</span>
            </div>
            {transacoes.map(tx => (
              <div key={tx.id}>
                <div className={clsx('grid grid-cols-[120px_1fr_130px_1fr_120px_80px] gap-3 px-4 py-3 items-center border-b border-gray-50 hover:bg-gray-50 transition',
                  tx.status === 'REVISADO' && 'opacity-60')}>
                  <span className="text-sm text-gray-500">{fmtDate(tx.data)}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{tx.descricao || tx.nomeOriginal || '—'}</p>
                    <p className="text-xs text-gray-400 truncate">{tx.contaBancaria.nome}</p>
                  </div>
                  <span className={clsx('text-sm font-medium text-right tabular-nums',
                    tx.tipo === 'CREDITO' ? 'text-green-600' : 'text-red-600')}>
                    {tx.tipo === 'CREDITO' ? '+' : '-'}{fmt(tx.valor)}
                  </span>
                  <div className="min-w-0">
                    {tx.contaFinanceira ? (
                      <div>
                        <p className="text-xs font-medium text-gray-700 truncate">{tx.contaFinanceira.nome}</p>
                        <p className="text-xs text-gray-400">{tx.contaFinanceira.codigo}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">Não classificada</span>
                    )}
                  </div>
                  <div className="text-center">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_CONFIG[tx.status].color)}>
                      {STATUS_CONFIG[tx.status].label}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    {tx.status === 'SUGERIDO' && (
                      <button onClick={() => aprovarMutation.mutate(tx.id)} title="Aprovar sugestão"
                        className="p-1.5 rounded-lg hover:bg-green-50 text-green-500 transition">
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {tx.status !== 'REVISADO' && (
                      <button onClick={() => setClassificandoId(classificandoId === tx.id ? null : tx.id)}
                        title="Classificar"
                        className={clsx('p-1.5 rounded-lg transition text-xs font-medium',
                          classificandoId === tx.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-500')}>
                        <Search size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {classificandoId === tx.id && (
                  <ClassificaPanel tx={tx} contas={contas} onClose={() => setClassificandoId(null)}
                    onSave={(contaFinanceiraId, aplicarSimilares) =>
                      classificarMutation.mutate({ id: tx.id, contaFinanceiraId, aplicarSimilares })}
                    loading={classificarMutation.isPending} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paginação */}
      {data && data.paginas > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Página {data.pagina} de {data.paginas} · {data.total} transações</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>
              <ChevronLeftIcon size={16} /> Anterior
            </Button>
            <Button variant="secondary" size="sm" disabled={pagina >= data.paginas} onClick={() => setPagina(p => p + 1)}>
              Próxima <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// Tab Regras
// ══════════════════════════════════════════════════════════════════

function RegraForm({ regra, contas, onClose, onSave, loading }: {
  regra: Regra | null
  contas: ContaFinanceira[]
  onClose: () => void
  onSave: (data: object) => void
  loading: boolean
}) {
  const [form, setForm] = useState<FormStateRegra>(() =>
    regra ? {
      nome: regra.nome, prioridade: regra.prioridade, ativo: regra.ativo,
      campo: regra.campo, tipoCorrespondencia: regra.tipoCorrespondencia,
      valorCorrespondencia: regra.valorCorrespondencia ?? '',
      valorMin: regra.valorMin?.toString() ?? '', valorMax: regra.valorMax?.toString() ?? '',
      tipoTransacao: regra.tipoTransacao, contaFinanceiraId: regra.contaFinanceiraId,
    } : EMPTY_FORM_REGRA
  )
  const [errors, setErrors] = useState<Partial<Record<keyof FormStateRegra, string>>>({})
  const isValorField = form.campo === 'VALOR'
  const correspondenciasDisponiveis = CORRESPONDENCIAS_POR_CAMPO[form.campo]

  function set<K extends keyof FormStateRegra>(key: K, value: FormStateRegra[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'campo') {
        const tipos = CORRESPONDENCIAS_POR_CAMPO[value as CampoRegra]
        if (!tipos.includes(next.tipoCorrespondencia)) next.tipoCorrespondencia = tipos[0]
      }
      return next
    })
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: typeof errors = {}
    if (!form.nome.trim()) errs.nome = 'Obrigatório'
    if (!form.contaFinanceiraId) errs.contaFinanceiraId = 'Obrigatório'
    if (!isValorField && !form.valorCorrespondencia.trim()) errs.valorCorrespondencia = 'Obrigatório'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    const payload: Record<string, unknown> = {
      nome: form.nome.trim(), prioridade: Number(form.prioridade), ativo: form.ativo,
      campo: form.campo, tipoCorrespondencia: form.tipoCorrespondencia,
      tipoTransacao: form.tipoTransacao, contaFinanceiraId: form.contaFinanceiraId,
    }
    if (isValorField) {
      payload.valorCorrespondencia = null
      payload.valorMin = form.valorMin ? parseFloat(form.valorMin) : null
      payload.valorMax = form.valorMax ? parseFloat(form.valorMax) : null
    } else {
      payload.valorCorrespondencia = form.valorCorrespondencia.trim()
      payload.valorMin = null
      payload.valorMax = null
    }
    onSave(payload)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{regra ? 'Editar Regra' : 'Nova Regra'}</h2>
          <p className="text-sm text-gray-500">Regras são testadas em ordem de prioridade</p>
        </div>
      </div>
      <Form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <FormField label="Nome da regra" required error={errors.nome}>
              <Input value={form.nome} onChange={e => set('nome', e.target.value)}
                placeholder="Ex: Salários e encargos" error={!!errors.nome} />
            </FormField>
          </div>
          <FormField label="Prioridade" hint="Menor = executada primeiro">
            <Input type="number" value={form.prioridade}
              onChange={e => set('prioridade', parseInt(e.target.value) || 0)} />
          </FormField>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Tipo de transação</label>
          <div className="flex gap-2">
            {(['QUALQUER', 'DEBITO', 'CREDITO'] as TipoTransacao[]).map(t => (
              <button key={t} type="button" onClick={() => set('tipoTransacao', t)}
                className={clsx('flex-1 py-2 text-sm font-medium rounded-lg border transition',
                  form.tipoTransacao === t
                    ? t === 'DEBITO' ? 'border-red-300 bg-red-50 text-red-700'
                      : t === 'CREDITO' ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-primary-300 bg-primary-50 text-primary-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50')}>
                {TIPO_TX_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <FormField label="Campo para verificar">
          <Select value={form.campo} onChange={e => set('campo', e.target.value as CampoRegra)}>
            {(Object.entries(CAMPO_LABELS) as [CampoRegra, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Tipo de correspondência">
            <Select value={form.tipoCorrespondencia}
              onChange={e => set('tipoCorrespondencia', e.target.value as TipoCorrespondencia)}>
              {correspondenciasDisponiveis.map(t => <option key={t} value={t}>{CORRESPONDENCIA_LABELS[t]}</option>)}
            </Select>
          </FormField>
          {isValorField ? (
            <FormField label={form.tipoCorrespondencia === 'INTERVALO' ? 'Valor mínimo (R$)' : 'Valor exato (R$)'}>
              <Input type="number" step="0.01" value={form.valorMin}
                onChange={e => set('valorMin', e.target.value)} placeholder="0.00" />
            </FormField>
          ) : (
            <FormField label="Valor a buscar" required error={errors.valorCorrespondencia}>
              <Input value={form.valorCorrespondencia} onChange={e => set('valorCorrespondencia', e.target.value)}
                placeholder={form.tipoCorrespondencia === 'REGEX' ? '^FOLHA\\s' : 'Ex: FOLHA, ADOBE, PIX'}
                error={!!errors.valorCorrespondencia} />
            </FormField>
          )}
        </div>

        {isValorField && form.tipoCorrespondencia === 'INTERVALO' && (
          <FormField label="Valor máximo (R$)" hint="Deixe vazio para sem limite">
            <Input type="number" step="0.01" value={form.valorMax}
              onChange={e => set('valorMax', e.target.value)} placeholder="Sem limite" />
          </FormField>
        )}

        {!isValorField && form.valorCorrespondencia && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
            Condição: <code className="font-mono">{CAMPO_LABELS[form.campo]} {CORRESPONDENCIA_LABELS[form.tipoCorrespondencia].toLowerCase()} &quot;{form.valorCorrespondencia}&quot;</code>
          </div>
        )}

        <FormField label="Classificar na conta" required error={errors.contaFinanceiraId}>
          <Select value={form.contaFinanceiraId} onChange={e => set('contaFinanceiraId', e.target.value)}
            error={!!errors.contaFinanceiraId}>
            <option value="">Selecione uma conta...</option>
            {contas.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}
          </Select>
        </FormField>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="ativo-regra" checked={form.ativo}
            onChange={e => set('ativo', e.target.checked)} className="h-4 w-4 accent-primary-600" />
          <label htmlFor="ativo-regra" className="text-sm text-gray-700">Regra ativa</label>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{regra ? 'Salvar alterações' : 'Criar regra'}</Button>
        </div>
      </Form>
    </div>
  )
}

function TabRegras() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Regra | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null)

  const { data: regras = [], isLoading } = useQuery<Regra[]>({
    queryKey: ['regras-classificacao'],
    queryFn: () => api.get('/financeiro/regras').then(r => r.data),
  })
  const { data: contas = [] } = useQuery<ContaFinanceira[]>({
    queryKey: ['contas-flat'],
    queryFn: () => api.get('/financeiro/contas').then(r => r.data),
  })
  const contasAnaliticas = contas.filter(c => c.isAnalitica)

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post('/financeiro/regras', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regras-classificacao'] }); setShowForm(false); setEditando(null) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => api.put(`/financeiro/regras/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regras-classificacao'] }); setShowForm(false); setEditando(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/financeiro/regras/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regras-classificacao'] }); setDeleteTarget(null) },
  })
  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => api.put(`/financeiro/regras/${id}`, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regras-classificacao'] }),
  })
  const moverPrioridade = useMutation({
    mutationFn: ({ id, prioridade }: { id: string; prioridade: number }) =>
      api.put(`/financeiro/regras/${id}`, { prioridade }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regras-classificacao'] }),
  })

  function handleMoveUp(regra: Regra, idx: number) {
    if (idx === 0) return
    moverPrioridade.mutate({ id: regra.id, prioridade: regras[idx - 1].prioridade - 1 })
  }
  function handleMoveDown(regra: Regra, idx: number) {
    if (idx === regras.length - 1) return
    moverPrioridade.mutate({ id: regra.id, prioridade: regras[idx + 1].prioridade + 1 })
  }

  if (showForm) {
    return (
      <RegraForm regra={editando} contas={contasAnaliticas}
        onClose={() => { setShowForm(false); setEditando(null) }}
        onSave={(data) => {
          if (editando) updateMutation.mutate({ id: editando.id, data })
          else createMutation.mutate(data)
        }}
        loading={createMutation.isPending || updateMutation.isPending} />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Executadas em ordem de prioridade ao importar transações</p>
        <Button onClick={() => { setEditando(null); setShowForm(true) }}>
          <Plus size={16} /> Nova Regra
        </Button>
      </div>

      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-xs text-blue-700">
        <Zap size={14} className="shrink-0" />
        As regras são testadas na ordem de prioridade. A primeira que corresponder classifica a transação. Menor número = maior prioridade.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">Carregando regras...</div>
        ) : regras.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Zap size={24} className="text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-700">Nenhuma regra cadastrada</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm">
                Crie regras para classificar transações automaticamente ao importar extratos OFX.
              </p>
            </div>
            <Button size="sm" onClick={() => { setEditando(null); setShowForm(true) }}>
              <Plus size={14} /> Criar primeira regra
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="w-10 px-3 py-3 text-xs text-gray-400 font-medium">Pri.</th>
                <th className="px-4 py-3 text-xs text-gray-400 font-medium">Nome</th>
                <th className="px-4 py-3 text-xs text-gray-400 font-medium">Condição</th>
                <th className="px-4 py-3 text-xs text-gray-400 font-medium">Tipo</th>
                <th className="px-4 py-3 text-xs text-gray-400 font-medium">Conta destino</th>
                <th className="px-4 py-3 text-xs text-gray-400 font-medium text-right">Matches</th>
                <th className="px-4 py-3 text-xs text-gray-400 font-medium text-center">Ativo</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {regras.map((regra, idx) => (
                <tr key={regra.id} className={clsx('border-b border-gray-50', !regra.ativo ? 'opacity-50' : 'hover:bg-gray-50')}>
                  <td className="px-2 py-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <button onClick={() => handleMoveUp(regra, idx)} disabled={idx === 0}
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition">
                        <ChevronUp size={12} />
                      </button>
                      <span className="text-xs font-mono text-gray-400">{regra.prioridade}</span>
                      <button onClick={() => handleMoveDown(regra, idx)} disabled={idx === regras.length - 1}
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition">
                        <ChevronDown size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{regra.nome}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{describeRegra(regra)}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                      regra.tipoTransacao === 'DEBITO' && 'bg-red-100 text-red-700',
                      regra.tipoTransacao === 'CREDITO' && 'bg-green-100 text-green-700',
                      regra.tipoTransacao === 'QUALQUER' && 'bg-gray-100 text-gray-600')}>
                      {TIPO_TX_LABELS[regra.tipoTransacao]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {regra.contaFinanceira ? `${regra.contaFinanceira.codigo} — ${regra.contaFinanceira.nome}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {regra.totalMatchs > 0 ? (
                      <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{regra.totalMatchs}</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleMutation.mutate({ id: regra.id, ativo: !regra.ativo })}
                      title={regra.ativo ? 'Desativar' : 'Ativar'} className="text-gray-400 hover:text-gray-600 transition">
                      {regra.ativo ? <ToggleRight size={20} className="text-primary-600" /> : <ToggleLeft size={20} />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditando(regra); setShowForm(true) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition" title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget({ id: regra.id, nome: regra.nome })}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition" title="Excluir">
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

      <ConfirmDialog open={!!deleteTarget} title="Excluir regra?"
        message={deleteTarget ? `A regra "${deleteTarget.nome}" será excluída permanentemente. Transações já classificadas por ela não serão afetadas.` : ''}
        confirmLabel="Excluir" variant="danger"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)} loading={deleteMutation.isPending} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// Página principal
// ══════════════════════════════════════════════════════════════════

type Aba = 'conciliar' | 'transacoes' | 'regras'

export function ConciliacaoPage() {
  const [aba, setAba] = useState<Aba>('conciliar')
  const [modalOFX, setModalOFX] = useState(false)

  const abas: { key: Aba; label: string }[] = [
    { key: 'conciliar',  label: 'Conciliar' },
    { key: 'transacoes', label: 'Transações' },
    { key: 'regras',     label: 'Regras de Classificação' },
  ]

  function handleVerTransacoes() {
    setModalOFX(false)
    setAba('transacoes')
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conciliação Bancária</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Importe extratos, classifique transações e concilie com títulos a pagar/receber
          </p>
        </div>
        <Button onClick={() => setModalOFX(true)}>
          <Upload size={16} /> Importar OFX
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {abas.map(tab => (
          <button key={tab.key} onClick={() => setAba(tab.key)}
            className={clsx(
              'px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px',
              aba === tab.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      {aba === 'conciliar'  && <TabConciliar />}
      {aba === 'transacoes' && <TabTransacoes />}
      {aba === 'regras'     && <TabRegras />}

      <ModalImportarOFX open={modalOFX} onClose={() => setModalOFX(false)} onVerTransacoes={handleVerTransacoes} />
    </div>
  )
}
