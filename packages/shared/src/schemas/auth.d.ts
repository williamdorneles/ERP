import { z } from 'zod';
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    senha: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    senha: string;
}, {
    email: string;
    senha: string;
}>;
export declare const UsuarioSchema: z.ZodObject<{
    id: z.ZodString;
    nome: z.ZodString;
    email: z.ZodString;
    perfil: z.ZodEnum<["ADMIN", "GERENTE", "PRODUCAO", "VENDAS", "FINANCEIRO", "ESTOQUE"]>;
    ativo: z.ZodDefault<z.ZodBoolean>;
    criadoEm: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    email: string;
    id: string;
    nome: string;
    perfil: "ADMIN" | "GERENTE" | "PRODUCAO" | "VENDAS" | "FINANCEIRO" | "ESTOQUE";
    ativo: boolean;
    criadoEm: Date;
}, {
    email: string;
    id: string;
    nome: string;
    perfil: "ADMIN" | "GERENTE" | "PRODUCAO" | "VENDAS" | "FINANCEIRO" | "ESTOQUE";
    criadoEm: Date;
    ativo?: boolean | undefined;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type Usuario = z.infer<typeof UsuarioSchema>;
//# sourceMappingURL=auth.d.ts.map