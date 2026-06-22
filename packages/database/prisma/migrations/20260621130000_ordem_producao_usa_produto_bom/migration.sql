-- Migration: OrdemProducao passa a referenciar produtoId diretamente (via BOM)
-- Remove a relação com fichaTecnica e vincula ao produto

-- 1. Remove foreign key constraint da fichaTecnica
ALTER TABLE "ordens_producao" DROP CONSTRAINT IF EXISTS "ordens_producao_fichaTecnicaId_fkey";

-- 2. Remove índice antigo
DROP INDEX IF EXISTS "ordens_producao_fichaTecnicaId_idx";

-- 3. Adiciona coluna produtoId temporariamente como nullable
ALTER TABLE "ordens_producao" ADD COLUMN "produtoId" TEXT;

-- 4. Preenche produtoId buscando via fichaTecnica
UPDATE "ordens_producao" op
SET "produtoId" = ft."produtoId"
FROM "fichas_tecnicas" ft
WHERE op."fichaTecnicaId" = ft."id";

-- 5. Torna NOT NULL após o preenchimento
ALTER TABLE "ordens_producao" ALTER COLUMN "produtoId" SET NOT NULL;

-- 6. Remove coluna antiga
ALTER TABLE "ordens_producao" DROP COLUMN "fichaTecnicaId";

-- 7. Adiciona foreign key para produtos
ALTER TABLE "ordens_producao" ADD CONSTRAINT "ordens_producao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. Cria novo índice
CREATE INDEX "ordens_producao_produtoId_idx" ON "ordens_producao"("produtoId");
