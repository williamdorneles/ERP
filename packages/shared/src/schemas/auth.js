import { z } from 'zod';
export const LoginSchema = z.object({
    email: z.string().email('E-mail inválido'),
    senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
});
export const UsuarioSchema = z.object({
    id: z.string().uuid(),
    nome: z.string().min(2),
    email: z.string().email(),
    perfil: z.enum(['ADMIN', 'GERENTE', 'PRODUCAO', 'VENDAS', 'FINANCEIRO', 'ESTOQUE']),
    ativo: z.boolean().default(true),
    criadoEm: z.coerce.date(),
});
//# sourceMappingURL=auth.js.map