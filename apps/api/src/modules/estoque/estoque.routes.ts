import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { z } from 'zod'
import { CriarMovimentacaoSchema } from '@erp/shared'
import { requirePerfil } from '../../plugins/auth.plugin.js'
import { propagarCustoComponente } from '../produtos/custo-bom.service.js'
import { quantidadeArmazenada, efeitoEstoque } from './movimento.js'
import { permiteEstoqueNegativo } from './config-estoque.js'

const QueryMovimentacoesSchema = z.object({
  produtoId: z.string().uuid().optional(),
  tipo: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(50),
})

export async function estoqueRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'ESTOQUE', 'PRODUCAO'))

  app.get('/movimentacoes', async (request) => {
    const { produtoId, tipo, pagina, limite } = QueryMovimentacoesSchema.parse(request.query)
    return prisma.movimentacaoEstoque.findMany({
      where: {
        ...(produtoId && { produtoId }),
        ...(tipo && { tipo }),
      },
      include: { produto: { select: { nome: true, codigo: true, unidadeMedida: true } } },
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite,
    })
  })

  app.post('/movimentacoes', async (request, reply) => {
    const data = CriarMovimentacaoSchema.parse(request.body)

    const prod = await prisma.produto.findUnique({
      where: { id: data.produtoId },
      select: { estoqueAtual: true, custoMedio: true },
    })
    if (!prod) return reply.code(404).send({ error: 'Produto não encontrado.' })

    if (data.tipo === 'ENTRADA' && (data.custoUnitario == null || data.custoUnitario <= 0)) {
      return reply.code(400).send({ error: 'Informe o custo unitário para movimentações de entrada.' })
    }

    const estoqueAtual = Number(prod.estoqueAtual)
    const custoMedioAtual = Number(prod.custoMedio)

    // Bloqueia baixa que deixaria o saldo negativo, se a configuração não permitir
    if (data.tipo !== 'ENTRADA') {
      const qtdeCheck = quantidadeArmazenada(data.tipo, data.quantidade, data.ajusteSentido)
      const novoSaldo = estoqueAtual + efeitoEstoque(data.tipo, qtdeCheck)
      if (novoSaldo < -0.0001 && !(await permiteEstoqueNegativo())) {
        return reply.code(400).send({
          error: `Estoque insuficiente: saldo atual ${estoqueAtual.toLocaleString('pt-BR')}, esta operação deixaria ${novoSaldo.toFixed(3)}. Habilite "estoque negativo" em Configurações > Estoque para permitir.`,
        })
      }
    }

    // Método de custeio configurável (MEDIO padrão ou ULTIMO)
    const configMetodo = await prisma.configuracao.findUnique({ where: { chave: 'METODO_CUSTO' } })
    const metodo = configMetodo?.valor ?? 'MEDIO'

    const result = await prisma.$transaction(async (tx) => {
      // ENTRADA: recalcula custo conforme o método e atualiza o custo do produto
      if (data.tipo === 'ENTRADA') {
        const custoEntrada = +Number(data.custoUnitario).toFixed(4)
        const novoEstoque = estoqueAtual + data.quantidade
        const novoCustoMedio = +(novoEstoque > 0
          ? (estoqueAtual * custoMedioAtual + data.quantidade * custoEntrada) / novoEstoque
          : custoEntrada).toFixed(4)
        // Custo ativo: ULTIMO usa o custo da entrada; MEDIO usa a média ponderada
        const custoAtivo = metodo === 'ULTIMO' ? custoEntrada : novoCustoMedio

        const mov = await tx.movimentacaoEstoque.create({
          data: {
            produtoId: data.produtoId,
            tipo: data.tipo,
            quantidade: data.quantidade,
            custoUnitario: custoEntrada,
            lote: data.lote,
            dataVencimento: data.dataVencimento,
            observacao: data.observacao,
          },
        })
        await tx.produto.update({
          where: { id: data.produtoId },
          data: {
            estoqueAtual: { increment: data.quantidade },
            ultimoCusto: custoEntrada,
            custoMedio: novoCustoMedio,
            custoUnitario: custoAtivo,
          },
        })

        // Registra no histórico de custos do produto (aba Custos do cadastro)
        await tx.produtoCusto.create({
          data: {
            produtoId: data.produtoId,
            custo: custoAtivo,
            motivo: 'MOVIMENTACAO_ESTOQUE',
            observacao: `Entrada manual de estoque — ${data.quantidade} un. a R$ ${custoEntrada.toFixed(4)} (método ${metodo === 'ULTIMO' ? 'último custo' : 'custo médio'})${data.observacao ? ` — ${data.observacao}` : ''}`,
          },
        })

        // Propaga o novo custo para produtos com BOM que usam este como componente
        await propagarCustoComponente(tx, data.produtoId)
        return mov
      }

      // SAÍDA / PERDA / AJUSTE: baixa pelo custo médio atual, sem alterar o custo do produto.
      // AJUSTE é bidirecional: ajusteSentido ENTRADA aumenta, SAIDA (padrão) reduz.
      const qtdeMov = quantidadeArmazenada(data.tipo, data.quantidade, data.ajusteSentido)

      const mov = await tx.movimentacaoEstoque.create({
        data: {
          produtoId: data.produtoId,
          tipo: data.tipo,
          quantidade: qtdeMov,
          custoUnitario: +custoMedioAtual.toFixed(4),
          lote: data.lote,
          dataVencimento: data.dataVencimento,
          observacao: data.observacao,
        },
      })
      await tx.produto.update({
        where: { id: data.produtoId },
        data: { estoqueAtual: { increment: efeitoEstoque(data.tipo, qtdeMov) } },
      })
      return mov
    })

    return reply.code(201).send(result)
  })

  app.delete('/movimentacoes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const mov = await prisma.movimentacaoEstoque.findUnique({ where: { id } })
    if (!mov) return reply.code(404).send({ error: 'Movimentação não encontrada.' })

    // Só permite excluir lançamentos manuais (não gerados por apontamento ou NF)
    if (mov.apontamentoId || mov.nfEntradaId) {
      return reply.code(400).send({
        error: 'Apenas movimentações manuais podem ser excluídas. Esta foi gerada por apontamento de produção ou NF de entrada.',
      })
    }

    await prisma.$transaction(async (tx) => {
      // Reverte o efeito da movimentação no estoque (estorno = -efeito).
      const delta = -efeitoEstoque(mov.tipo as never, Number(mov.quantidade))
      await tx.produto.update({
        where: { id: mov.produtoId },
        data: { estoqueAtual: { increment: delta } },
      })

      // ENTRADA manual também alterou o custo do produto: remove o registro de custo
      // co-criado por esta entrada e reverte o custo ao registro anterior restante
      // (mesmo padrão da exclusão no histórico de custos do cadastro).
      if (mov.tipo === 'ENTRADA') {
        const ini = new Date(mov.criadoEm.getTime() - 2000)
        const fim = new Date(mov.criadoEm.getTime() + 2000)
        const custoRec = await tx.produtoCusto.findFirst({
          where: { produtoId: mov.produtoId, motivo: 'MOVIMENTACAO_ESTOQUE', criadoEm: { gte: ini, lte: fim } },
          orderBy: { criadoEm: 'desc' },
        })
        if (custoRec) await tx.produtoCusto.delete({ where: { id: custoRec.id } })

        const anterior = await tx.produtoCusto.findFirst({
          where: { produtoId: mov.produtoId },
          orderBy: { criadoEm: 'desc' },
        })
        const custo = +(anterior ? Number(anterior.custo) : 0).toFixed(4)
        await tx.produto.update({
          where: { id: mov.produtoId },
          data: { custoUnitario: custo, custoMedio: custo, ultimoCusto: custo },
        })
        await propagarCustoComponente(tx, mov.produtoId)
      }

      await tx.movimentacaoEstoque.delete({ where: { id } })
    })

    return { ok: true }
  })

  app.get('/alertas', async () => {
    return prisma.$queryRaw`
      SELECT * FROM produtos
      WHERE ativo = true
      AND tipo IN ('INSUMO', 'INSUMO_PRODUTO')
      AND "estoqueAtual" <= "estoqueMinimo"
    `
  })
}
