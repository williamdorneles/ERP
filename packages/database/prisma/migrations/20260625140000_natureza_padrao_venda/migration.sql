-- Natureza padrão para novos pedidos de venda (apenas uma, e só de saída)
ALTER TABLE "naturezas_operacao" ADD COLUMN "padraoVenda" BOOLEAN NOT NULL DEFAULT false;
