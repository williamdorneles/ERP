-- Cabeçalho comercial do Pedido de Venda
ALTER TABLE "pedidos_venda"
  ADD COLUMN "dataEmissao"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "previsaoEntrega"  TIMESTAMP(3),
  ADD COLUMN "validadeProposta" TIMESTAMP(3),
  ADD COLUMN "pedidoCliente"    TEXT;
