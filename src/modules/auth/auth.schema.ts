import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email('E-mail inválido')),
  // limite superior evita DoS por senhas gigantes no scrypt
  senha: z.string().min(1, 'Senha obrigatória').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;