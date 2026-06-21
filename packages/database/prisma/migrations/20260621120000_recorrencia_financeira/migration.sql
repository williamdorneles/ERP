-- CreateTable RecorrenciaFinanceira
CREATE TABLE "recorrencias_financeiras" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "diaVencimento" INTEGER NOT NULL,
    "pessoaId" TEXT,
    "contaFinanceiraId" TEXT,
    "observacao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recorrencias_financeiras_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey recorrencias → pessoas
ALTER TABLE "recorrencias_financeiras" ADD CONSTRAINT "recorrencias_financeiras_pessoaId_fkey"
    FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey recorrencias → contas_financeiras
ALTER TABLE "recorrencias_financeiras" ADD CONSTRAINT "recorrencias_financeiras_contaFinanceiraId_fkey"
    FOREIGN KEY ("contaFinanceiraId") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable titulos_financeiros — adiciona campos de recorrência
ALTER TABLE "titulos_financeiros" ADD COLUMN "recorrenciaId" TEXT;
ALTER TABLE "titulos_financeiros" ADD COLUMN "recorrenciaOrdem" INTEGER;

-- AddForeignKey titulos → recorrencias
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_recorrenciaId_fkey"
    FOREIGN KEY ("recorrenciaId") REFERENCES "recorrencias_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "titulos_financeiros_recorrenciaId_idx" ON "titulos_financeiros"("recorrenciaId");
