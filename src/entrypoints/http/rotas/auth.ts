import { Router } from 'express';
import type { AuthService } from '../../../application/auth';
import type { ServicoToken } from '../../../application/portas';
import { loginSchema } from '../esquemas/auth';
import { autenticar } from '../middlewares/autenticacao';
import { limitar } from '../middlewares/limite';

export function rotasAuth(auth: AuthService, tokens: ServicoToken) {
  const router = Router();

  // 10 tentativas a cada 15 minutos por IP + e-mail.
  const limiteLogin = limitar({
    janelaMs: 15 * 60 * 1000,
    maximo: 10,
    chave: (req) => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`,
  });

  // O Express 5 repassa erros de handlers async para o tratador de erros.
  router.post('/login', limiteLogin, async (req, res) => {
    res.json(await auth.login(loginSchema.parse(req.body)));
  });

  router.get('/me', autenticar(tokens), async (req, res) => {
    res.json({ user: await auth.me(req.auth!.sub) });
  });

  return router;
}
