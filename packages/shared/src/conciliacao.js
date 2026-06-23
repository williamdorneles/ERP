// Seleção de correspondências para auto-conciliação bancária em lote.
const TOLERANCIA = 0.005;
export function selecionarAutoConciliacoes(transacoes, opts = {}) {
    const scoreMinimo = opts.scoreMinimo ?? 80;
    const margem = opts.margemAmbiguidade ?? 20;
    const candidatos = [];
    for (const tx of transacoes) {
        const melhor = tx.sugestoes[0];
        if (!melhor || melhor.score < scoreMinimo)
            continue;
        const segundo = tx.sugestoes[1];
        if (segundo && melhor.score - segundo.score < margem)
            continue;
        candidatos.push({
            transacaoId: tx.id,
            txNome: tx.nomeOriginal || tx.descricao || '—',
            txValor: tx.valor,
            tipo: tx.tipo,
            parcelaId: melhor.parcelaId,
            tituloDescricao: melhor.tituloDescricao,
            parcelaValor: melhor.valor,
            diffValor: melhor.diffValor,
            score: melhor.score,
            confianca: melhor.score >= 150 ? 'ALTA' : 'MEDIA',
            parcial: melhor.diffValor < -TOLERANCIA,
            sobrepago: melhor.diffValor > TOLERANCIA,
        });
    }
    const porParcela = new Map();
    for (const c of candidatos) {
        const atual = porParcela.get(c.parcelaId);
        if (!atual || c.score > atual.score)
            porParcela.set(c.parcelaId, c);
    }
    return [...porParcela.values()];
}
