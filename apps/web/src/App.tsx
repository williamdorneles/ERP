import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { LoginPage } from './pages/LoginPage'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ProdutosPage } from './pages/cadastros/ProdutosPage'
import { PessoasPage } from './pages/cadastros/PessoasPage'
import { PosicaoEstoquePage } from './pages/estoque/PosicaoEstoquePage'
import { FichasTecnicasPage } from './pages/producao/FichasTecnicasPage'
import { OrdensProducaoPage } from './pages/producao/OrdensProducaoPage'
import { PedidosVendaPage } from './pages/vendas/PedidosVendaPage'
import { ConfigFiscalPage } from './pages/fiscal/ConfigFiscalPage'
import { NotasFiscaisPage } from './pages/fiscal/NotasFiscaisPage'
import { PlanoContasPage } from './pages/financeiro/PlanoContasPage'
import { ImportacaoOFXPage } from './pages/financeiro/ImportacaoOFXPage'
import { TransacoesPage } from './pages/financeiro/TransacoesPage'
import { RegrasClassificacaoPage } from './pages/financeiro/RegrasClassificacaoPage'
import { DREPage } from './pages/financeiro/DREPage'

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
          <Route path="estoque/posicao" element={<PosicaoEstoquePage />} />
          <Route path="estoque/movimentacoes" element={<Navigate to="/estoque/posicao" replace />} />
          <Route path="producao/fichas" element={<FichasTecnicasPage />} />
          <Route path="producao/ordens" element={<OrdensProducaoPage />} />
          <Route path="vendas/pedidos" element={<PedidosVendaPage />} />
          <Route path="fiscal/config" element={<ConfigFiscalPage />} />
          <Route path="fiscal/nfe" element={<NotasFiscaisPage />} />
          <Route path="financeiro/contas" element={<PlanoContasPage />} />
          <Route path="financeiro/importar" element={<ImportacaoOFXPage />} />
          <Route path="financeiro/transacoes" element={<TransacoesPage />} />
          <Route path="financeiro/regras" element={<RegrasClassificacaoPage />} />
          <Route path="financeiro/dre" element={<DREPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
