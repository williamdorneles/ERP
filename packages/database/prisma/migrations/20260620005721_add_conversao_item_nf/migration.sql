-- AlterTable
ALTER TABLE "itens_nf_entrada" ADD COLUMN     "fatorConversao" DECIMAL(10,4),
ADD COLUMN     "operacaoConversao" "ConversaoUnidade";
