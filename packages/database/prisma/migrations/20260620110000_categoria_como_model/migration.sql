-- Converte Categoria de enum para model com CRUD dinâmico

-- 1. Criar tabela categorias
CREATE TABLE "categorias" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categorias_nome_key" ON "categorias"("nome");

-- 2. Inserir categorias iniciais (equivalentes ao enum antigo)
INSERT INTO "categorias" ("id", "nome", "atualizadoEm") VALUES
  (gen_random_uuid()::text, 'Farinha',    NOW()),
  (gen_random_uuid()::text, 'Gordura',    NOW()),
  (gen_random_uuid()::text, 'Açúcar',     NOW()),
  (gen_random_uuid()::text, 'Fermento',   NOW()),
  (gen_random_uuid()::text, 'Laticínios', NOW()),
  (gen_random_uuid()::text, 'Ovos',       NOW()),
  (gen_random_uuid()::text, 'Embalagem',  NOW()),
  (gen_random_uuid()::text, 'Pão',        NOW()),
  (gen_random_uuid()::text, 'Bolo',       NOW()),
  (gen_random_uuid()::text, 'Doce',       NOW()),
  (gen_random_uuid()::text, 'Salgado',    NOW()),
  (gen_random_uuid()::text, 'Massa',      NOW()),
  (gen_random_uuid()::text, 'Recheio',    NOW()),
  (gen_random_uuid()::text, 'Outros',     NOW());

-- 3. Adicionar coluna categoriaId em produtos (nullable)
ALTER TABLE "produtos" ADD COLUMN "categoriaId" TEXT;

-- 4. Popular categoriaId em produtos a partir do enum antigo
UPDATE "produtos" SET "categoriaId" = (
  SELECT c."id" FROM "categorias" c WHERE c."nome" =
    CASE "categoria"::TEXT
      WHEN 'FARINHA'   THEN 'Farinha'
      WHEN 'GORDURA'   THEN 'Gordura'
      WHEN 'ACUCAR'    THEN 'Açúcar'
      WHEN 'FERMENTO'  THEN 'Fermento'
      WHEN 'LATICINIOS' THEN 'Laticínios'
      WHEN 'OVOS'      THEN 'Ovos'
      WHEN 'EMBALAGEM' THEN 'Embalagem'
      WHEN 'PAO'       THEN 'Pão'
      WHEN 'BOLO'      THEN 'Bolo'
      WHEN 'DOCE'      THEN 'Doce'
      WHEN 'SALGADO'   THEN 'Salgado'
      WHEN 'MASSA'     THEN 'Massa'
      WHEN 'RECHEIO'   THEN 'Recheio'
      WHEN 'OUTROS'    THEN 'Outros'
    END
  LIMIT 1
)
WHERE "categoria" IS NOT NULL;

-- 5. Adicionar coluna categoriaId em fichas_tecnicas (nullable)
ALTER TABLE "fichas_tecnicas" ADD COLUMN "categoriaId" TEXT;

-- 6. Popular categoriaId em fichas_tecnicas a partir do enum antigo
UPDATE "fichas_tecnicas" SET "categoriaId" = (
  SELECT c."id" FROM "categorias" c WHERE c."nome" =
    CASE "categoria"::TEXT
      WHEN 'FARINHA'   THEN 'Farinha'
      WHEN 'GORDURA'   THEN 'Gordura'
      WHEN 'ACUCAR'    THEN 'Açúcar'
      WHEN 'FERMENTO'  THEN 'Fermento'
      WHEN 'LATICINIOS' THEN 'Laticínios'
      WHEN 'OVOS'      THEN 'Ovos'
      WHEN 'EMBALAGEM' THEN 'Embalagem'
      WHEN 'PAO'       THEN 'Pão'
      WHEN 'BOLO'      THEN 'Bolo'
      WHEN 'DOCE'      THEN 'Doce'
      WHEN 'SALGADO'   THEN 'Salgado'
      WHEN 'MASSA'     THEN 'Massa'
      WHEN 'RECHEIO'   THEN 'Recheio'
      WHEN 'OUTROS'    THEN 'Outros'
    END
  LIMIT 1
);

-- Fallback: fichas sem categoria mapeada recebem 'Outros'
UPDATE "fichas_tecnicas" SET "categoriaId" = (
  SELECT "id" FROM "categorias" WHERE "nome" = 'Outros' LIMIT 1
)
WHERE "categoriaId" IS NULL AND "categoria" IS NOT NULL;

-- 7. Adicionar foreign keys
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fichas_tecnicas" ADD CONSTRAINT "fichas_tecnicas_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 8. Remover colunas do enum antigo
ALTER TABLE "produtos" DROP COLUMN "categoria";
ALTER TABLE "fichas_tecnicas" DROP COLUMN "categoria";

-- 9. Remover o tipo enum Categoria
DROP TYPE "Categoria";
