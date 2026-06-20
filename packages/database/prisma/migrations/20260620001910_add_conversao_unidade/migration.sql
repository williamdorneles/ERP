-- CreateEnum
CREATE TYPE "ConversaoUnidade" AS ENUM ('MULTIPLICAR', 'DIVIDIR');

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "fatorConversao" DECIMAL(10,4),
ADD COLUMN     "operacaoConversao" "ConversaoUnidade";
