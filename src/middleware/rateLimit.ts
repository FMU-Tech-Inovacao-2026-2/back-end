import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';

interface Options {
  windowMs: number;
  max: number;
  key: (req: Request) => string;
}

/** Limitador simples em memória (por processo). Suficiente para o protótipo. */
export function rateLimit({ windowMs, max, key }: Options) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const k = key(req);
    const entry = hits.get(k);

    if (!entry || entry.resetAt <= now) {
      hits.set(k, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      throw new AppError(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas. Tente novamente mais tarde.');
    }
    next();
  };
}
