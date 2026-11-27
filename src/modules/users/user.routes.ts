import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/authenticate';
import { toPublicUser } from './user.model';
import type { UserRepository } from './user.repository';

export function userRoutes(users: UserRepository, jwtSecret: string) {
  const router = Router();
  router.get('/pacientes', authenticate(jwtSecret), requireRole('profissional'), async (_req, res) => {
    res.json({ pacientes: (await users.listPatients()).map(toPublicUser) });
  });
  return router;
}
