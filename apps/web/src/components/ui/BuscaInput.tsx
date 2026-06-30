import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api } from '../../lib/api'

/**
 * Campo de vínculo com pesquisa por digitação (combobox).
 * Padrão do projeto: campos de vínculo são inputs editáveis, nunca dropdown.
 * Busca no servidor por `busca` e filtra por `params`.
 *
 * Teclado: ↑/↓ navegam os resultados, Enter seleciona o destacado, Esc fecha.
 * Quando não há resultado destacado, o Enter "passa" (não chama preventDefault),
 * deixando o useEnterToTab do <Form> avançar para o próximo campo.
 */
export interface BuscaInputProps<T> {
  value: string
  onSelect: (item: T | null) => void
  endpoint: string                      // ex.: '/produtos'
  params?: Record<string, string>       // ex.: { tipo: 'PRODUTO_ACABADO' }
  getId: (t: T) => string
  getLabel: (t: T) => string
  getSub?: (t: T) => string
  queryKeyBase: string
  placeholder?: string
  error?: boolean
}

export function BuscaInput<T>({
  value, onSelect, endpoint, params, getId, getLabel, getSub, queryKeyBase, placeholder, error,
}: BuscaInputProps<T>) {
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [destaque, setDestaque] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const { data: itens = [] } = useQuery<T[]>({
    queryKey: [queryKeyBase, busca, params],
    queryFn: () => api.get(endpoint, { params: { ...params, busca: busca || undefined } }).then(r => r.data),
  })

  // Carrega o rótulo do item já selecionado (ao editar / valor inicial)
  const { data: sel } = useQuery<T>({
    queryKey: [`${queryKeyBase}-byid`, value],
    queryFn: () => api.get(`${endpoint}/${value}`).then(r => r.data),
    enabled: !!value && !busca,
  })
  useEffect(() => { if (sel && !busca) setBusca(getLabel(sel)) }, [sel]) // eslint-disable-line

  // Reseta o item destacado sempre que a lista muda ou reabre
  useEffect(() => { setDestaque(0) }, [busca, aberto])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selecionar(t: T) {
    onSelect(t)
    setBusca(getLabel(t))
    setAberto(false)
  }
  function limpar() {
    onSelect(null)
    setBusca('')
    setAberto(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!aberto || itens.length === 0) {
      // Nada aberto: deixa o Enter avançar de campo (useEnterToTab)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDestaque(d => Math.min(d + 1, itens.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDestaque(d => Math.max(d - 1, 0))
    } else if (e.key === 'Enter') {
      const alvo = itens[destaque]
      if (alvo) {
        e.preventDefault() // impede o avanço de campo: Enter aqui = selecionar
        selecionar(alvo)
      }
    } else if (e.key === 'Escape') {
      setAberto(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={busca}
          onChange={e => { setBusca(e.target.value); setAberto(true); if (!e.target.value) onSelect(null) }}
          onFocus={() => setAberto(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={`w-full px-3 py-2 pr-8 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
            error ? 'border-red-300 focus:ring-red-400' : 'border-gray-300 focus:ring-primary-500 focus:border-transparent'
          }`}
        />
        {value && (
          <button type="button" tabIndex={-1} onClick={limpar}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>
      {aberto && itens.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {itens.map((t, i) => (
            <li key={getId(t)} onMouseDown={() => selecionar(t)}
              onMouseEnter={() => setDestaque(i)}
              className={`px-3 py-2 cursor-pointer text-sm ${i === destaque ? 'bg-primary-50' : ''}`}>
              <span className="font-medium text-gray-900">{getLabel(t)}</span>
              {getSub && <span className="ml-2 text-xs text-gray-400">{getSub(t)}</span>}
            </li>
          ))}
        </ul>
      )}
      {aberto && busca.trim() !== '' && itens.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
          Nenhum resultado
        </div>
      )}
    </div>
  )
}
