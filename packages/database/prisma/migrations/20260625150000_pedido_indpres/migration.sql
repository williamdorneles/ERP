-- Indicador de presença do comprador (NF-e ide/indPres)
ALTER TABLE "pedidos_venda" ADD COLUMN "indPres" INTEGER NOT NULL DEFAULT 1;
