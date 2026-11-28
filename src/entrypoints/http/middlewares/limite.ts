import type { NextFunction, Request, Response } from 'express';
import { muitasTentativas } from '../../../domain/erros';

interface Opcoes {
  janelaMs: number;
  maximo: number;
  chave: (req: Request) => string;
}

/** Limitador simples em memória (por processo). Suficiente para o piloto com uma instância. */
export function limitar({ janelaMs, maximo, chave }: Opcoes) {
  const acessos = new Map<string, { total: number; reiniciaEm: number }>();

  setInterval(() => {
    const agora = Date.now();
    for (const [k, v] of acessos) if (v.reiniciaEm <= agora) acessos.delete(k);
  }, janelaMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const agora = Date.now();
    const k = chave(req);
    const registro = acessos.get(k);
    if (!registro || registro.reiniciaEm <= agora) {
      acessos.set(k, { total: 1, reiniciaEm: agora + janelaMs });
      return next();
    }
    registro.total += 1;
    if (registro.total > maximo) {
      res.setHeader('Retry-After', Math.ceil((registro.reiniciaEm - agora) / 1000));
      throw muitasTentativas();
    }
    next();
  };
}
