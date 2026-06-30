-- Campos fiscais/operacionais do pedido de venda para emissão de NF-e/NFC-e
ALTER TABLE "pedidos_venda"
  ADD COLUMN "vFrete"           DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vSeguro"          DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vOutros"          DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "modeloNFe"        "ModeloNFe"   NOT NULL DEFAULT 'NFE',
  ADD COLUMN "naturezaOperacao" TEXT          NOT NULL DEFAULT 'Venda de mercadoria',
  ADD COLUMN "modalidadeFrete"  INTEGER       NOT NULL DEFAULT 9;
