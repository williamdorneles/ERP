# ERP Panificação — Setup

## Pré-requisitos
- Node.js >= 20
- Docker Desktop

## Inicialização

### 1. Banco de dados
```bash
docker compose up -d
```

### 2. Gerar Prisma Client + Migrar banco
```bash
cd packages/database
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

### 3. Iniciar o projeto (monorepo)
```bash
# na raiz
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3333
- Docs Swagger: http://localhost:3333/docs
- PgAdmin: http://localhost:5050 (admin@erp.com / admin123)

## Usuário padrão
- E-mail: `admin@erp.com`
- Senha: `admin123`
