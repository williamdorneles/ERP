-- AlterTable
ALTER TABLE "contas_bancarias" ADD COLUMN     "isCaixa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "saldoInicial" DECIMAL(15,2) NOT NULL DEFAULT 0;
