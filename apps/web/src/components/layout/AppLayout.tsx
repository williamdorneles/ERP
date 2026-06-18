import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Package, ArrowLeftRight,
  ChefHat, ShoppingCart, Users, LogOut, Menu, X, ChevronDown,
  AlertTriangle, Receipt, BookOpen, DollarSign,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import clsx from 'clsx'

interface NavItem {
  label: string
  icon: React.ReactNode
  href?: string
  children?: { label: string; href: string }[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18} />, href: '/' },
  {
    label: 'Cadastros',
    icon: <BookOpen size={18} />,
    children: [
      { label: 'Produtos & Insumos', href: '/cadastros/produtos' },
      { label: 'Clientes & Fornecedores', href: '/cadastros/pessoas' },
    ],
  },
  { label: 'Estoque', icon: <Package size={18} />, href: '/estoque/posicao' },
  {
    label: 'Produção',
    icon: <ChefHat size={18} />,
    children: [
      { label: 'Fichas Técnicas', href: '/producao/fichas' },
      { label: 'Ordens de Produção', href: '/producao/ordens' },
    ],
  },
  {
    label: 'Vendas',
    icon: <ShoppingCart size={18} />,
    children: [
      { label: 'Pedidos', href: '/vendas/pedidos' },
    ],
  },
  {
    label: 'Fiscal',
    icon: <Receipt size={18} />,
    children: [
      { label: 'NF-e / NFC-e', href: '/fiscal/nfe' },
      { label: 'Configuração', href: '/fiscal/config' },
    ],
  },
  {
    label: 'Financeiro',
    icon: <DollarSign size={18} />,
    children: [
      { label: 'Plano de Contas', href: '/financeiro/contas' },
      { label: 'Importar OFX', href: '/financeiro/importar' },
      { label: 'Transações', href: '/financeiro/transacoes' },
      { label: 'Regras', href: '/financeiro/regras' },
      { label: 'DRE', href: '/financeiro/dre' },
    ],
  },
]

function NavGroup({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false)

  if (item.href) {
    return (
      <NavLink
        to={item.href}
        end
        className={({ isActive }) => clsx(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
          isActive
            ? 'bg-primary-600 text-white'
            : 'text-gray-300 hover:bg-gray-700 hover:text-white',
        )}
      >
        {item.icon}
        {item.label}
      </NavLink>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition"
      >
        {item.icon}
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown size={14} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="ml-7 mt-1 space-y-1">
          {item.children?.map(child => (
            <NavLink
              key={child.href}
              to={child.href}
              className={({ isActive }) => clsx(
                'block px-3 py-1.5 rounded-lg text-sm transition',
                isActive
                  ? 'bg-primary-600 text-white font-medium'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white',
              )}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { usuario, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col bg-gray-900 transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-0 overflow-hidden',
      )}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-700">
          <span className="text-2xl">🍞</span>
          <div>
            <p className="text-white font-bold text-sm leading-tight">ERP Panificação</p>
            <p className="text-gray-400 text-xs">Gestão Industrial</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map(item => (
            <NavGroup key={item.label} item={item} />
          ))}
        </nav>

        {/* Alerta de estoque */}
        <div className="px-3 pb-2">
          <NavLink
            to="/estoque/posicao"
            className="flex items-center gap-2 px-3 py-2 bg-amber-900/40 border border-amber-700/40 rounded-lg text-amber-300 text-xs hover:bg-amber-900/60 transition"
          >
            <AlertTriangle size={14} />
            Verificar alertas de estoque
          </NavLink>
        </div>

        {/* User */}
        <div className="border-t border-gray-700 px-3 py-4">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {usuario?.nome[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{usuario?.nome}</p>
              <p className="text-gray-400 text-xs truncate">{usuario?.perfil}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg text-sm transition"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-gray-800 font-semibold">ERP Panificação</h1>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto scrollbar-hide p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
