-- Cria sequência e adiciona número de documento nos títulos financeiros
CREATE SEQUENCE "titulos_financeiros_numero_seq" START 1;

ALTER TABLE "titulos_financeiros"
  ADD COLUMN "numero" INTEGER NOT NULL DEFAULT nextval('"titulos_financeiros_numero_seq"');

ALTER TABLE "titulos_financeiros"
  ADD CONSTRAINT "titulos_financeiros_numero_key" UNIQUE ("numero");
