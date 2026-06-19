-- CreateTable
CREATE TABLE "produto_fornecedores" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "codigoNf" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produto_fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "produto_fornecedores_codigoNf_idx" ON "produto_fornecedores"("codigoNf");

-- CreateIndex
CREATE UNIQUE INDEX "produto_fornecedores_codigoNf_fornecedorId_key" ON "produto_fornecedores"("codigoNf", "fornecedorId");

-- AddForeignKey
ALTER TABLE "produto_fornecedores" ADD CONSTRAINT "produto_fornecedores_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_fornecedores" ADD CONSTRAINT "produto_fornecedores_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
