-- AlterTable: adiciona campos de encargos na baixa de parcelas
ALTER TABLE "parcelas_financeiras"
  ADD COLUMN "juros" DECIMAL(15,2),
  ADD COLUMN "multa" DECIMAL(15,2),
  ADD COLUMN "taxas" DECIMAL(15,2);
