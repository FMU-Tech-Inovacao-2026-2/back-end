import type { NextFunction, Request, Response } from 'express';
import { verifyJwt, type TokenPayload } from '../lib/jwt';
import { forbidden, unauthorized } from '../lib/errors';
import type { Role } from '../modules/users/user.model';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: TokenPayload;
  }
}

export const authenticate =
  (jwtSecret: string) => (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw unauthorized('Token ausente');

    const payload = verifyJwt(token, jwtSecret);
    if (!payload) throw unauthorized('Token inválido ou expirado');

    req.auth = payload;
    next();
  };

/** Uso: router.get('/x', authenticate(secret), requireRole('profissional'), handler) */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role as Role)) throw forbidden();
    next();
  };
