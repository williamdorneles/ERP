/*
  Warnings:

  - You are about to drop the `produto_fornecedores` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "produto_fornecedores" DROP CONSTRAINT "produto_fornecedores_fornecedorId_fkey";

-- DropForeignKey
ALTER TABLE "produto_fornecedores" DROP CONSTRAINT "produto_fornecedores_produtoId_fkey";

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "codigoFornecedor" TEXT,
ADD COLUMN     "fornecedorId" TEXT;

-- DropTable
DROP TABLE "produto_fornecedores";

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
