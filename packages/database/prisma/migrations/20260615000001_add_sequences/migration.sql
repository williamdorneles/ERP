-- Sequence para geração atômica do número de pedidos de venda (evita race condition)
CREATE SEQUENCE IF NOT EXISTS pedido_venda_numero_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

-- Sequence para geração atômica do código de produto
CREATE SEQUENCE IF NOT EXISTS produto_codigo_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;
