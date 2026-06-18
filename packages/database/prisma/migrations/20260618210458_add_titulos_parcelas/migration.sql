-- CreateEnum
CREATE TYPE "TipoTitulo" AS ENUM ('PAGAR', 'RECEBER');

-- CreateEnum
CREATE TYPE "StatusTitulo" AS ENUM ('ABERTO', 'PARCIAL', 'QUITADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusParcela" AS ENUM ('ABERTO', 'QUITADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "titulos_financeiros" (
    "id" TEXT NOT NULL,
    "tipo" "TipoTitulo" NOT NULL,
    "descricao" TEXT NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "status" "StatusTitulo" NOT NULL DEFAULT 'ABERTO',
    "pessoaId" TEXT,
    "pedidoVendaId" TEXT,
    "nfEntradaId" TEXT,
    "contaFinanceiraId" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "titulos_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcelas_financeiras" (
    "id" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "status" "StatusParcela" NOT NULL DEFAULT 'ABERTO',
    "dataBaixa" DATE,
    "valorPago" DECIMAL(15,2),
    "contaBancariaId" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcelas_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "titulos_financeiros_tipo_status_idx" ON "titulos_financeiros"("tipo", "status");

-- CreateIndex
CREATE INDEX "titulos_financeiros_pessoaId_idx" ON "titulos_financeiros"("pessoaId");

-- CreateIndex
CREATE INDEX "parcelas_financeiras_tituloId_idx" ON "parcelas_financeiras"("tituloId");

-- CreateIndex
CREATE INDEX "parcelas_financeiras_vencimento_status_idx" ON "parcelas_financeiras"("vencimento", "status");

-- AddForeignKey
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_pedidoVendaId_fkey" FOREIGN KEY ("pedidoVendaId") REFERENCES "pedidos_venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcelas_financeiras" ADD CONSTRAINT "parcelas_financeiras_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "titulos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcelas_financeiras" ADD CONSTRAINT "parcelas_financeiras_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "contas_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
