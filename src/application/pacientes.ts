import { conflito as conflict, naoEncontrado as notFound } from '../domain/erros';
import { resumirSumario, type FichaPaciente, type ResumoSumario, type SumarioPaciente } from '../domain/paciente';
import {
  auditoriaNula,
  type Auditoria,
  type FichaRepository,
  type GeradorId,
  type Relogio,
  type ServicoSenha,
  type UserRepository,
} from './portas';

export interface CriarPacienteInput {
  nome: string;
  email: string;
  data_nascimento: string;
  numero_prontuario: string;
  telefone?: string;
  responsavel?: string;
  observacoes?: string;
}

export type AtualizarPacienteInput = Partial<Omit<CriarPacienteInput, 'email'>>;

export type CriarSumarioInput =
  | { origem: 'texto'; titulo: string; texto: string }
  | { origem: 'arquivo'; titulo: string; nome_arquivo: string; texto: string }
  | { origem: 'pdf_ia'; titulo: string; nome_arquivo: string; texto: string; transcricao_conferida: true };

export interface PacienteNaLista extends FichaPaciente {
  total_sumarios: number;
  ultimo_sumario_em?: string;
}

interface Dependencias {
  users: UserRepository;
  fichas: FichaRepository;
  senhas: ServicoSenha;
  gerarId: GeradorId;
  /** Gera a senha provisória (adaptador de segurança). */
  gerarSenhaProvisoria: () => string;
  auditoria?: Auditoria;
  relogio?: Relogio;
}

export class PacienteService {
  private readonly clock: Relogio;
  private readonly auditoria: Auditoria;
  private readonly users: UserRepository;
  private readonly fichas: FichaRepository;

  constructor(private readonly deps: Dependencias) {
    this.users = deps.users;
    this.fichas = deps.fichas;
    this.clock = deps.relogio ?? (() => new Date());
    this.auditoria = deps.auditoria ?? auditoriaNula;
  }

  async listar(busca?: string): Promise<PacienteNaLista[]> {
    const termo = busca?.trim().toLocaleLowerCase('pt-BR');
    const fichas = (await this.fichas.listar()).filter((ficha) =>
      !termo || ficha.nome.toLocaleLowerCase('pt-BR').includes(termo) || ficha.numero_prontuario.toLowerCase().includes(termo),
    );
    return Promise.all(fichas.map(async (ficha) => {
      const sumarios = await this.fichas.listarSumarios(ficha.id);
      return { ...ficha, total_sumarios: sumarios.length, ...(sumarios[0] ? { ultimo_sumario_em: sumarios[0].criado_em } : {}) };
    }));
  }

  async criar(input: CriarPacienteInput, profissionalId: string) {
    if (await this.users.findByEmail(input.email)) throw conflict('Já existe uma conta com este e-mail.');
    if (await this.fichas.buscarPorProntuario(input.numero_prontuario)) throw conflict('Já existe um paciente com este número de prontuário.');

    const id = this.deps.gerarId();
    const senhaProvisoria = this.deps.gerarSenhaProvisoria();
    await this.users.save({ id, nome: input.nome, email: input.email, senhaHash: await this.deps.senhas.hash(senhaProvisoria), role: 'paciente', ativo: true });
    const ficha: FichaPaciente = {
      id,
      nome: input.nome,
      email: input.email,
      data_nascimento: input.data_nascimento,
      numero_prontuario: input.numero_prontuario.toUpperCase(),
      ...(input.telefone ? { telefone: input.telefone } : {}),
      ...(input.responsavel ? { responsavel: input.responsavel } : {}),
      ...(input.observacoes ? { observacoes: input.observacoes } : {}),
      criado_em: this.clock().toISOString(),
      criado_por: profissionalId,
    };
    await this.fichas.salvar(ficha);
    this.auditoria.registrar('paciente.criado', { paciente_id: id, profissional_id: profissionalId });
    return { paciente: ficha, senha_provisoria: senhaProvisoria };
  }

  async buscar(id: string): Promise<FichaPaciente> {
    const ficha = await this.fichas.buscar(id);
    if (!ficha) throw notFound('Paciente não encontrado');
    return ficha;
  }

  async ficha(id: string, profissionalId: string): Promise<{ paciente: FichaPaciente; sumarios: ResumoSumario[] }> {
    const paciente = await this.buscar(id);
    const sumarios = (await this.fichas.listarSumarios(id)).map(resumirSumario);
    this.auditoria.registrar('paciente.consultado', { paciente_id: id, profissional_id: profissionalId });
    return { paciente, sumarios };
  }

  async atualizar(id: string, input: AtualizarPacienteInput, profissionalId: string): Promise<FichaPaciente> {
    const atual = await this.buscar(id);
    if (input.numero_prontuario) {
      const outro = await this.fichas.buscarPorProntuario(input.numero_prontuario);
      if (outro && outro.id !== id) throw conflict('Já existe um paciente com este número de prontuário.');
    }
    const atualizada: FichaPaciente = {
      ...atual,
      ...Object.fromEntries(Object.entries(input).filter(([, valor]) => valor !== undefined)),
      ...(input.numero_prontuario ? { numero_prontuario: input.numero_prontuario.toUpperCase() } : {}),
      atualizado_em: this.clock().toISOString(),
    };
    await this.fichas.salvar(atualizada);
    if (input.nome) {
      const conta = await this.users.findById(id);
      if (conta) await this.users.save({ ...conta, nome: input.nome });
    }
    this.auditoria.registrar('paciente.atualizado', { paciente_id: id, profissional_id: profissionalId, campos: Object.keys(input) });
    return atualizada;
  }

  async criarSumario(pacienteId: string, input: CriarSumarioInput, profissionalId: string): Promise<SumarioPaciente> {
    await this.buscar(pacienteId);
    const sumario: SumarioPaciente = {
      id: this.deps.gerarId(),
      paciente_id: pacienteId,
      titulo: input.titulo,
      origem: input.origem,
      ...(input.origem !== 'texto' ? { nome_arquivo: input.nome_arquivo } : {}),
      texto: input.texto,
      transcricao_ia: input.origem === 'pdf_ia',
      criado_em: this.clock().toISOString(),
      criado_por: profissionalId,
    };
    await this.fichas.salvarSumario(sumario);
    this.auditoria.registrar('paciente.sumario_criado', { paciente_id: pacienteId, sumario_id: sumario.id, profissional_id: profissionalId, origem: input.origem });
    return sumario;
  }

  async buscarSumario(pacienteId: string, sumarioId: string): Promise<SumarioPaciente> {
    const sumario = await this.fichas.buscarSumario(sumarioId);
    if (!sumario || sumario.paciente_id !== pacienteId) throw notFound('Sumário não encontrado');
    return sumario;
  }
}
