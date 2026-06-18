import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import { PedidoVendaForm } from '../../components/forms/PedidoVendaForm'

interface PedidoVenda {
  id: string; numero: string; canal: string; status: string
  total: number; formaPagamento: string; criadoEm: string
  pessoa?: { nome: string }
  itens: Array<{ id: string }>
}

const statusCor: Record<string, string> = {
  ABERTO: 'bg-blue-100 text-blue-700',
  CONFIRMADO: 'bg-cyan-100 text-cyan-700',
  EM_PREPARO: 'bg-amber-100 text-amber-700',
  ENTREGUE: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-red-100 text-red-700',
}

const canalCor: Record<string, string> = {
  BALCAO: 'bg-gray-100 text-gray-600',
  ATACADO: 'bg-purple-100 text-purple-700',
  DELIVERY: 'bg-blue-100 text-blue-700',
  ONLINE: 'bg-indigo-100 text-indigo-700',
}

export function PedidosVendaPage() {
  const [panelOpen, setPanelOpen] = useState(false)

  const { data: pedidos = [], isLoading } = useQuery<PedidoVenda[]>({
    queryKey: ['pedidos-venda'],
    queryFn: () => api.get('/vendas/pedidos').then(r => r.data),
  })

  const totalDia = pedidos
    .filter(p => p.status !== 'CANCELADO')
    .reduce((a, p) => a + Number(p.total), 0)

  if (panelOpen) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setPanelOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Novo Pedido de Venda</h2>
            <p className="text-xs text-gray-400">Pedidos de Venda</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <PedidoVendaForm
            onSuccess={() => setPanelOpen(false)}
            onCancel={() => setPanelOpen(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pedidos de Venda</h2>
          <p className="text-gray-500 text-sm">
            {pedidos.length} pedidos · Total: <span className="font-semibold text-gray-700">R$ {totalDia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </p>
        </div>
        <button
          onClick={() => setPanelOpen(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Novo Pedido
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Nº Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3 text-right">Itens</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pedidos.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700">{p.numero}</td>
                  <td className="px-4 py-3 text-gray-800">{p.pessoa?.nome ?? 'Consumidor Final'}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', canalCor[p.canal])}>
                      {p.canal}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.itens.length}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    R$ {Number(p.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.formaPagamento}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(p.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', statusCor[p.status])}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
              {pedidos.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">Nenhum pedido encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}
