-- Transporte e cobrança no Pedido de Venda (vão para a NF-e na emissão)
ALTER TABLE "pedidos_venda"
  ADD COLUMN "transportadora"    TEXT,
  ADD COLUMN "transportadoraDoc" TEXT,
  ADD COLUMN "veiculoPlaca"      TEXT,
  ADD COLUMN "veiculoUf"         CHAR(2),
  ADD COLUMN "volumesQtde"       INTEGER,
  ADD COLUMN "volumesEspecie"    TEXT,
  ADD COLUMN "pesoBruto"         DECIMAL(12,3),
  ADD COLUMN "pesoLiquido"       DECIMAL(12,3),
  ADD COLUMN "parcelasJson"      TEXT;
