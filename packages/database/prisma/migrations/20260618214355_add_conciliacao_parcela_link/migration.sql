-- AlterTable
ALTER TABLE "transacoes_financeiras" ADD COLUMN     "parcelaFinanceiraId" TEXT;

-- CreateIndex
CREATE INDEX "transacoes_financeiras_parcelaFinanceiraId_idx" ON "transacoes_financeiras"("parcelaFinanceiraId");

-- AddForeignKey
ALTER TABLE "transacoes_financeiras" ADD CONSTRAINT "transacoes_financeiras_parcelaFinanceiraId_fkey" FOREIGN KEY ("parcelaFinanceiraId") REFERENCES "parcelas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
