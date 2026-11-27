import { logger } from './logger';

/**
 * Trilha de auditoria SEM conteúdo clínico (LGPD, art. 6º, III e X: necessidade
 * e responsabilização). Registra quem fez o quê, quando e sobre quais IDs.
 * Nunca registra texto de sumário, sugestão, citação ou credencial.
 */
export type EventoAuditoria =
  | 'auth.login_sucesso'
  | 'auth.login_falha'
  | 'alta.extracao_criada'
  | 'alta.extracao_consultada'
  | 'alta.plano_aprovado'
  | 'alta.plano_consultado';

export interface RegistroAuditoria {
  evento: EventoAuditoria;
  registrado_em: string;
  [campo: string]: unknown;
}

const CAMPOS_PROIBIDOS = new Set([
  'texto',
  'texto_original',
  'trecho_origem',
  'titulo',
  'descricao',
  'sugestoes',
  'senha',
  'email',
  'accessToken',
]);

export interface Auditoria {
  registrar(evento: EventoAuditoria, campos?: Record<string, unknown>): void;
}

export class AuditoriaLog implements Auditoria {
  /** Últimos registros em memória, úteis para testes e inspeção local. */
  readonly recentes: RegistroAuditoria[] = [];

  constructor(
    private readonly limite = 500,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  registrar(evento: EventoAuditoria, campos: Record<string, unknown> = {}) {
    const seguros = Object.fromEntries(Object.entries(campos).filter(([chave]) => !CAMPOS_PROIBIDOS.has(chave)));
    const registro: RegistroAuditoria = { ...seguros, evento, registrado_em: this.clock().toISOString() };
    this.recentes.push(registro);
    if (this.recentes.length > this.limite) this.recentes.shift();
    logger.info({ auditoria: registro }, `auditoria:${evento}`);
  }
}

export const auditoriaNula: Auditoria = { registrar: () => undefined };
