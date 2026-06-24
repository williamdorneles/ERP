import type { FastifyInstance } from 'fastify'
import { prisma } from '@erp/database'
import { AtualizarConfiguracaoSchema } from '@erp/shared'
import { requirePerfil } from '../../plugins/auth.plugin.js'

// Descrições das chaves conhecidas — usadas ao criar a configuração no primeiro save.
export const DESCRICOES_CONFIG: Record<string, string> = {
  METODO_CUSTO: 'Método de custo usado no CMV e margens: MEDIO (Custo Médio Ponderado) ou ULTIMO (Último Custo)',
  PERMITIR_ESTOQUE_NEGATIVO: 'Permite que saídas/consumos deixem o estoque negativo (SIM) ou bloqueia quando não há saldo (NAO)',
  CONTA_TARIFA_BANCARIA: 'Conta do plano de contas para tarifas bancárias (despesa financeira) lançadas na conciliação/baixa',
  CONTA_JUROS_PAGOS: 'Conta do plano de contas para juros e multas pagos por atraso (despesa financeira)',
  CONTA_JUROS_RECEBIDOS: 'Conta do plano de contas para juros e multas recebidos por atraso (receita financeira)',
  CONTA_DESCONTO_OBTIDO: 'Conta do plano de contas para descontos obtidos em pagamentos (receita / redução de despesa)',
  CONTA_DESCONTO_CONCEDIDO: 'Conta do plano de contas para descontos concedidos em recebimentos (despesa / redução de receita)',
}

export async function configuracoesRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return prisma.configuracao.findMany({ orderBy: { chave: 'asc' } })
  })

  app.get('/:chave', async (request, reply) => {
    const { chave } = request.params as { chave: string }
    const config = await prisma.configuracao.findUnique({ where: { chave } })
    if (!config) return reply.code(404).send({ error: 'Configuração não encontrada' })
    return config
  })

  // Upsert: cria a chave no primeiro save (evita depender de seed em bancos já existentes)
  app.put('/:chave', { preHandler: requirePerfil('ADMIN') }, async (request) => {
    const { chave } = request.params as { chave: string }
    const { valor } = AtualizarConfiguracaoSchema.parse(request.body)
    return prisma.configuracao.upsert({
      where: { chave },
      update: { valor },
      create: { chave, valor, descricao: DESCRICOES_CONFIG[chave] ?? null },
    })
  })
}
