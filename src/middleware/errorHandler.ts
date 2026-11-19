import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NAO_ENCONTRADO', message: 'Rota não encontrada' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'DADOS_INVALIDOS',
        message: 'Dados inválidos',
        details: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  // JSON malformado no body
  if (err instanceof SyntaxError && 'body' in err) {
    return res
      .status(400)
      .json({ error: { code: 'JSON_INVALIDO', message: 'Corpo da requisição não é um JSON válido' } });
  }

  logger.error({ err }, 'erro não tratado');
  res.status(500).json({ error: { code: 'ERRO_INTERNO', message: 'Erro interno do servidor' } });
}
