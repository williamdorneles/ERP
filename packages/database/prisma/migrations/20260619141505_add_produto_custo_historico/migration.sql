-- CreateEnum
CREATE TYPE "MotivoCusto" AS ENUM ('MANUAL', 'NF_ENTRADA', 'FORMACAO_CUSTO', 'ESTORNO_NF', 'BOM');

-- CreateTable
CREATE TABLE "produto_custos" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "custo" DECIMAL(12,4) NOT NULL,
    "motivo" "MotivoCusto" NOT NULL,
    "nfEntradaId" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produto_custos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "produto_custos_produtoId_criadoEm_idx" ON "produto_custos"("produtoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "produto_custos" ADD CONSTRAINT "produto_custos_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_custos" ADD CONSTRAINT "produto_custos_nfEntradaId_fkey" FOREIGN KEY ("nfEntradaId") REFERENCES "nf_entradas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
