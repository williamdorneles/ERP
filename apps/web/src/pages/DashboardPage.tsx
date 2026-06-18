import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ShoppingCart, Package, ChefHat, TrendingUp, AlertTriangle } from 'lucide-react'

interface DashboardData {
  vendasHoje: { total: number; pedidos: number }
  pedidosHoje: number
  topProdutos: Array<{ produtoId: string; _sum: { quantidade: number } }>
}

interface AlertaEstoque {
  id: string
  nome: string
  estoqueAtual: number
  estoqueMinimo: number
  unidadeMedida: string
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/vendas/dashboard').then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: alertas } = useQuery<AlertaEstoque[]>({
    queryKey: ['alertas-estoque'],
    queryFn: () => api.get('/estoque/alertas').then(r => r.data),
  })

  const totalVendas = dashboard?.vendasHoje?.total ?? 0
  const totalPedidos = dashboard?.vendasHoje?.pedidos ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm">Resumo do dia — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Vendas Hoje"
          value={`R$ ${Number(totalVendas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<TrendingUp size={22} className="text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          label="Pedidos Hoje"
          value={String(totalPedidos)}
          icon={<ShoppingCart size={22} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Alertas de Estoque"
          value={String(alertas?.length ?? 0)}
          icon={<Package size={22} className="text-amber-600" />}
          color="bg-amber-50"
        />
        <StatCard
          label="Módulo Produção"
          value="Ativo"
          icon={<ChefHat size={22} className="text-primary-600" />}
          color="bg-primary-50"
        />
      </div>

      {/* Alertas de estoque */}
      {alertas && alertas.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 bg-amber-50 border-b border-amber-200">
            <AlertTriangle size={18} className="text-amber-600" />
            <h3 className="font-semibold text-amber-800">Insumos abaixo do estoque mínimo</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {alertas.map(a => (
              <div key={a.id} className="flex items-center justify-between px-6 py-3">
                <span className="font-medium text-gray-800">{a.nome}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-red-600 font-semibold">
                    {Number(a.estoqueAtual).toFixed(2)} {a.unidadeMedida}
                  </span>
                  <span className="text-gray-400">mín: {Number(a.estoqueMinimo).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bem-vindo */}
      {(!alertas || alertas.length === 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <span className="text-5xl">🍞</span>
          <h3 className="text-lg font-semibold text-gray-800 mt-4">Tudo sob controle!</h3>
          <p className="text-gray-500 text-sm mt-1">Nenhum alerta de estoque no momento. Use o menu lateral para navegar pelos módulos.</p>
        </div>
      )}
    </div>
  )
}
