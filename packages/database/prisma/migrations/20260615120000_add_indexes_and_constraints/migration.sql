-- Índices de performance em movimentacoes_estoque
CREATE INDEX IF NOT EXISTS "movimentacoes_estoque_produtoId_idx" ON "movimentacoes_estoque"("produtoId");
CREATE INDEX IF NOT EXISTS "movimentacoes_estoque_tipo_criadoEm_idx" ON "movimentacoes_estoque"("tipo", "criadoEm");

-- Índices de performance em ordens_producao
CREATE INDEX IF NOT EXISTS "ordens_producao_dataProducao_status_idx" ON "ordens_producao"("dataProducao", "status");
CREATE INDEX IF NOT EXISTS "ordens_producao_fichaTecnicaId_idx" ON "ordens_producao"("fichaTecnicaId");

-- Índices de performance em pedidos_venda
CREATE INDEX IF NOT EXISTS "pedidos_venda_status_criadoEm_idx" ON "pedidos_venda"("status", "criadoEm");
CREATE INDEX IF NOT EXISTS "pedidos_venda_canal_idx" ON "pedidos_venda"("canal");
CREATE INDEX IF NOT EXISTS "pedidos_venda_pessoaId_idx" ON "pedidos_venda"("pessoaId");

-- Índices de performance em notas_fiscais
CREATE INDEX IF NOT EXISTS "notas_fiscais_status_dataEmissao_idx" ON "notas_fiscais"("status", "dataEmissao");
CREATE INDEX IF NOT EXISTS "notas_fiscais_pedidoVendaId_idx" ON "notas_fiscais"("pedidoVendaId");

-- Constraint de unicidade: número de NF-e único por empresa/série/modelo (obrigação fiscal)
CREATE UNIQUE INDEX IF NOT EXISTS "notas_fiscais_empresaId_numero_serie_modelo_key"
  ON "notas_fiscais"("empresaId", "numero", "serie", "modelo");

-- Índices de performance em transacoes_financeiras
CREATE INDEX IF NOT EXISTS "transacoes_financeiras_data_contaBancariaId_idx" ON "transacoes_financeiras"("data", "contaBancariaId");
CREATE INDEX IF NOT EXISTS "transacoes_financeiras_status_idx" ON "transacoes_financeiras"("status");

-- Constraint de unicidade: CPF/CNPJ único por pessoa
-- ATENÇÃO: só aplicar se não houver documentos duplicados (verificar antes)
CREATE UNIQUE INDEX IF NOT EXISTS "pessoas_documento_key"
  ON "pessoas"("documento") WHERE "documento" IS NOT NULL;

-- Sequence para geração atômica do número de NF-e (evita race condition)
CREATE SEQUENCE IF NOT EXISTS nfe_numero_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

-- Sequence para NFC-e
CREATE SEQUENCE IF NOT EXISTS nfce_numero_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;
