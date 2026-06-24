-- Custo real do lote na produção

-- Acumulado na Ordem de Produção (soma dos apontamentos não estornados)
ALTER TABLE "ordens_producao"
  ADD COLUMN "custoRealTotal" DECIMAL(15,4) NOT NULL DEFAULT 0;

-- Custo real de cada apontamento (para rastreabilidade e reversão no estorno)
ALTER TABLE "apontamentos_producao"
  ADD COLUMN "custoReal" DECIMAL(15,4) NOT NULL DEFAULT 0;
