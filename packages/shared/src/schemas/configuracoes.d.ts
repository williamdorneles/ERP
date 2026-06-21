import { z } from 'zod';
export declare const MetodoCustoEnum: z.ZodEnum<["MEDIO", "ULTIMO"]>;
export declare const AtualizarConfiguracaoSchema: z.ZodObject<{
    valor: z.ZodString;
}, "strip", z.ZodTypeAny, {
    valor: string;
}, {
    valor: string;
}>;
export type MetodoCusto = z.infer<typeof MetodoCustoEnum>;
export type AtualizarConfiguracaoInput = z.infer<typeof AtualizarConfiguracaoSchema>;
//# sourceMappingURL=configuracoes.d.ts.map