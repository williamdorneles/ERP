-- AlterTable: rastreio de origem em baixa parcial de parcelas
ALTER TABLE "parcelas_financeiras"
  ADD COLUMN "parcelaOrigemId" TEXT;

ALTER TABLE "parcelas_financeiras"
  ADD CONSTRAINT "parcelas_financeiras_parcelaOrigemId_fkey"
  FOREIGN KEY ("parcelaOrigemId")
  REFERENCES "parcelas_financeiras"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
