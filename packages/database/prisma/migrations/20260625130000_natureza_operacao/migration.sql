-- Enums da Natureza de Operação
CREATE TYPE "TipoOperacaoFiscal" AS ENUM ('SAIDA', 'ENTRADA');
CREATE TYPE "FinalidadeNFe" AS ENUM ('NORMAL', 'COMPLEMENTAR', 'AJUSTE', 'DEVOLUCAO');
CREATE TYPE "EfeitoEstoqueOperacao" AS ENUM ('NENHUM', 'SAIDA', 'ENTRADA');

-- Tabela de naturezas de operação (perfil fiscal tipo TES)
CREATE TABLE "naturezas_operacao" (
  "id"                TEXT NOT NULL,
  "codigo"            VARCHAR(20) NOT NULL,
  "descricao"         TEXT NOT NULL,
  "ativo"             BOOLEAN NOT NULL DEFAULT true,
  "tipoOperacao"      "TipoOperacaoFiscal" NOT NULL DEFAULT 'SAIDA',
  "finalidadeNFe"     "FinalidadeNFe" NOT NULL DEFAULT 'NORMAL',
  "modeloPadrao"      "ModeloNFe",
  "cfop"              VARCHAR(5),
  "movimentaEstoque"  "EfeitoEstoqueOperacao" NOT NULL DEFAULT 'SAIDA',
  "geraFinanceiro"    BOOLEAN NOT NULL DEFAULT true,
  "geraReceitaDRE"    BOOLEAN NOT NULL DEFAULT true,
  "contaFinanceiraId" TEXT,
  "csosn"             VARCHAR(4),
  "cstIcms"           VARCHAR(3),
  "aliquotaIcms"      DECIMAL(5,2),
  "cstPis"            VARCHAR(2),
  "aliquotaPis"       DECIMAL(7,4),
  "cstCofins"         VARCHAR(2),
  "aliquotaCofins"    DECIMAL(7,4),
  "cstIpi"            VARCHAR(2),
  "aliquotaIpi"       DECIMAL(7,4),
  "textoComplementar" TEXT,
  "criadoEm"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "naturezas_operacao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "naturezas_operacao_codigo_key" ON "naturezas_operacao"("codigo");
CREATE INDEX "naturezas_operacao_tipoOperacao_ativo_idx" ON "naturezas_operacao"("tipoOperacao", "ativo");
ALTER TABLE "naturezas_operacao" ADD CONSTRAINT "naturezas_operacao_contaFinanceiraId_fkey"
  FOREIGN KEY ("contaFinanceiraId") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Vínculo no pedido de venda
ALTER TABLE "pedidos_venda" ADD COLUMN "naturezaOperacaoId" TEXT;
ALTER TABLE "pedidos_venda" ADD CONSTRAINT "pedidos_venda_naturezaOperacaoId_fkey"
  FOREIGN KEY ("naturezaOperacaoId") REFERENCES "naturezas_operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Finalidade na nota fiscal
ALTER TABLE "notas_fiscais" ADD COLUMN "finNFe" INTEGER NOT NULL DEFAULT 1;
