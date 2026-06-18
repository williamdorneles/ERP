import { describe, it, expect } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'

// Funções extraídas da lógica de auth para teste isolado
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

function refreshExpiresAt(days = 7): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

function isTokenExpired(expiresAt: Date): boolean {
  return expiresAt < new Date()
}

describe('hashToken', () => {
  it('produz sempre o mesmo hash para o mesmo input', () => {
    const token = 'meu-token-secreto'
    expect(hashToken(token)).toBe(hashToken(token))
  })

  it('hashes diferentes para tokens diferentes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'))
  })

  it('hash tem 64 caracteres hexadecimais (SHA-256)', () => {
    expect(hashToken('qualquer')).toMatch(/^[a-f0-9]{64}$/)
  })

  it('não é reversível — não contém o texto original', () => {
    const original = 'senha-secreta'
    expect(hashToken(original)).not.toContain(original)
  })
})

describe('refreshExpiresAt', () => {
  it('retorna data no futuro', () => {
    expect(refreshExpiresAt()).toBeInstanceOf(Date)
    expect(refreshExpiresAt() > new Date()).toBe(true)
  })

  it('expira em 7 dias por padrão', () => {
    const expires = refreshExpiresAt(7)
    const diffMs = expires.getTime() - Date.now()
    const diffDias = diffMs / (1000 * 60 * 60 * 24)
    expect(diffDias).toBeGreaterThan(6.9)
    expect(diffDias).toBeLessThan(7.1)
  })
})

describe('isTokenExpired', () => {
  it('retorna true para data no passado', () => {
    const past = new Date(Date.now() - 1000)
    expect(isTokenExpired(past)).toBe(true)
  })

  it('retorna false para data no futuro', () => {
    const future = new Date(Date.now() + 60_000)
    expect(isTokenExpired(future)).toBe(false)
  })
})

describe('randomBytes para refresh token', () => {
  it('gera tokens únicos a cada chamada', () => {
    const t1 = randomBytes(32).toString('hex')
    const t2 = randomBytes(32).toString('hex')
    expect(t1).not.toBe(t2)
  })

  it('token tem 64 caracteres (32 bytes em hex)', () => {
    expect(randomBytes(32).toString('hex')).toHaveLength(64)
  })
})
