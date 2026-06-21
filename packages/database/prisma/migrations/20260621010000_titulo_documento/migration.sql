-- Remove numero sequencial (não é o conceito correto)
ALTER TABLE "titulos_financeiros" DROP CONSTRAINT IF EXISTS "titulos_financeiros_numero_key";
ALTER TABLE "titulos_financeiros" DROP COLUMN IF EXISTS "numero";
DROP SEQUENCE IF EXISTS "titulos_financeiros_numero_seq";

-- Adiciona campo documento (número da NF ou documento externo, opcional)
ALTER TABLE "titulos_financeiros" ADD COLUMN "documento" TEXT;
