-- Reconcilia o banco com o schema.prisma (drift que nunca virou migration).
-- Escrita manualmente para preservar dados (a versão auto-gerada faria DROP COLUMN).

-- 1. categorias.atualizadoEm: o @updatedAt é gerenciado pelo Prisma, não pelo banco.
ALTER TABLE "categorias" ALTER COLUMN "atualizadoEm" DROP DEFAULT;

-- 2. recorrencias_financeiras.tipo: converter de TEXT para o enum TipoTitulo no lugar,
--    preservando os valores existentes (PAGAR/RECEBER são labels válidas do enum).
ALTER TABLE "recorrencias_financeiras"
  ALTER COLUMN "tipo" TYPE "TipoTitulo" USING "tipo"::"TipoTitulo";

-- 3. recorrencias_financeiras.atualizadoEm: idem, gerenciado pelo Prisma.
ALTER TABLE "recorrencias_financeiras" ALTER COLUMN "atualizadoEm" DROP DEFAULT;
