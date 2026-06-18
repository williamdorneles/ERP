-- CreateEnum
CREATE TYPE "CRT" AS ENUM ('SIMPLES_NACIONAL', 'SIMPLES_EXCESSO', 'REGIME_NORMAL');

-- CreateEnum
CREATE TYPE "AmbienteNFe" AS ENUM ('HOMOLOGACAO', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "ModeloNFe" AS ENUM ('NFE', 'NFCE');

-- CreateEnum
CREATE TYPE "StatusNFe" AS ENUM ('PENDENTE', 'PROCESSANDO', 'AUTORIZADA', 'REJEITADA', 'CANCELADA', 'DENEGADA', 'INUTILIZADA');

-- CreateEnum
CREATE TYPE "ProviderNFe" AS ENUM ('FOCUS_NFE', 'ENOTAS', 'SEFAZ_DIRETO');

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" VARCHAR(8),
ADD COLUMN     "codigoIBGE" VARCHAR(7),
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "ie" TEXT,
ADD COLUMN     "im" TEXT,
ADD COLUMN     "indicadorIE" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "municipio" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "uf" CHAR(2);

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "cfop" VARCHAR(4),
ADD COLUMN     "csosn" VARCHAR(4),
ADD COLUMN     "cstCOFINS" VARCHAR(2),
ADD COLUMN     "cstICMS" VARCHAR(3),
ADD COLUMN     "cstPIS" VARCHAR(2),
ADD COLUMN     "gtin" VARCHAR(14),
ADD COLUMN     "ncm" VARCHAR(8),
ADD COLUMN     "origem" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pCOFINS" DECIMAL(7,4),
ADD COLUMN     "pICMS" DECIMAL(5,2),
ADD COLUMN     "pPIS" DECIMAL(7,4),
ADD COLUMN     "unidadeComercial" VARCHAR(6);

-- CreateTable
CREATE TABLE "empresa" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" VARCHAR(14) NOT NULL,
    "ie" TEXT,
    "im" TEXT,
    "cnae" VARCHAR(7),
    "crt" "CRT" NOT NULL DEFAULT 'SIMPLES_NACIONAL',
    "cep" VARCHAR(8),
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "municipio" TEXT,
    "uf" CHAR(2),
    "codigoIBGE" VARCHAR(7),
    "fone" TEXT,
    "email" TEXT,
    "ambiente" "AmbienteNFe" NOT NULL DEFAULT 'HOMOLOGACAO',
    "proximoNumeroNFe" INTEGER NOT NULL DEFAULT 1,
    "proximoNumeroNFCe" INTEGER NOT NULL DEFAULT 1,
    "serieNFe" INTEGER NOT NULL DEFAULT 1,
    "serieNFCe" INTEGER NOT NULL DEFAULT 1,
    "providerNFe" "ProviderNFe" NOT NULL DEFAULT 'FOCUS_NFE',
    "providerApiKey" TEXT,
    "providerApiUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificados_digitais" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "arquivoBase64" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "validade" TIMESTAMP(3) NOT NULL,
    "serialNumber" TEXT,
    "titular" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificados_digitais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_fiscais" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "serie" INTEGER NOT NULL,
    "modelo" "ModeloNFe" NOT NULL DEFAULT 'NFE',
    "chave" CHAR(44),
    "protocolo" TEXT,
    "status" "StatusNFe" NOT NULL DEFAULT 'PENDENTE',
    "naturezaOperacao" TEXT NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSaida" TIMESTAMP(3),
    "destNome" TEXT NOT NULL,
    "destCpfCnpj" TEXT,
    "destIE" TEXT,
    "destIndicadorIE" INTEGER NOT NULL DEFAULT 9,
    "destCep" TEXT,
    "destLogradouro" TEXT,
    "destNumero" TEXT,
    "destBairro" TEXT,
    "destMunicipio" TEXT,
    "destUf" CHAR(2),
    "destCodigoIBGE" TEXT,
    "vBC" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vICMS" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vIPI" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vPIS" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vCOFINS" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vFrete" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vSeguro" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vDesconto" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vNF" DECIMAL(15,2) NOT NULL,
    "formaPagamento" TEXT NOT NULL DEFAULT '01',
    "xmlAutorizacao" TEXT,
    "xmlCancelamento" TEXT,
    "mensagemSefaz" TEXT,
    "pedidoVendaId" TEXT,
    "referenciaNFe" TEXT,
    "infCpl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_nota_fiscal" (
    "id" TEXT NOT NULL,
    "notaFiscalId" TEXT NOT NULL,
    "nItem" INTEGER NOT NULL,
    "cProd" TEXT NOT NULL,
    "xProd" TEXT NOT NULL,
    "ncm" CHAR(8) NOT NULL,
    "cfop" VARCHAR(4) NOT NULL,
    "uCom" VARCHAR(6) NOT NULL,
    "qCom" DECIMAL(15,4) NOT NULL,
    "vUnCom" DECIMAL(15,4) NOT NULL,
    "vProd" DECIMAL(15,2) NOT NULL,
    "gtin" VARCHAR(14),
    "origem" INTEGER NOT NULL DEFAULT 0,
    "csosn" VARCHAR(4),
    "cstICMS" VARCHAR(3),
    "vBCICMS" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pICMS" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vICMS" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cstPIS" VARCHAR(2),
    "vBCPIS" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pPIS" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "vPIS" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cstCOFINS" VARCHAR(2),
    "vBCCOFINS" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pCOFINS" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "vCOFINS" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "itens_nota_fiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_nfe" (
    "id" TEXT NOT NULL,
    "notaFiscalId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "protocolo" TEXT,
    "xmlEvento" TEXT,
    "xmlRetorno" TEXT,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_nfe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_cnpj_key" ON "empresa"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_digitais_empresaId_key" ON "certificados_digitais"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_fiscais_chave_key" ON "notas_fiscais"("chave");

-- AddForeignKey
ALTER TABLE "certificados_digitais" ADD CONSTRAINT "certificados_digitais_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_pedidoVendaId_fkey" FOREIGN KEY ("pedidoVendaId") REFERENCES "pedidos_venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_nota_fiscal" ADD CONSTRAINT "itens_nota_fiscal_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "notas_fiscais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_nfe" ADD CONSTRAINT "eventos_nfe_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "notas_fiscais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
