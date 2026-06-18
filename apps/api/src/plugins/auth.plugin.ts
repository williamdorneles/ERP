import type { FastifyRequest, FastifyReply } from 'fastify'

export type Perfil = 'ADMIN' | 'GERENTE' | 'PRODUCAO' | 'VENDAS' | 'FINANCEIRO' | 'ESTOQUE'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Token inválido ou expirado' })
  }
}

export function requirePerfil(...perfis: Perfil[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'Token inválido ou expirado' })
    }
    const { perfil } = request.user as { sub: string; perfil: Perfil }
    if (!perfis.includes(perfil)) {
      return reply.code(403).send({ error: 'Acesso não autorizado para este perfil.' })
    }
  }
}
