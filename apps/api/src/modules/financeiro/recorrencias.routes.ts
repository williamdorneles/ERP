import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { CriarRecorrenciaSchema, AtualizarRecorrenciaSchema } from '@erp/shared'
import { requirePerfil } from '../../plugins/auth.plugin.js'

// Gera datas de vencimento para N meses
// Se dataInicio fornecida: começa naquele mês/ano exato
// Se apenas apartirDe (último vencimento): avança um mês
// Sem nada: começa no corrente ou próximo mês conforme diaVencimento
function gerarDatas(diaVencimento: number, qtd: number, apartirDe?: Date, dataInicio?: Date): Date[] {
  let ano: number
  let mes: number

  if (dataInicio) {
    ano = dataInicio.getFullYear()
    mes = dataInicio.getMonth()
  } else if (apartirDe) {
    const next = new Date(apartirDe)
    next.setMonth(next.getMonth() + 1)
    ano = next.getFullYear()
    mes = next.getMonth()
  } else {
    const hoje = new Date()
    ano = hoje.getFullYear()
    mes = hoje.getMonth()
    if (hoje.getDate() > diaVencimento) {
      mes += 1
      if (mes > 11) { mes = 0; ano++ }
    }
  }

  const datas: Date[] = []
  for (let i = 0; i < qtd; i++) {
    const m = (mes + i) % 12
    const a = ano + Math.floor((mes + i) / 12)
    const dia = Math.min(diaVencimento, new Date(a, m + 1, 0).getDate())
    datas.push(new Date(Date.UTC(a, m, dia)))
  }
  return datas
}

export async function recorrenciasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'FINANCEIRO'))

  // ── Listar ────────────────────────────────────────────────────

  app.get('/', async () => {
    return prisma.recorrenciaFinanceira.findMany({
      include: {
        pessoa: { select: { id: true, nome: true } },
        contaFinanceira: { select: { id: true, codigo: true, nome: true } },
        _count: { select: { titulos: true } },
      },
      orderBy: [{ ativa: 'desc' }, { descricao: 'asc' }],
    })
  })

  // ── Criar + gerar 12 títulos ──────────────────────────────────

  app.post('/', async (request, reply) => {
    const data = CriarRecorrenciaSchema.parse(request.body)

    const recorrencia = await prisma.recorrenciaFinanceira.create({
      data: {
        tipo: data.tipo as never,
        descricao: data.descricao,
        valor: data.valor,
        diaVencimento: data.diaVencimento,
        pessoaId: data.pessoaId ?? null,
        contaFinanceiraId: data.contaFinanceiraId ?? null,
        observacao: data.observacao ?? null,
      },
    })

    const dataInicioDate = data.dataInicio ? new Date(data.dataInicio + 'T12:00:00') : undefined
    const datas = gerarDatas(data.diaVencimento, 12, undefined, dataInicioDate)

    await prisma.$transaction(
      datas.map((venc, i) =>
        prisma.tituloFinanceiro.create({
          data: {
            tipo: data.tipo as never,
            descricao: data.descricao,
            total: data.valor,
            pessoaId: data.pessoaId ?? null,
            contaFinanceiraId: data.contaFinanceiraId ?? null,
            observacao: data.observacao ?? null,
            recorrenciaId: recorrencia.id,
            recorrenciaOrdem: i + 1,
            parcelas: {
              create: [{ numero: 1, valor: data.valor, vencimento: venc }],
            },
          },
        })
      )
    )

    return reply.code(201).send(recorrencia)
  })

  // ── Editar (+ propagar a títulos futuros em aberto) ───────────

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { propagar, ...campos } = AtualizarRecorrenciaSchema.parse(request.body)

    const recorrencia = await prisma.recorrenciaFinanceira.findUnique({ where: { id } })
    if (!recorrencia) return reply.code(404).send({ error: 'Recorrência não encontrada.' })

    await prisma.$transaction(async (tx) => {
      // Atualiza template
      await tx.recorrenciaFinanceira.update({
        where: { id },
        data: {
          ...(campos.descricao !== undefined && { descricao: campos.descricao }),
          ...(campos.valor !== undefined && { valor: campos.valor }),
          ...(campos.pessoaId !== undefined && { pessoaId: campos.pessoaId }),
          ...(campos.contaFinanceiraId !== undefined && { contaFinanceiraId: campos.contaFinanceiraId }),
          ...(campos.observacao !== undefined && { observacao: campos.observacao }),
        },
      })

      if (propagar) {
        const titulosAbertos = await tx.tituloFinanceiro.findMany({
          where: { recorrenciaId: id, status: { in: ['ABERTO', 'PARCIAL'] } },
          include: { parcelas: { where: { status: 'ABERTO' } } },
        })

        await Promise.all(titulosAbertos.map(async (titulo) => {
          await tx.tituloFinanceiro.update({
            where: { id: titulo.id },
            data: {
              ...(campos.descricao !== undefined && { descricao: campos.descricao }),
              ...(campos.valor !== undefined && { total: campos.valor }),
              ...(campos.pessoaId !== undefined && { pessoaId: campos.pessoaId }),
              ...(campos.contaFinanceiraId !== undefined && { contaFinanceiraId: campos.contaFinanceiraId }),
              ...(campos.observacao !== undefined && { observacao: campos.observacao }),
            },
          })

          if (campos.valor !== undefined) {
            await Promise.all(titulo.parcelas.map(p =>
              tx.parcelaFinanceira.update({ where: { id: p.id }, data: { valor: campos.valor! } })
            ))
          }
        }))
      }
    })

    return { ok: true }
  })

  // ── Pausar / Reativar ─────────────────────────────────────────

  app.patch('/:id/toggle-ativo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const rec = await prisma.recorrenciaFinanceira.findUnique({ where: { id }, select: { ativa: true } })
    if (!rec) return reply.code(404).send({ error: 'Recorrência não encontrada.' })
    await prisma.recorrenciaFinanceira.update({ where: { id }, data: { ativa: !rec.ativa } })
    return { ok: true, ativa: !rec.ativa }
  })

  // ── Renovar manualmente (gera próximos 12 a partir do último vencimento) ──

  app.post('/:id/renovar', async (request, reply) => {
    const { id } = request.params as { id: string }
    const rec = await prisma.recorrenciaFinanceira.findUnique({ where: { id } })
    if (!rec) return reply.code(404).send({ error: 'Recorrência não encontrada.' })

    const ultimoTitulo = await prisma.tituloFinanceiro.findFirst({
      where: { recorrenciaId: id },
      orderBy: { recorrenciaOrdem: 'desc' },
      include: { parcelas: { orderBy: { vencimento: 'desc' }, take: 1 } },
    })

    const maxOrdem = ultimoTitulo?.recorrenciaOrdem ?? 0
    const ultimaVenc = ultimoTitulo?.parcelas[0]?.vencimento ?? new Date()

    const datas = gerarDatas(rec.diaVencimento, 12, ultimaVenc)

    await prisma.$transaction(
      datas.map((venc, i) =>
        prisma.tituloFinanceiro.create({
          data: {
            tipo: rec.tipo,
            descricao: rec.descricao,
            total: rec.valor,
            pessoaId: rec.pessoaId,
            contaFinanceiraId: rec.contaFinanceiraId,
            observacao: rec.observacao,
            recorrenciaId: id,
            recorrenciaOrdem: maxOrdem + i + 1,
            parcelas: {
              create: [{ numero: 1, valor: rec.valor, vencimento: venc }],
            },
          },
        })
      )
    )

    return { ok: true }
  })

  // ── Cancelar (desativa + cancela todos os ABERTO) ─────────────

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const rec = await prisma.recorrenciaFinanceira.findUnique({ where: { id } })
    if (!rec) return reply.code(404).send({ error: 'Recorrência não encontrada.' })

    await prisma.$transaction(async (tx) => {
      const titulosAbertos = await tx.tituloFinanceiro.findMany({
        where: { recorrenciaId: id, status: { in: ['ABERTO', 'PARCIAL'] } },
        select: { id: true },
      })
      const ids = titulosAbertos.map(t => t.id)

      await tx.parcelaFinanceira.updateMany({
        where: { tituloId: { in: ids }, status: 'ABERTO' },
        data: { status: 'CANCELADO' },
      })
      await tx.tituloFinanceiro.updateMany({
        where: { id: { in: ids } },
        data: { status: 'CANCELADO' },
      })
      await tx.recorrenciaFinanceira.update({ where: { id }, data: { ativa: false } })
    })

    return { ok: true }
  })
}
