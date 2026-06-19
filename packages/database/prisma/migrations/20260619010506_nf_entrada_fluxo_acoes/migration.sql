-- AlterTable
ALTER TABLE "itens_nf_entrada" ADD COLUMN     "cProd" TEXT,
ADD COLUMN     "produtoNovo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "nf_entradas" ADD COLUMN     "custoFormado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estoqueElancado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "financeiroLancado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parcelasJson" TEXT;
