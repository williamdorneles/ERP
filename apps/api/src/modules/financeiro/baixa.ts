// Cálculo de saldo em baixa de parcela (total ou parcial).
// Centralizado para que conciliação e baixa de título compartilhem a mesma regra.

export interface ResultadoBaixa {
  /** Saldo restante da parcela após o valor pago (>= 0). */
  restante: number
  /** true quando o pagamento não cobre a parcela e um saldo deve ser gerado. */
  isParcial: boolean
}

/**
 * Dado o valor da parcela e o valor efetivamente pago, retorna o saldo restante
 * e se a baixa é parcial. Usa tolerância de meio centavo para evitar saldos
 * residuais por arredondamento. Pagamento igual ou maior que a parcela = baixa total.
 */
export function calcularSaldoBaixa(valorParcela: number, valorPago: number): ResultadoBaixa {
  const restante = Number((valorParcela - valorPago).toFixed(2))
  const isParcial = restante > 0.005
  return { restante: isParcial ? restante : 0, isParcial }
}

const round2 = (n: number) => Number(n.toFixed(2))

/** Rótulos das contas de encargo (mensagens de erro e descrição das linhas de DRE). */
export const LABEL_CONTA: Record<string, string> = {
  CONTA_TARIFA_BANCARIA: 'Tarifa bancária',
  CONTA_JUROS_PAGOS: 'Juros/multa pagos',
  CONTA_JUROS_RECEBIDOS: 'Juros/multa recebidos',
}

export interface LinhaEncargo {
  /** Chave de configuração da conta de DRE onde o encargo é lançado. */
  chaveConta: string
  valor: number
}

/**
 * Monta as linhas de encargo (tarifa/juros/multa) de uma conciliação, escolhendo
 * a conta de DRE conforme o tipo do título. Juros e multa são somados numa linha.
 * - PAGAR:   tarifa → CONTA_TARIFA_BANCARIA, juros/multa → CONTA_JUROS_PAGOS
 * - RECEBER: juros/multa → CONTA_JUROS_RECEBIDOS (tarifa não se aplica a recebimento)
 * Retorna apenas linhas com valor positivo.
 */
export function montarLinhasEncargo(
  tipoTitulo: 'PAGAR' | 'RECEBER',
  e: { tarifa?: number; juros?: number; multa?: number },
): LinhaEncargo[] {
  const linhas: LinhaEncargo[] = []
  const tarifa = round2(e.tarifa ?? 0)
  const jurosMulta = round2((e.juros ?? 0) + (e.multa ?? 0))

  if (tipoTitulo === 'PAGAR' && tarifa > 0) {
    linhas.push({ chaveConta: 'CONTA_TARIFA_BANCARIA', valor: tarifa })
  }
  if (jurosMulta > 0) {
    linhas.push({
      chaveConta: tipoTitulo === 'PAGAR' ? 'CONTA_JUROS_PAGOS' : 'CONTA_JUROS_RECEBIDOS',
      valor: jurosMulta,
    })
  }
  return linhas
}

/** Soma o valor de todas as linhas de encargo. */
export function somaEncargos(linhas: LinhaEncargo[]): number {
  return round2(linhas.reduce((s, l) => s + l.valor, 0))
}

/**
 * Deriva o status de um título a partir do status das suas parcelas.
 * - Sem abertas e sem quitadas (todas canceladas) → CANCELADO
 * - Sem abertas e com quitadas → QUITADO
 * - Com abertas e alguma quitada → PARCIAL
 * - Caso contrário → ABERTO
 */
export function statusTituloPorParcelas(statuses: string[]): 'ABERTO' | 'PARCIAL' | 'QUITADO' | 'CANCELADO' {
  const abertas = statuses.filter(s => s === 'ABERTO').length
  const quitadas = statuses.filter(s => s === 'QUITADO').length
  if (abertas === 0 && quitadas === 0) return 'CANCELADO'
  if (abertas === 0) return 'QUITADO'
  if (quitadas > 0) return 'PARCIAL'
  return 'ABERTO'
}
