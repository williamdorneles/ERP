-- Cadastro próprio de vendedores (desacopla do cadastro de usuários/login)
CREATE TABLE "vendedores" (
  "id"             TEXT NOT NULL,
  "codigo"         TEXT NOT NULL,
  "nome"           TEXT NOT NULL,
  "documento"      TEXT,
  "email"          TEXT,
  "telefone"       TEXT,
  "comissaoPadrao" DECIMAL(5,2),
  "ativo"          BOOLEAN NOT NULL DEFAULT true,
  "criadoEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vendedores_codigo_key" ON "vendedores"("codigo");

-- vendedorId antes referenciava usuarios; limpa e re-aponta para vendedores
UPDATE "pedidos_venda" SET "vendedorId" = NULL;
ALTER TABLE "pedidos_venda" DROP CONSTRAINT "pedidos_venda_vendedorId_fkey";
ALTER TABLE "pedidos_venda"
  ADD CONSTRAINT "pedidos_venda_vendedorId_fkey"
  FOREIGN KEY ("vendedorId") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
