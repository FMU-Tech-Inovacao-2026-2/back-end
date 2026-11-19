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
