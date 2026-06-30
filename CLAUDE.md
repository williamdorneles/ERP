# ERP Panificação — CLAUDE CONTEXT

## Pré-requisitos
- Node.js >= 20
- Docker Desktop

## Estrutura do Monorepo
- `apps/web`: Frontend React/TypeScript (.tsx) - Roda em http://localhost:5173
- `apps/api`: Backend Node.js - Roda em http://localhost:3333
- `packages/database`: Banco de dados e ORM Prisma

## Inicialização Básica
- Docker: `docker compose up -d`
- Banco: No diretório `packages/database`, rodar `npx prisma generate`, `npx prisma migrate dev` e `npm run db:seed`
- Rodar o Monorepo completo (na raiz): `npm run dev`

## Regras Estritas de Escopo (Economia de Tokens do Usuário Pro)
1. **Nunca faça buscas globais** que leiam `apps/web` e `apps/api` ao mesmo tempo. Elas são aplicações isoladas.
2. Se a tarefa envolver a listagem ou componentes visuais, limite sua leitura e alteração estritamente à pasta `apps/web/`.
3. Se a tarefa for uma rota, controller ou regra de negócio da API, limite seu escopo à pasta `apps/api/`.
4. Se envolver tabelas e models, use apenas os arquivos relevantes de `packages/database/`.
5. Foque em soluções cirúrgicas. Altere apenas os arquivos passados no escopo ou solicitados.
