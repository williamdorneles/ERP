-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('ADMIN', 'GERENTE', 'PRODUCAO', 'VENDAS', 'FINANCEIRO', 'ESTOQUE');

-- CreateEnum
CREATE TYPE "TipoProduto" AS ENUM ('INSUMO', 'PRODUTO_ACABADO', 'INSUMO_PRODUTO');

-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('FARINHA', 'GORDURA', 'ACUCAR', 'FERMENTO', 'LATICINIOS', 'OVOS', 'EMBALAGEM', 'PAO', 'BOLO', 'DOCE', 'SALGADO', 'MASSA', 'RECHEIO', 'OUTROS');

-- CreateEnum
CREATE TYPE "UnidadeMedida" AS ENUM ('KG', 'G', 'L', 'ML', 'UN', 'CX', 'PCT');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA');

-- CreateEnum
CREATE TYPE "StatusOrdem" AS ENUM ('PLANEJADA', 'EM_PRODUCAO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANHA', 'TARDE', 'NOITE');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('CLIENTE', 'FORNECEDOR', 'AMBOS');

-- CreateEnum
CREATE TYPE "TipoLegal" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "CanalVenda" AS ENUM ('BALCAO', 'ATACADO', 'DELIVERY', 'ONLINE');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('ABERTO', 'CONFIRMADO', 'EM_PREPARO', 'ENTREGUE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'CREDITO', 'DEBITO', 'PIX', 'PRAZO');

-- CreateEnum
CREATE TYPE "StatusPedidoCompra" AS ENUM ('RASCUNHO', 'ENVIADO', 'CONFIRMADO', 'RECEBIDO', 'CANCELADO');

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

-- CreateEnum
CREATE TYPE "TipoContaFinanceira" AS ENUM ('RECEITA', 'CUSTO', 'DESPESA', 'NAO_OPERACIONAL');

-- CreateEnum
CREATE TYPE "NaturezaConta" AS ENUM ('DEBITO', 'CREDITO');

-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('DEBITO', 'CREDITO');

-- CreateEnum
CREATE TYPE "StatusTransacao" AS ENUM ('PENDENTE', 'SUGERIDO', 'CLASSIFICADO', 'REVISADO');

-- CreateEnum
CREATE TYPE "StatusImportacao" AS ENUM ('PROCESSANDO', 'CONCLUIDO', 'ERRO');

-- CreateEnum
CREATE TYPE "CampoRegra" AS ENUM ('NOME', 'MEMO', 'NOME_OU_MEMO', 'VALOR');

-- CreateEnum
CREATE TYPE "TipoCorrespondencia" AS ENUM ('CONTEM', 'COMECA_COM', 'TERMINA_COM', 'IGUAL', 'REGEX', 'INTERVALO');

-- CreateEnum
CREATE TYPE "TipoTransacaoRegra" AS ENUM ('QUALQUER', 'DEBITO', 'CREDITO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'PRODUCAO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_refresh" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_refresh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoProduto" NOT NULL DEFAULT 'INSUMO',
    "categoria" "Categoria",
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "unidadeMedida" "UnidadeMedida" NOT NULL DEFAULT 'UN',
    "estoqueAtual" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "estoqueMinimo" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "custoUnitario" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "precoVenda" DECIMAL(12,2),
    "ncm" VARCHAR(8),
    "cfop" VARCHAR(4),
    "origem" INTEGER NOT NULL DEFAULT 0,
    "csosn" VARCHAR(4),
    "cstICMS" VARCHAR(3),
    "cstPIS" VARCHAR(2),
    "cstCOFINS" VARCHAR(2),
    "pICMS" DECIMAL(5,2),
    "pPIS" DECIMAL(7,4),
    "pCOFINS" DECIMAL(7,4),
    "unidadeComercial" VARCHAR(6),
    "gtin" VARCHAR(14),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_estoque" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "apontamentoId" TEXT,
    "tipo" "TipoMovimentacao" NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "lote" TEXT,
    "dataVencimento" TIMESTAMP(3),
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichas_tecnicas" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "produtoId" TEXT NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "rendimento" DECIMAL(12,3) NOT NULL,
    "unidadeRendimento" "UnidadeMedida" NOT NULL,
    "tempoPreparo" INTEGER,
    "tempoFermentacao" INTEGER,
    "temperaturaForno" INTEGER,
    "instrucoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fichas_tecnicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredientes_ficha" (
    "id" TEXT NOT NULL,
    "fichaTecnicaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "unidadeMedida" "UnidadeMedida" NOT NULL,
    "observacao" TEXT,

    CONSTRAINT "ingredientes_ficha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_producao" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fichaTecnicaId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "quantidadeProduzida" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "status" "StatusOrdem" NOT NULL DEFAULT 'PLANEJADA',
    "turno" "Turno" NOT NULL,
    "dataProducao" TIMESTAMP(3) NOT NULL,
    "responsavelId" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordens_producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apontamentos_producao" (
    "id" TEXT NOT NULL,
    "ordemProducaoId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "observacao" TEXT,
    "estornado" BOOLEAN NOT NULL DEFAULT false,
    "estornadoEm" TIMESTAMP(3),
    "observacaoEstorno" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apontamentos_producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoas" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "tipo" "TipoPessoa" NOT NULL DEFAULT 'CLIENTE',
    "tipoLegal" "TipoLegal" NOT NULL DEFAULT 'PF',
    "nome" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "documento" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "limiteCredito" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ie" TEXT,
    "im" TEXT,
    "indicadorIE" INTEGER NOT NULL DEFAULT 9,
    "cep" VARCHAR(8),
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "municipio" TEXT,
    "uf" CHAR(2),
    "codigoIBGE" VARCHAR(7),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pessoas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_venda" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "pessoaId" TEXT,
    "canal" "CanalVenda" NOT NULL DEFAULT 'BALCAO',
    "status" "StatusPedido" NOT NULL DEFAULT 'ABERTO',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL DEFAULT 'DINHEIRO',
    "vendedorId" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_pedido_venda" (
    "id" TEXT NOT NULL,
    "pedidoVendaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "precoUnitario" DECIMAL(12,2) NOT NULL,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "itens_pedido_venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_compra" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "status" "StatusPedidoCompra" NOT NULL DEFAULT 'RASCUNHO',
    "total" DECIMAL(12,2) NOT NULL,
    "previsaoEntrega" TIMESTAMP(3),
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_pedido_compra" (
    "id" TEXT NOT NULL,
    "pedidoCompraId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "precoUnitario" DECIMAL(12,4) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "itens_pedido_compra_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "contas_financeiras" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoContaFinanceira" NOT NULL,
    "natureza" "NaturezaConta" NOT NULL,
    "contaPaiId" TEXT,
    "isAnalitica" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "codigoCompleto" VARCHAR(50),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contas_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_bancarias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "ofxBancoId" TEXT,
    "ofxContaId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacoes_financeiras" (
    "id" TEXT NOT NULL,
    "contaBancariaId" TEXT NOT NULL,
    "fitid" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "descricao" TEXT,
    "nomeOriginal" TEXT,
    "memoOriginal" TEXT,
    "contaFinanceiraId" TEXT,
    "fonteClassificacao" TEXT,
    "confiancaClassificacao" DECIMAL(4,3),
    "status" "StatusTransacao" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transacoes_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacoes_ofx" (
    "id" TEXT NOT NULL,
    "contaBancariaId" TEXT,
    "arquivo" TEXT NOT NULL,
    "status" "StatusImportacao" NOT NULL DEFAULT 'PROCESSANDO',
    "totalTransacoes" INTEGER NOT NULL DEFAULT 0,
    "novas" INTEGER NOT NULL DEFAULT 0,
    "duplicadas" INTEGER NOT NULL DEFAULT 0,
    "classificadas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importacoes_ofx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_classificacao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "prioridade" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "campo" "CampoRegra" NOT NULL,
    "tipoCorrespondencia" "TipoCorrespondencia" NOT NULL,
    "valorCorrespondencia" TEXT,
    "valorMin" DECIMAL(15,2),
    "valorMax" DECIMAL(15,2),
    "tipoTransacao" "TipoTransacaoRegra" NOT NULL DEFAULT 'QUALQUER',
    "contaFinanceiraId" TEXT NOT NULL,
    "totalMatchs" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_classificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_refresh_tokenHash_key" ON "sessoes_refresh"("tokenHash");

-- CreateIndex
CREATE INDEX "sessoes_refresh_usuarioId_idx" ON "sessoes_refresh"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_codigo_key" ON "produtos"("codigo");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_produtoId_idx" ON "movimentacoes_estoque"("produtoId");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_tipo_criadoEm_idx" ON "movimentacoes_estoque"("tipo", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "fichas_tecnicas_codigo_key" ON "fichas_tecnicas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "fichas_tecnicas_produtoId_key" ON "fichas_tecnicas"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredientes_ficha_fichaTecnicaId_produtoId_key" ON "ingredientes_ficha"("fichaTecnicaId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_producao_numero_key" ON "ordens_producao"("numero");

-- CreateIndex
CREATE INDEX "ordens_producao_dataProducao_status_idx" ON "ordens_producao"("dataProducao", "status");

-- CreateIndex
CREATE INDEX "ordens_producao_fichaTecnicaId_idx" ON "ordens_producao"("fichaTecnicaId");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_codigo_key" ON "pessoas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_documento_key" ON "pessoas"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_venda_numero_key" ON "pedidos_venda"("numero");

-- CreateIndex
CREATE INDEX "pedidos_venda_status_criadoEm_idx" ON "pedidos_venda"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "pedidos_venda_canal_idx" ON "pedidos_venda"("canal");

-- CreateIndex
CREATE INDEX "pedidos_venda_pessoaId_idx" ON "pedidos_venda"("pessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_compra_numero_key" ON "pedidos_compra"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "empresa_cnpj_key" ON "empresa"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_digitais_empresaId_key" ON "certificados_digitais"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_fiscais_chave_key" ON "notas_fiscais"("chave");

-- CreateIndex
CREATE INDEX "notas_fiscais_status_dataEmissao_idx" ON "notas_fiscais"("status", "dataEmissao");

-- CreateIndex
CREATE INDEX "notas_fiscais_pedidoVendaId_idx" ON "notas_fiscais"("pedidoVendaId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_fiscais_empresaId_numero_serie_modelo_key" ON "notas_fiscais"("empresaId", "numero", "serie", "modelo");

-- CreateIndex
CREATE UNIQUE INDEX "contas_financeiras_codigo_key" ON "contas_financeiras"("codigo");

-- CreateIndex
CREATE INDEX "transacoes_financeiras_data_contaBancariaId_idx" ON "transacoes_financeiras"("data", "contaBancariaId");

-- CreateIndex
CREATE INDEX "transacoes_financeiras_status_idx" ON "transacoes_financeiras"("status");

-- CreateIndex
CREATE INDEX "transacoes_financeiras_contaFinanceiraId_data_idx" ON "transacoes_financeiras"("contaFinanceiraId", "data");

-- CreateIndex
CREATE INDEX "transacoes_financeiras_nomeOriginal_idx" ON "transacoes_financeiras"("nomeOriginal");

-- CreateIndex
CREATE UNIQUE INDEX "transacoes_financeiras_fitid_contaBancariaId_key" ON "transacoes_financeiras"("fitid", "contaBancariaId");

-- AddForeignKey
ALTER TABLE "sessoes_refresh" ADD CONSTRAINT "sessoes_refresh_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_apontamentoId_fkey" FOREIGN KEY ("apontamentoId") REFERENCES "apontamentos_producao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_tecnicas" ADD CONSTRAINT "fichas_tecnicas_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredientes_ficha" ADD CONSTRAINT "ingredientes_ficha_fichaTecnicaId_fkey" FOREIGN KEY ("fichaTecnicaId") REFERENCES "fichas_tecnicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredientes_ficha" ADD CONSTRAINT "ingredientes_ficha_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_producao" ADD CONSTRAINT "ordens_producao_fichaTecnicaId_fkey" FOREIGN KEY ("fichaTecnicaId") REFERENCES "fichas_tecnicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_producao" ADD CONSTRAINT "ordens_producao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apontamentos_producao" ADD CONSTRAINT "apontamentos_producao_ordemProducaoId_fkey" FOREIGN KEY ("ordemProducaoId") REFERENCES "ordens_producao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_venda" ADD CONSTRAINT "pedidos_venda_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_venda" ADD CONSTRAINT "pedidos_venda_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido_venda" ADD CONSTRAINT "itens_pedido_venda_pedidoVendaId_fkey" FOREIGN KEY ("pedidoVendaId") REFERENCES "pedidos_venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido_venda" ADD CONSTRAINT "itens_pedido_venda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_compra" ADD CONSTRAINT "pedidos_compra_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido_compra" ADD CONSTRAINT "itens_pedido_compra_pedidoCompraId_fkey" FOREIGN KEY ("pedidoCompraId") REFERENCES "pedidos_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido_compra" ADD CONSTRAINT "itens_pedido_compra_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "contas_financeiras" ADD CONSTRAINT "contas_financeiras_contaPaiId_fkey" FOREIGN KEY ("contaPaiId") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes_financeiras" ADD CONSTRAINT "transacoes_financeiras_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "contas_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes_financeiras" ADD CONSTRAINT "transacoes_financeiras_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacoes_ofx" ADD CONSTRAINT "importacoes_ofx_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "contas_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_classificacao" ADD CONSTRAINT "regras_classificacao_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "contas_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
