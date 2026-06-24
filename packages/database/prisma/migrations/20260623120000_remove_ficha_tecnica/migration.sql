-- Remove a Ficha Técnica (não é mais usada — a produção usa o BOM/ProdutoBom)

-- Tabela filha primeiro (FK para fichas_tecnicas e produtos)
DROP TABLE IF EXISTS "ingredientes_ficha";

-- Tabela principal
DROP TABLE IF EXISTS "fichas_tecnicas";

-- Sequence do código da ficha
DROP SEQUENCE IF EXISTS "ficha_tecnica_codigo_seq";
