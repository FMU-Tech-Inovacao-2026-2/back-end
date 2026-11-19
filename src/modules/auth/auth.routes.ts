import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { loginSchema } from './auth.schema';
import type { AuthService } from './auth.service';

export function authRoutes(service: AuthService, jwtSecret: string) {
  const router = Router();

  // 10 tentativas / 15 min por IP + e-mail
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    key: (req) => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`,
  });

  // Express 5 repassa erros de handlers async para o errorHandler automaticamente
  router.post('/login', loginLimiter, async (req, res) => {
    const input = loginSchema.parse(req.body);
    res.json(await service.login(input));
  });

  router.get('/me', authenticate(jwtSecret), async (req, res) => {
    res.json({ user: await service.me(req.auth!.sub) });
  });

  return router;
}
