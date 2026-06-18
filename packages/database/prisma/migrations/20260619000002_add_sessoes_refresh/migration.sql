CREATE TABLE "sessoes_refresh" (
  "id"        TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sessoes_refresh_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessoes_refresh_tokenHash_key" ON "sessoes_refresh"("tokenHash");
CREATE INDEX "sessoes_refresh_usuarioId_idx"   ON "sessoes_refresh"("usuarioId");

ALTER TABLE "sessoes_refresh"
  ADD CONSTRAINT "sessoes_refresh_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
