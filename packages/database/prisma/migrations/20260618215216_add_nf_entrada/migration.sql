-- CreateEnum
CREATE TYPE "StatusNfEntrada" AS ENUM ('RASCUNHO', 'CONFIRMADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "movimentacoes_estoque" ADD COLUMN     "custoUnitario" DECIMAL(12,4),
ADD COLUMN     "nfEntradaId" TEXT;

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "custoMedio" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN     "ultimoCusto" DECIMAL(12,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "nf_entradas" (
    "id" TEXT NOT NULL,
    "chaveAcesso" VARCHAR(44),
    "numero" TEXT,
    "serie" TEXT,
    "dataEmissao" DATE NOT NULL,
    "dataEntrada" DATE NOT NULL,
    "fornecedorId" TEXT,
    "fornecedorNome" TEXT NOT NULL,
    "fornecedorCnpj" TEXT,
    "totalProdutos" DECIMAL(15,2) NOT NULL,
    "totalImpostos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalNf" DECIMAL(15,2) NOT NULL,
    "status" "StatusNfEntrada" NOT NULL DEFAULT 'RASCUNHO',
    "observacao" TEXT,
    "xmlOriginal" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nf_entradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_nf_entrada" (
    "id" TEXT NOT NULL,
    "nfEntradaId" TEXT NOT NULL,
    "nItem" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "ncm" TEXT,
    "cfop" TEXT,
    "unidade" TEXT,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "valorUnitario" DECIMAL(15,4) NOT NULL,
    "valorTotal" DECIMAL(15,2) NOT NULL,
    "produtoId" TEXT,

    CONSTRAINT "itens_nf_entrada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nf_entradas_chaveAcesso_key" ON "nf_entradas"("chaveAcesso");

-- CreateIndex
CREATE INDEX "nf_entradas_dataEntrada_idx" ON "nf_entradas"("dataEntrada");

-- CreateIndex
CREATE INDEX "nf_entradas_fornecedorId_idx" ON "nf_entradas"("fornecedorId");

-- CreateIndex
CREATE INDEX "itens_nf_entrada_nfEntradaId_idx" ON "itens_nf_entrada"("nfEntradaId");

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_nfEntradaId_fkey" FOREIGN KEY ("nfEntradaId") REFERENCES "nf_entradas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nf_entradas" ADD CONSTRAINT "nf_entradas_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_nf_entrada" ADD CONSTRAINT "itens_nf_entrada_nfEntradaId_fkey" FOREIGN KEY ("nfEntradaId") REFERENCES "nf_entradas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_nf_entrada" ADD CONSTRAINT "itens_nf_entrada_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_nfEntradaId_fkey" FOREIGN KEY ("nfEntradaId") REFERENCES "nf_entradas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
