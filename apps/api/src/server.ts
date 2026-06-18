import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))
try { process.loadEnvFile(join(__dirname, '../.env')) } catch {}

import { z } from 'zod'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { Prisma } from '@prisma/client'

import { authRoutes } from './modules/auth/auth.routes.js'
import { produtosRoutes } from './modules/produtos/produtos.routes.js'
import { pessoasRoutes } from './modules/pessoas/pessoas.routes.js'
import { estoqueRoutes } from './modules/estoque/estoque.routes.js'
import { producaoRoutes } from './modules/producao/producao.routes.js'
import { vendasRoutes } from './modules/vendas/vendas.routes.js'
import { fiscalRoutes } from './modules/fiscal/fiscal.routes.js'
import { financeiroRoutes } from './modules/financeiro/financeiro.routes.js'

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter ao menos 32 caracteres'),
  PORT: z.coerce.number().default(3333),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const envResult = EnvSchema.safeParse(process.env)
if (!envResult.success) {
  console.error('❌ Variáveis de ambiente inválidas:')
  for (const issue of envResult.error.issues) {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}
const env = envResult.data

const app = Fastify({
  logger: env.NODE_ENV === 'production' ? { level: 'warn' } : { level: 'info' },
})

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
})

await app.register(rateLimit, {
  global: true,
  max: 120,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
})

await app.register(jwt, {
  secret: env.JWT_SECRET,
})

await app.register(swagger, {
  openapi: {
    info: { title: 'ERP Panificação API', version: '1.0.0' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
})

await app.register(swaggerUi, { routePrefix: '/docs' })

await app.register(authRoutes, { prefix: '/api/auth' })
await app.register(produtosRoutes, { prefix: '/api/produtos' })
await app.register(pessoasRoutes, { prefix: '/api/pessoas' })
await app.register(estoqueRoutes, { prefix: '/api/estoque' })
await app.register(producaoRoutes, { prefix: '/api/producao' })
await app.register(vendasRoutes, { prefix: '/api/vendas' })
await app.register(fiscalRoutes, { prefix: '/api/fiscal' })
await app.register(financeiroRoutes, { prefix: '/api/financeiro' })

app.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({
      error: 'Dados inválidos',
      issues: error.issues.map(i => ({ campo: i.path.join('.'), mensagem: i.message })),
    })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return reply.code(409).send({ error: 'Registro duplicado: valor já existe.' })
    }
    if (error.code === 'P2025') {
      return reply.code(404).send({ error: 'Registro não encontrado.' })
    }
    app.log.warn({ prismaCode: error.code }, 'Prisma known error')
    return reply.code(400).send({ error: 'Erro de banco de dados.' })
  }
  app.log.error(error)
  return reply.code(500).send({ error: 'Erro interno do servidor.' })
})

const port = env.PORT

try {
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
