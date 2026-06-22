-- Recria sequences usadas pela aplicação que estavam ausentes no banco.
-- Idempotente (IF NOT EXISTS) e alinhada com os dados já existentes via setval.

CREATE SEQUENCE IF NOT EXISTS ordem_producao_numero_seq START 1;
CREATE SEQUENCE IF NOT EXISTS ficha_tecnica_codigo_seq START 1;
CREATE SEQUENCE IF NOT EXISTS pedido_venda_numero_seq START 1;
CREATE SEQUENCE IF NOT EXISTS pessoa_codigo_seq START 1;

-- Alinha cada sequence com o maior número/código já existente.
-- setval(seq, n, is_called): is_called=true => próximo nextval retorna n+1;
-- is_called=false => próximo nextval retorna n. Garante continuidade sem colisão.
DO $$
DECLARE
  m INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(numero, '\D', '', 'g'), '') AS INTEGER)), 0)
    INTO m FROM ordens_producao;
  PERFORM setval('ordem_producao_numero_seq', GREATEST(m, 1), m > 0);

  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '') AS INTEGER)), 0)
    INTO m FROM fichas_tecnicas;
  PERFORM setval('ficha_tecnica_codigo_seq', GREATEST(m, 1), m > 0);

  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(numero, '\D', '', 'g'), '') AS INTEGER)), 0)
    INTO m FROM pedidos_venda;
  PERFORM setval('pedido_venda_numero_seq', GREATEST(m, 1), m > 0);

  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '') AS INTEGER)), 0)
    INTO m FROM pessoas;
  PERFORM setval('pessoa_codigo_seq', GREATEST(m, 1), m > 0);
END $$;
