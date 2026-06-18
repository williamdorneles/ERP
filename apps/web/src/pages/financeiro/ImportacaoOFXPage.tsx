import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'
import { FormField, Select } from '../../components/ui/FormField'
import { Button } from '../../components/ui/Button'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContaBancaria {
  id: string
  nome: string
  banco?: string
  conta?: string
}

interface ResultadoImportacao {
  importacaoId: string
  total: number
  novas: number
  duplicadas: number
  classificadas: number
  pendentes: number
  contaBancariaId: string
}

interface ImportacaoOFX {
  id: string
  arquivo: string
  status: 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO'
  totalTransacoes: number
  novas: number
  duplicadas: number
  classificadas: number
  erro: string | null
  criadoEm: string
  contaBancaria?: { nome: string } | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ImportacaoOFXPage() {
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
  })

  const { data: historico = [], isLoading: loadingHistorico } = useQuery<ImportacaoOFX[]>({
    queryKey: ['importacoes-ofx'],
    queryFn: () => api.get('/financeiro/ofx/importacoes').then(r => r.data),
    refetchInterval: 5000,
  })

  const importarMutation = useMutation({
    mutationFn: async ({ conteudo, arquivo, contaBancariaId }: { conteudo: string; arquivo: string; contaBancariaId?: string }) => {
      const res = await api.post('/financeiro/ofx/importar', { conteudo, arquivo, contaBancariaId: contaBancariaId || undefined })
      return res.data as ResultadoImportacao
    },
    onSuccess: (data) => {
      setResultado(data)
      setErroImportacao(null)
      qc.invalidateQueries({ queryKey: ['importacoes-ofx'] })
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  async function handleImportar() {
    if (!selectedFile) return
    setErroImportacao(null)
    try {
      const conteudo = await readFileAsLatin1(selectedFile)
      importarMutation.mutate({
        conteudo,
        arquivo: selectedFile.name,
        contaBancariaId: contaBancariaId || undefined,
      })
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

  const statusLabel = (status: ImportacaoOFX['status']) => {
    if (status === 'CONCLUIDO') return 'Concluído'
    if (status === 'ERRO') return 'Erro'
    return 'Processando'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importar OFX</h1>
        <p className="text-sm text-gray-500 mt-1">Importe extratos bancários no formato OFX</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna Esquerda: Upload + Resultado */}
        <div className="space-y-4">
          {/* Upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Arquivo OFX</h2>

            {/* Conta bancária */}
            <FormField label="Conta bancária (opcional)">
              <Select
                value={contaBancariaId}
                onChange={e => setContaBancariaId(e.target.value)}
              >
                <option value="">Detectar automaticamente pelo arquivo</option>
                {contasBancarias.map(cb => (
                  <option key={cb.id} value={cb.id}>
                    {cb.nome}{cb.banco ? ` — ${cb.banco}` : ''}
                  </option>
                ))}
              </Select>
            </FormField>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition',
                isDragging
                  ? 'border-primary-400 bg-primary-50'
                  : selectedFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400 bg-gray-50',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ofx,.OFX"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <FileText size={36} className="mx-auto text-green-500" />
                  <p className="font-medium text-green-700">{selectedFile.name}</p>
                  <p className="text-xs text-green-600">
                    {(selectedFile.size / 1024).toFixed(1)} KB — clique para trocar
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload size={36} className="mx-auto text-gray-400" />
                  <p className="font-medium text-gray-600">Arraste o arquivo .OFX aqui</p>
                  <p className="text-xs text-gray-400">ou clique para selecionar</p>
                </div>
              )}
            </div>

            {/* Erro */}
            {erroImportacao && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <XCircle size={16} className="shrink-0 mt-0.5" />
                {erroImportacao}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleImportar}
                disabled={!selectedFile}
                loading={importarMutation.isPending}
                className="flex-1"
              >
                <Upload size={16} />
                Importar
              </Button>
              {(selectedFile || resultado) && (
                <Button variant="secondary" onClick={handleReset}>
                  <RefreshCw size={16} />
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Resultado */}
          {resultado && (
            <div className="bg-white rounded-xl border border-green-200 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} className="text-green-500" />
                <h2 className="text-base font-semibold text-gray-800">Importação concluída</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{resultado.total}</p>
                  <p className="text-xs text-gray-500">Total no arquivo</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{resultado.novas}</p>
                  <p className="text-xs text-green-600">Novas transações</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{resultado.classificadas}</p>
                  <p className="text-xs text-blue-600">Auto-classificadas</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{resultado.pendentes}</p>
                  <p className="text-xs text-yellow-600">Pendentes</p>
                </div>
              </div>

              {resultado.duplicadas > 0 && (
                <p className="text-xs text-gray-400 text-center">
                  {resultado.duplicadas} transações duplicadas ignoradas
                </p>
              )}
            </div>
          )}
        </div>

        {/* Coluna Direita: Histórico */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Histórico de importações</h2>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['importacoes-ofx'] })}
              className="text-gray-400 hover:text-gray-600 transition"
              title="Atualizar"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {loadingHistorico ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400">
              Carregando histórico...
            </div>
          ) : historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <FileText size={32} className="text-gray-300" />
              <p className="text-sm text-gray-400">Nenhuma importação realizada</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {historico.map(imp => (
                <div key={imp.id} className="px-6 py-3 hover:bg-gray-50 transition">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{statusIcon(imp.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{imp.arquivo}</p>
                        <span className={clsx(
                          'text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0',
                          imp.status === 'CONCLUIDO' && 'bg-green-100 text-green-700',
                          imp.status === 'ERRO' && 'bg-red-100 text-red-700',
                          imp.status === 'PROCESSANDO' && 'bg-yellow-100 text-yellow-700',
                        )}>
                          {statusLabel(imp.status)}
                        </span>
                      </div>
                      {imp.contaBancaria && (
                        <p className="text-xs text-gray-400">{imp.contaBancaria.nome}</p>
                      )}
                      {imp.status === 'CONCLUIDO' && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {imp.totalTransacoes} total · {imp.novas} novas · {imp.duplicadas} dup. · {imp.classificadas} class.
                        </p>
                      )}
                      {imp.status === 'ERRO' && imp.erro && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">{imp.erro}</p>
                      )}
                      <p className="text-xs text-gray-300 mt-0.5">
                        {new Date(imp.criadoEm).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
