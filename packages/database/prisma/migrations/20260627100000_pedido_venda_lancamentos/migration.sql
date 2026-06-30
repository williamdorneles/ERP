-- Flags de controle de lançamento no pedido de venda (mesmo padrão da NF de entrada)
ALTER TABLE pedidos_venda ADD COLUMN "estoqueElancado"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pedidos_venda ADD COLUMN "financeiroLancado" BOOLEAN NOT NULL DEFAULT false;

-- Vínculo de movimentações de estoque ao pedido de venda (para estorno rastreável)
ALTER TABLE movimentacoes_estoque ADD COLUMN "pedidoVendaId" TEXT;
ALTER TABLE movimentacoes_estoque
  ADD CONSTRAINT "movimentacoes_estoque_pedidoVendaId_fkey"
  FOREIGN KEY ("pedidoVendaId") REFERENCES pedidos_venda(id) ON DELETE SET NULL;
CREATE INDEX "movimentacoes_estoque_pedidoVendaId_idx" ON movimentacoes_estoque("pedidoVendaId");
