/*
  Warnings:

  - You are about to drop the column `contaBancariaId` on the `nf_entradas` table. All the data in the column will be lost.
  - You are about to drop the column `formaPagamento` on the `nf_entradas` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "nf_entradas" DROP CONSTRAINT "nf_entradas_contaBancariaId_fkey";

-- AlterTable
ALTER TABLE "nf_entradas" DROP COLUMN "contaBancariaId",
DROP COLUMN "formaPagamento",
ADD COLUMN     "contaFinanceiraId" TEXT;

-- AddForeignKey
ALTER TABLE "nf_entradas" ADD CONSTRAINT "nf_entradas_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
