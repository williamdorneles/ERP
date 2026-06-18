import { createHash, randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
const { compare } = bcrypt
import { prisma } from '@erp/database'
import { LoginSchema } from '@erp/shared'
import { z } from 'zod'

const REFRESH_EXPIRY_DAYS = 7
const ACCESS_EXPIRY = '1h'

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

function refreshExpiresAt(): Date {
  const d = new Date()
  d.setDate(d.getDate() + REFRESH_EXPIRY_DAYS)
  return d
}

async function issueTokenPair(app: FastifyInstance, usuarioId: string, perfil: string) {
  const accessToken = app.jwt.sign({ sub: usuarioId, perfil }, { expiresIn: ACCESS_EXPIRY })

  const rawRefreshToken = randomBytes(32).toString('hex')
  await prisma.sessaoRefresh.create({
    data: {
      usuarioId,
      tokenHash: hashToken(rawRefreshToken),
      expiresAt: refreshExpiresAt(),
    },
  })

  return { accessToken, refreshToken: rawRefreshToken }
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', {
    config: {
      rateLimit: { max: 5, timeWindow: '15 minutes' },
    },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'senha'],
        properties: {
          email: { type: 'string', format: 'email' },
          senha: { type: 'string', minLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const { email, senha } = LoginSchema.parse(request.body)

    const usuario = await prisma.usuario.findUnique({ where: { email } })

    if (!usuario || !await compare(senha, usuario.senhaHash)) {
      return reply.code(401).send({ error: 'E-mail ou senha inválidos' })
    }

    if (!usuario.ativo) {
      return reply.code(403).send({ error: 'Usuário inativo' })
    }

    const { accessToken, refreshToken } = await issueTokenPair(app, usuario.id, usuario.perfil)

    return {
      accessToken,
      refreshToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
      },
    }
  })

  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = z.object({
      refreshToken: z.string().min(1),
    }).parse(request.body)

    const sessao = await prisma.sessaoRefresh.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { usuario: { select: { id: true, perfil: true, ativo: true } } },
    })

    if (!sessao || sessao.revokedAt || sessao.expiresAt < new Date()) {
      return reply.code(401).send({ error: 'Sessão inválida ou expirada.' })
    }

    if (!sessao.usuario.ativo) {
      return reply.code(403).send({ error: 'Usuário inativo.' })
    }

    // Revoga o token atual e emite um novo par
    await prisma.sessaoRefresh.update({
      where: { id: sessao.id },
      data: { revokedAt: new Date() },
    })

    const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(
      app, sessao.usuario.id, sessao.usuario.perfil,
    )

    return { accessToken, refreshToken: newRefreshToken }
  })

  app.post('/logout', async (request, reply) => {
    const { refreshToken } = z.object({
      refreshToken: z.string().min(1),
    }).parse(request.body)

    await prisma.sessaoRefresh.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    })

    return reply.code(204).send()
  })

  app.get('/me', {
    preHandler: [async (req, rep) => {
      try { await req.jwtVerify() } catch { rep.code(401).send({ error: 'Não autorizado' }) }
    }],
  }, async (request) => {
    const { sub } = request.user as { sub: string }
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { id: sub },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true },
    })
    return usuario
  })
}
