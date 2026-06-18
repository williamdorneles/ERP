-- Sequences para geração atômica de códigos/números (evitam race condition com count())

CREATE SEQUENCE IF NOT EXISTS ficha_tecnica_codigo_seq
  START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS ordem_producao_numero_seq
  START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS pessoa_codigo_seq
  START WITH 1 INCREMENT BY 1 NO CYCLE;

-- Índices para queries do DRE e busca de transações similares

CREATE INDEX IF NOT EXISTS "transacoes_financeiras_contaFinanceiraId_data_idx"
  ON "transacoes_financeiras"("contaFinanceiraId", "data" DESC);

CREATE INDEX IF NOT EXISTS "transacoes_financeiras_nomeOriginal_idx"
  ON "transacoes_financeiras"("nomeOriginal");
