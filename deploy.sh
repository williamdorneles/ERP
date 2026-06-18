#!/bin/bash
# Script de deploy para a VPS via SCP (funciona no Git Bash do Windows)
# Uso: bash deploy.sh

set -e

# ── Configuração ──────────────────────────────────────────────────────────────
VPS_USER="root"
VPS_HOST="187.45.254.96"
VPS_DIR="/var/www/erp"

# ── Build do frontend ─────────────────────────────────────────────────────────
echo ">>> Buildando o frontend..."
npm run build -w @erp/web

# ── Criar arquivo tar excluindo o que não precisa ────────────────────────────
echo ">>> Empacotando arquivos..."
TARNAME="erp-deploy.tar.gz"
TARLOCAL="/tmp/$TARNAME"

tar -czf "$TARLOCAL" \
  --exclude='./node_modules' \
  --exclude='./.env' \
  --exclude='./.turbo' \
  --exclude='./apps/api/dist' \
  --exclude='./*.log' \
  --exclude='./.git' \
  .

echo ">>> Arquivo criado: $TARLOCAL ($(du -sh $TARLOCAL | cut -f1))"

# ── Upload via SCP ────────────────────────────────────────────────────────────
echo ">>> Enviando para a VPS..."
scp "$TARLOCAL" "$VPS_USER@$VPS_HOST:/tmp/$TARNAME"

# ── Extrair e configurar na VPS ───────────────────────────────────────────────
echo ">>> Extraindo na VPS e reiniciando..."
ssh "$VPS_USER@$VPS_HOST" "
  set -e
  mkdir -p $VPS_DIR
  tar -xzf /tmp/$TARNAME -C $VPS_DIR
  rm /tmp/$TARNAME
  cd $VPS_DIR
  npm ci
  npx prisma generate --schema=packages/database/prisma/schema.prisma
  if pm2 list | grep -q 'erp-api'; then
    pm2 reload erp-api
  else
    echo 'PM2: erp-api nao encontrado - inicie manualmente apos configurar o .env'
  fi
  echo 'Deploy concluido!'
"

# ── Limpar arquivo local ──────────────────────────────────────────────────────
rm -f "$TARLOCAL"
echo ""
echo "✅ Deploy concluído! Acesse: http://$VPS_HOST"
