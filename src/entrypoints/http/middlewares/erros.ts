import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../../adapters/log/logger';
import { ErroDominio, type TipoErro } from '../../../domain/erros';

/** Único lugar que traduz erro de negócio em status HTTP. */
const STATUS: Record<TipoErro, number> = {
  nao_autenticado: 401,
  sem_permissao: 403,
  nao_encontrado: 404,
  conflito: 409,
  dados_invalidos: 400,
  aceite_incompleto: 422,
  arquivo_grande: 413,
  muitas_tentativas: 429,
  indisponivel: 503,
};

export function rotaNaoEncontrada(_req: Request, res: Response) {
  res.status(404).json({ erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Rota não encontrada' } });
}

export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      erro: {
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Dados inválidos',
        detalhes: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
      },
    });
  }

  if (err instanceof ErroDominio) {
    return res.status(STATUS[err.tipo]).json({ erro: { codigo: err.codigo, mensagem: err.message } });
  }

  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
    return res.status(413).json({ erro: { codigo: 'ARQUIVO_GRANDE', mensagem: 'O conteúdo enviado passou do limite permitido.' } });
  }

  // JSON malformado no corpo
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ erro: { codigo: 'JSON_INVALIDO', mensagem: 'Corpo da requisição não é um JSON válido' } });
  }

  logger.error({ err }, 'erro não tratado');
  res.status(500).json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' } });
}
