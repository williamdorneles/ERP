#!/bin/bash
# Script de configuração inicial da VPS (rodar uma única vez via SSH)
# Uso: bash vps-setup.sh
set -e

APP_DIR="/var/www/erp"
DB_NAME="erp_panificacao"
DB_USER="erp_user"

echo "=== Criando banco de dados PostgreSQL ==="
read -s -p "Senha para o usuário $DB_USER: " DB_PASS
echo

sudo -u postgres psql <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
  END IF;
END
\$\$;
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

echo "=== Banco criado: $DB_NAME ==="

echo "=== Criando diretório da aplicação ==="
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER /var/www
sudo mkdir -p /var/log/pm2

echo "=== Aguardando upload do código via rsync (rode deploy.sh na sua máquina local) ==="
echo "Quando o upload terminar, continue com:"
echo ""
echo "  cd $APP_DIR"
echo "  cp apps/api/.env.production.example apps/api/.env"
echo "  nano apps/api/.env   # preencha DATABASE_URL e JWT_SECRET"
echo "  npm ci --omit=dev"
echo "  DATABASE_URL=\"postgresql://$DB_USER:SENHA@localhost:5432/$DB_NAME\" \\"
echo "    npx prisma db push --schema=packages/database/prisma/schema.prisma"
echo "  DATABASE_URL=\"postgresql://$DB_USER:SENHA@localhost:5432/$DB_NAME\" \\"
echo "    npx tsx packages/database/src/seed.ts"
echo "  pm2 start apps/api/ecosystem.config.cjs --env production"
echo "  pm2 save"
echo "  pm2 startup"
echo ""
echo "=== Configurando Nginx ==="
echo "Copie nginx/erp.conf para /etc/nginx/sites-available/erp"
echo "  sudo cp $APP_DIR/nginx/erp.conf /etc/nginx/sites-available/erp"
echo "  sudo ln -sf /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/erp"
echo "  sudo nginx -t && sudo systemctl reload nginx"
