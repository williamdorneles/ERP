import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, ChefHat, Pencil, PowerOff, Power, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import { FichaTecnicaForm, type FichaTecnicaData } from '../../components/forms/FichaTecnicaForm'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

const categoriaCor: Record<string, string> = {
  PAO: 'bg-amber-100 text-amber-800',
  BOLO: 'bg-pink-100 text-pink-800',
  DOCE: 'bg-rose-100 text-rose-800',
  SALGADO: 'bg-orange-100 text-orange-800',
  MASSA: 'bg-yellow-100 text-yellow-800',
  RECHEIO: 'bg-purple-100 text-purple-800',
  OUTROS: 'bg-gray-100 text-gray-700',
}

export function FichasTecnicasPage() {
  const queryClient = useQueryClient()
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editando, setEditando] = useState<FichaTecnicaData | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<FichaTecnicaData | null>(null)

  const { data: fichas = [], isLoading } = useQuery<FichaTecnicaData[]>({
    queryKey: ['fichas-tecnicas', mostrarInativos],
    queryFn: () => api.get('/producao/fichas', {
      params: { mostrarInativos: mostrarInativos || undefined },
    }).then(r => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/producao/fichas/${id}/toggle-ativo`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fichas-tecnicas'] })
      setConfirmToggle(null)
    },
  })

  function calcularCusto(ficha: FichaTecnicaData) {
    return ficha.ingredientes.reduce(
      (acc, ing) => acc + Number(ing.quantidade) * Number(ing.produto.custoUnitario),
      0,
    )
  }

  function abrirEdicao(ficha: FichaTecnicaData) {
    setEditando(ficha)
    setPanelOpen(true)
  }

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
              {editando ? `Editar — ${editando.produto.nome}` : 'Nova Ficha Técnica'}
            </h2>
            <p className="text-xs text-gray-400">Fichas Técnicas</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <FichaTecnicaForm
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
          <h2 className="text-2xl font-bold text-gray-900">Fichas Técnicas</h2>
          <p className="text-gray-500 text-sm">{fichas.length} ficha(s) encontrada(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostrarInativos}
              onChange={e => setMostrarInativos(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Mostrar inativas
          </label>
          <button
            onClick={() => { setEditando(null); setPanelOpen(true) }}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} /> Nova Ficha
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Carregando...</div>
      ) : fichas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ChefHat size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Nenhuma ficha técnica cadastrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {fichas.map(ficha => {
            const custo = calcularCusto(ficha)
            return (
              <div key={ficha.id}
                onClick={() => abrirEdicao(ficha)}
                className={clsx(
                  'bg-white rounded-xl border p-5 transition cursor-pointer',
                  ficha.ativo
                    ? 'border-gray-200 hover:border-primary-300 hover:shadow-sm'
                    : 'border-gray-200 opacity-60',
                )}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', categoriaCor[ficha.categoria])}>
                      {ficha.categoria}
                    </span>
                    <h3 className="font-semibold text-gray-900 mt-2">{ficha.produto.nome}</h3>
                    <p className="text-xs text-gray-400 font-mono">{ficha.produto.codigo} · {ficha.codigo}</p>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => abrirEdicao(ficha)}
                      title="Editar"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmToggle(ficha) }}
                      title={ficha.ativo ? 'Desativar' : 'Reativar'}
                      className={clsx(
                        'p-1.5 rounded-lg transition',
                        ficha.ativo
                          ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50',
                      )}
                    >
                      {ficha.ativo ? <PowerOff size={15} /> : <Power size={15} />}
                    </button>
                  </div>
                </div>

                {!ficha.ativo && (
                  <p className="text-xs text-red-500 mb-2 font-medium">● Inativa</p>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm border-t border-gray-100 pt-3 mt-3">
                  <div>
                    <p className="text-gray-400 text-xs">Rendimento</p>
                    <p className="font-semibold text-gray-800">{Number(ficha.rendimento).toFixed(2)} {ficha.unidadeRendimento}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Custo de Produção</p>
                    <p className="font-semibold text-primary-700 tabular-nums">R$ {custo.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Ingredientes</p>
                    <p className="font-semibold text-gray-800">{ficha.ingredientes.length}</p>
                  </div>
                  {ficha.tempoPreparo && (
                    <div>
                      <p className="text-gray-400 text-xs">Tempo Preparo</p>
                      <p className="font-semibold text-gray-800">{ficha.tempoPreparo} min</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.ativo ? 'Desativar Ficha Técnica' : 'Reativar Ficha Técnica'}
        message={
          confirmToggle?.ativo
            ? `Deseja desativar "${confirmToggle?.produto.nome}"? Ela não poderá ser usada em novas ordens.`
            : `Deseja reativar "${confirmToggle?.produto.nome}"?`
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
