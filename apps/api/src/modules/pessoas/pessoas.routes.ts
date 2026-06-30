import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { requirePerfil } from '../../plugins/auth.plugin.js'

const PAPEL_LABEL: Record<string, string> = {
  CLIENTE: 'Cliente',
  FORNECEDOR: 'Fornecedor',
  AMBOS: 'Cliente e Fornecedor',
}

export async function pessoasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'VENDAS', 'FINANCEIRO', 'ESTOQUE'))

  app.get('/', async (request) => {
    const { busca, tipo, mostrarInativos } = request.query as {
      busca?: string; tipo?: string; mostrarInativos?: string
    }

    const where: Record<string, unknown> = {}
    if (mostrarInativos !== 'true') where.ativo = true
    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: 'insensitive' } },
        { nomeFantasia: { contains: busca, mode: 'insensitive' } },
        { documento: { contains: busca } },
      ]
    }
    // AMBOS é cliente E fornecedor: deve aparecer nas buscas dos dois papéis
    if (tipo === 'CLIENTE') where.tipo = { in: ['CLIENTE', 'AMBOS'] }
    else if (tipo === 'FORNECEDOR') where.tipo = { in: ['FORNECEDOR', 'AMBOS'] }
    else if (tipo) where.tipo = tipo

    return prisma.pessoa.findMany({ where: where as never, orderBy: { nome: 'asc' } })
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const pessoa = await prisma.pessoa.findUnique({ where: { id } })
    if (!pessoa) return reply.code(404).send({ error: 'Pessoa não encontrada' })
    return pessoa
  })

  // Lookup por CPF/CNPJ (dígitos) — usado pelo cadastro para evitar duplicidade
  app.get('/por-documento', async (request) => {
    const { documento } = request.query as { documento?: string }
    const doc = (documento ?? '').replace(/\D/g, '')
    if (!doc) return { pessoa: null }
    const pessoa = await prisma.pessoa.findUnique({
      where: { documento: doc },
      select: { id: true, codigo: true, nome: true, tipo: true, ativo: true },
    })
    return { pessoa }
  })

  app.post('/', async (request, reply) => {
    const data = request.body as Record<string, unknown>
    // Normaliza o documento para só dígitos e bloqueia duplicidade por CPF/CNPJ
    if (typeof data.documento === 'string') data.documento = data.documento.replace(/\D/g, '') || null
    if (data.documento) {
      const existente = await prisma.pessoa.findUnique({
        where: { documento: data.documento as string },
        select: { id: true, nome: true, tipo: true },
      })
      if (existente) {
        return reply.code(409).send({
          error: `Já existe um cadastro com este CPF/CNPJ: ${existente.nome} (${PAPEL_LABEL[existente.tipo] ?? existente.tipo}). Edite o cadastro existente.`,
          pessoaId: existente.id,
        })
      }
    }
    const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('pessoa_codigo_seq')`
    const codigo = String(Number(nextval)).padStart(6, '0')
    const pessoa = await prisma.pessoa.create({ data: { ...data as never, codigo } })
    return reply.code(201).send(pessoa)
  })

  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = request.body as Record<string, unknown>
    if (typeof data.documento === 'string') data.documento = data.documento.replace(/\D/g, '') || null
    if (data.documento) {
      const existente = await prisma.pessoa.findUnique({
        where: { documento: data.documento as string },
        select: { id: true, nome: true },
      })
      if (existente && existente.id !== id) {
        return reply.code(409).send({ error: `Outro cadastro já usa este CPF/CNPJ: ${existente.nome}.` })
      }
    }
    return prisma.pessoa.update({ where: { id }, data: data as never })
  })

  app.patch('/:id/toggle-ativo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const atual = await prisma.pessoa.findUnique({ where: { id }, select: { ativo: true } })
    if (!atual) return reply.code(404).send({ error: 'Pessoa não encontrada' })
    return prisma.pessoa.update({ where: { id }, data: { ativo: !atual.ativo } })
  })
}
