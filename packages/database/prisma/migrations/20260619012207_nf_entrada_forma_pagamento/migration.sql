-- AlterTable
ALTER TABLE "nf_entradas" ADD COLUMN     "contaBancariaId" TEXT,
ADD COLUMN     "formaPagamento" TEXT NOT NULL DEFAULT 'PRAZO';

-- AddForeignKey
ALTER TABLE "nf_entradas" ADD CONSTRAINT "nf_entradas_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "contas_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
