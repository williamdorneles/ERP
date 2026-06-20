-- CreateEnum
CREATE TYPE "Aprovisionamento" AS ENUM ('COMPRADO', 'FABRICADO');

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "aprovisionamento" "Aprovisionamento" NOT NULL DEFAULT 'COMPRADO';

-- CreateTable
CREATE TABLE "produto_bom" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "qtdeProduzida" DECIMAL(12,3) NOT NULL,
    "unidadeProduzida" "UnidadeMedida" NOT NULL,
    "tempoPreparo" INTEGER,
    "instrucoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produto_bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto_bom_itens" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "componenteId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,4) NOT NULL,
    "unidade" "UnidadeMedida" NOT NULL,
    "percPerda" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "produto_bom_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "produto_bom_produtoId_key" ON "produto_bom"("produtoId");

-- CreateIndex
CREATE INDEX "produto_bom_itens_bomId_idx" ON "produto_bom_itens"("bomId");

-- AddForeignKey
ALTER TABLE "produto_bom" ADD CONSTRAINT "produto_bom_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_bom_itens" ADD CONSTRAINT "produto_bom_itens_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "produto_bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_bom_itens" ADD CONSTRAINT "produto_bom_itens_componenteId_fkey" FOREIGN KEY ("componenteId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
