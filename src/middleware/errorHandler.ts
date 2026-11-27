import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Rota não encontrada' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      erro: {
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Dados inválidos',
        detalhes: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: { codigo: err.code, mensagem: err.message } });
  }

  // JSON malformado no body
  if (err instanceof SyntaxError && 'body' in err) {
    return res
      .status(400)
      .json({ erro: { codigo: 'JSON_INVALIDO', mensagem: 'Corpo da requisição não é um JSON válido' } });
  }

  logger.error({ err }, 'erro não tratado');
  res.status(500).json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' } });
}
