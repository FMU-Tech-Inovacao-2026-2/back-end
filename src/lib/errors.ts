export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = (message = 'Não autenticado') =>
  new AppError(401, 'NAO_AUTENTICADO', message);
export const forbidden = (message = 'Sem permissão') => new AppError(403, 'SEM_PERMISSAO', message);
export const notFound = (message = 'Recurso não encontrado') => new AppError(404, 'NAO_ENCONTRADO', message);
export const conflict = (message: string) => new AppError(409, 'CONFLITO', message);
export const aceiteIncompleto = (message: string) => new AppError(422, 'ACEITE_INCOMPLETO', message);
export const unavailable = (message: string) => new AppError(503, 'SERVICO_INDISPONIVEL', message);
