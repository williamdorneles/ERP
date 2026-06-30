-- Local de entrega do Pedido de Venda (grupo <entrega> da NF-e)
ALTER TABLE "pedidos_venda"
  ADD COLUMN "entregaDiferente"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "entregaCep"         VARCHAR(8),
  ADD COLUMN "entregaLogradouro"  TEXT,
  ADD COLUMN "entregaNumero"      TEXT,
  ADD COLUMN "entregaComplemento" TEXT,
  ADD COLUMN "entregaBairro"      TEXT,
  ADD COLUMN "entregaMunicipio"   TEXT,
  ADD COLUMN "entregaUf"          CHAR(2),
  ADD COLUMN "entregaCodigoIBGE"  VARCHAR(7);
