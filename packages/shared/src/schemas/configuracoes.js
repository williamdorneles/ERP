import { z } from 'zod';
export const MetodoCustoEnum = z.enum(['MEDIO', 'ULTIMO']);
export const AtualizarConfiguracaoSchema = z.object({
    valor: z.string().max(200),
});
//# sourceMappingURL=configuracoes.js.map