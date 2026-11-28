import type { ConteudoExtraido, ExtracaoAlta, PlanoAlta, SumarioCatalogo, UsoIA } from '../domain/alta';
import type { FichaPaciente, SumarioPaciente } from '../domain/paciente';
import type { User } from '../domain/usuario';

/**
 * Portas da aplicação: o que os casos de uso precisam do mundo externo.
 * Os adaptadores (adapters/) implementam estas interfaces; os casos de uso
 * nunca importam Express, Gemini, pino ou bibliotecas de criptografia.
 */

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  listPatients(): Promise<User[]>;
  /** Cria ou atualiza a conta (upsert por ID). */
  save(user: User): Promise<void>;
}

export interface AltaRepository {
  listarSumarios(): Promise<SumarioCatalogo[]>;
  buscarSumario(id: string): Promise<SumarioCatalogo | null>;
  salvarExtracao(extracao: ExtracaoAlta): Promise<void>;
  buscarExtracao(id: string): Promise<ExtracaoAlta | null>;
  listarExtracoesDoProfissional(profissionalId: string): Promise<ExtracaoAlta[]>;
  salvarPlano(plano: PlanoAlta): Promise<void>;
  buscarPlanoDoPaciente(pacienteId: string): Promise<PlanoAlta | null>;
  buscarPlano(id: string): Promise<PlanoAlta | null>;
}

export interface FichaRepository {
  listar(): Promise<FichaPaciente[]>;
  buscar(id: string): Promise<FichaPaciente | null>;
  buscarPorProntuario(numero: string): Promise<FichaPaciente | null>;
  salvar(ficha: FichaPaciente): Promise<void>;
  listarSumarios(pacienteId: string): Promise<SumarioPaciente[]>;
  buscarSumario(id: string): Promise<SumarioPaciente | null>;
  salvarSumario(sumario: SumarioPaciente): Promise<void>;
}

export interface ResultadoExtracaoIA {
  conteudo: ConteudoExtraido;
  uso: UsoIA;
}

export interface ResultadoTranscricaoIA {
  texto: string;
  uso: UsoIA;
}

/** Porta da IA. A saída sempre passa pelas salvaguardas do domínio antes de chegar a alguém. */
export interface ExtratorIA {
  extrair(texto: string): Promise<ResultadoExtracaoIA>;
  /** Transcreve literalmente o texto de um PDF (inclusive digitalizado). */
  transcreverPdf(pdf: Buffer): Promise<ResultadoTranscricaoIA>;
}

export interface ServicoSenha {
  hash(senha: string): Promise<string>;
  verificar(senha: string, hash: string): Promise<boolean>;
}

export interface ClaimsToken {
  sub: string;
  role: string;
}

export interface ServicoToken {
  emitir(claims: ClaimsToken): string;
  /** Devolve as claims se o token for válido e não expirado; senão, null. */
  verificar(token: string): (ClaimsToken & { iat: number; exp: number }) | null;
  readonly validadeSegundos: number;
}

/**
 * Trilha de auditoria SEM conteúdo clínico (LGPD, art. 6º, III e X).
 * Registra quem fez o quê, quando e sobre quais IDs.
 */
export type EventoAuditoria =
  | 'auth.login_sucesso'
  | 'auth.login_falha'
  | 'alta.extracao_criada'
  | 'alta.extracao_consultada'
  | 'alta.plano_aprovado'
  | 'alta.plano_consultado'
  | 'alta.transcricao_pdf'
  | 'ia.chamada'
  | 'paciente.criado'
  | 'paciente.atualizado'
  | 'paciente.consultado'
  | 'paciente.sumario_criado';

export interface Auditoria {
  registrar(evento: EventoAuditoria, campos?: Record<string, unknown>): void;
}

export const auditoriaNula: Auditoria = { registrar: () => undefined };

export type Relogio = () => Date;
export type GeradorId = () => string;
