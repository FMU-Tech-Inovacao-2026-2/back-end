import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Auditoria, EventoAuditoria } from '../../application/portas';
import { logger } from '../log/logger';

export interface RegistroAuditoria {
  evento: EventoAuditoria;
  registrado_em: string;
  [campo: string]: unknown;
}

/** Campos que nunca entram na trilha, mesmo se um caso de uso os enviar por engano. */
const CAMPOS_PROIBIDOS = new Set([
  'texto',
  'texto_original',
  'trecho_origem',
  'titulo',
  'descricao',
  'sugestoes',
  'motivo',
  'senha',
  'senha_provisoria',
  'pdf_base64',
  'nome',
  'data_nascimento',
  'telefone',
  'observacoes',
  'email',
  'accessToken',
]);

/**
 * Trilha de auditoria sem conteúdo clínico (LGPD, art. 6º, III e X).
 * Cada evento vai ao log estruturado (Cloud Logging em produção) e, se
 * `arquivo` for informado, também a um arquivo JSONL (uma linha por evento).
 */
export class AuditoriaLog implements Auditoria {
  /** Últimos registros em memória, úteis para testes e inspeção local. */
  readonly recentes: RegistroAuditoria[] = [];
  private fila: Promise<void> = Promise.resolve();

  constructor(
    private readonly opcoes: { arquivo?: string; limite?: number; relogio?: () => Date } = {},
  ) {}

  registrar(evento: EventoAuditoria, campos: Record<string, unknown> = {}) {
    const seguros = Object.fromEntries(Object.entries(campos).filter(([chave]) => !CAMPOS_PROIBIDOS.has(chave)));
    const registro: RegistroAuditoria = { ...seguros, evento, registrado_em: (this.opcoes.relogio?.() ?? new Date()).toISOString() };
    this.recentes.push(registro);
    if (this.recentes.length > (this.opcoes.limite ?? 500)) this.recentes.shift();
    logger.info({ auditoria: registro }, `auditoria:${evento}`);
    if (this.opcoes.arquivo) this.gravar(this.opcoes.arquivo, registro);
  }

  /** Grava em ordem, sem bloquear a requisição. Falha de disco vira aviso, nunca erro ao usuário. */
  private gravar(arquivo: string, registro: RegistroAuditoria) {
    this.fila = this.fila
      .then(async () => {
        await mkdir(dirname(arquivo), { recursive: true });
        await appendFile(arquivo, `${JSON.stringify(registro)}\n`, 'utf8');
      })
      .catch((erro: unknown) => {
        logger.warn({ err: erro instanceof Error ? erro.message : 'desconhecido' }, 'falha ao gravar auditoria JSONL');
      });
  }

  /** Aguarda as gravações pendentes (encerramento e testes). */
  async esvaziar() {
    await this.fila;
  }
}
