import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { LoginPage } from './pages/LoginPage'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ProdutosPage } from './pages/cadastros/ProdutosPage'
import { PessoasPage } from './pages/cadastros/PessoasPage'
import { CategoriasPage } from './pages/cadastros/CategoriasPage'
import { PosicaoEstoquePage } from './pages/estoque/PosicaoEstoquePage'
import { NfEntradaPage } from './pages/estoque/NfEntradaPage'
import { FichasTecnicasPage } from './pages/producao/FichasTecnicasPage'
import { OrdensProducaoPage } from './pages/producao/OrdensProducaoPage'
import { PedidosVendaPage } from './pages/vendas/PedidosVendaPage'
import { NotasFiscaisPage } from './pages/fiscal/NotasFiscaisPage'
import { PlanoContasPage } from './pages/financeiro/PlanoContasPage'
import { DREPage } from './pages/financeiro/DREPage'
import { ContasBancariasPage } from './pages/financeiro/ContasBancariasPage'
import { ExtratoPage } from './pages/financeiro/ExtratoPage'
import { TitulosPage } from './pages/financeiro/TitulosPage'
import { ConciliacaoPage } from './pages/financeiro/ConciliacaoPage'
import { ConfiguracoesPage } from './pages/configuracoes/ConfiguracoesPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="cadastros/produtos" element={<ProdutosPage />} />
          <Route path="cadastros/pessoas" element={<PessoasPage />} />
          <Route path="cadastros/categorias" element={<CategoriasPage />} />
          <Route path="estoque/posicao" element={<PosicaoEstoquePage />} />
          <Route path="estoque/nf-entrada" element={<NfEntradaPage />} />
          <Route path="estoque/movimentacoes" element={<Navigate to="/estoque/posicao" replace />} />
          <Route path="producao/fichas" element={<FichasTecnicasPage />} />
          <Route path="producao/ordens" element={<OrdensProducaoPage />} />
          <Route path="vendas/pedidos" element={<PedidosVendaPage />} />
          <Route path="fiscal/nfe" element={<NotasFiscaisPage />} />
          <Route path="financeiro/contas" element={<PlanoContasPage />} />
          <Route path="financeiro/importar" element={<Navigate to="/financeiro/conciliacao" replace />} />
          <Route path="financeiro/transacoes" element={<Navigate to="/financeiro/conciliacao" replace />} />
          <Route path="financeiro/regras" element={<Navigate to="/financeiro/conciliacao" replace />} />
          <Route path="financeiro/contas-bancarias" element={<ContasBancariasPage />} />
          <Route path="financeiro/extrato/:id" element={<ExtratoPage />} />
          <Route path="financeiro/caixa" element={<ExtratoPage />} />
          <Route path="financeiro/titulos" element={<TitulosPage />} />
          <Route path="financeiro/conciliacao" element={<ConciliacaoPage />} />
          <Route path="financeiro/dre" element={<DREPage />} />
          <Route path="configuracoes" element={<ConfiguracoesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
