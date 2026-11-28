import type { NextFunction, Request, Response } from 'express';
import type { ServicoToken } from '../../../application/portas';
import { naoAutenticado, semPermissao } from '../../../domain/erros';
import type { Role } from '../../../domain/usuario';

export interface SessaoToken {
  sub: string;
  role: string;
  iat: number;
  exp: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: SessaoToken;
  }
}

/** Exige `Authorization: Bearer <token>` válido e não expirado. */
export const autenticar =
  (tokens: ServicoToken) => (req: Request, _res: Response, next: NextFunction) => {
    const [esquema, token] = (req.headers.authorization ?? '').split(' ');
    if (esquema?.toLowerCase() !== 'bearer' || !token) throw naoAutenticado('Token ausente');
    const sessao = tokens.verificar(token);
    if (!sessao) throw naoAutenticado('Token inválido ou expirado');
    req.auth = sessao;
    next();
  };

/** Autorização por perfil no servidor. Uso: router.get('/x', autenticar(t), exigirPerfil('profissional'), handler). */
export const exigirPerfil =
  (...perfis: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !perfis.includes(req.auth.role as Role)) throw semPermissao();
    next();
  };
