export interface SugestaoConciliacao {
    parcelaId: string;
    tituloDescricao: string;
    valor: number;
    diffValor: number;
    score: number;
}
export interface TransacaoComSugestoes {
    id: string;
    tipo: 'DEBITO' | 'CREDITO';
    valor: number;
    nomeOriginal: string | null;
    descricao: string | null;
    sugestoes: SugestaoConciliacao[];
}
export interface AutoCandidato {
    transacaoId: string;
    txNome: string;
    txValor: number;
    tipo: 'DEBITO' | 'CREDITO';
    parcelaId: string;
    tituloDescricao: string;
    parcelaValor: number;
    diffValor: number;
    score: number;
    confianca: 'ALTA' | 'MEDIA';
    parcial: boolean;
    sobrepago: boolean;
}
export interface OpcoesAutoConciliacao {
    scoreMinimo?: number;
    margemAmbiguidade?: number;
}
export declare function selecionarAutoConciliacoes(transacoes: TransacaoComSugestoes[], opts?: OpcoesAutoConciliacao): AutoCandidato[];
