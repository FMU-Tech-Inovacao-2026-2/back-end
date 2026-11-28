import { randomUUID } from 'node:crypto';
import type { AltaRepository, FichaRepository, UserRepository } from '../../application/portas';
import type { ExtracaoAlta, PlanoAlta, SumarioCatalogo } from '../../domain/alta';
import type { FichaPaciente, SumarioPaciente } from '../../domain/paciente';
import type { User } from '../../domain/usuario';
import { SUMARIOS } from '../ia/catalogo';
import { hashPassword } from '../seguranca/senhas';

/**
 * Persistência em memória (adaptador das portas de repositório). Os dados somem
 * ao reiniciar o processo. Para dados reais, implemente as mesmas portas com um
 * banco gerenciado.
 */

export const novoId = () => randomUUID();

export class InMemoryUserRepository implements UserRepository {
  private readonly users: User[];

  constructor(users: User[] = []) {
    this.users = users;
  }

  async save(user: User) {
    const indice = this.users.findIndex((u) => u.id === user.id);
    const copia = { ...user, email: user.email.trim().toLowerCase() };
    if (indice >= 0) this.users[indice] = copia;
    else this.users.push(copia);
  }

  async findByEmail(email: string) {
    const e = email.trim().toLowerCase();
    return this.users.find((u) => u.email === e) ?? null;
  }

  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async listPatients() {
    return this.users.filter((u) => u.role === 'paciente' && u.ativo);
  }
}

/** Usuários FICTÍCIOS para desenvolvimento. Nunca usados em produção. */
export async function buildDevRepository(): Promise<InMemoryUserRepository> {
  return new InMemoryUserRepository([
    {
      id: 'u-001',
      nome: 'Dra. Ana Demo',
      email: 'medica@demo.altaassistida.dev',
      senhaHash: await hashPassword('Demo@12345'),
      role: 'profissional',
      ativo: true,
    },
    {
      id: 'u-002',
      nome: 'Paciente Demo',
      email: 'paciente@demo.altaassistida.dev',
      senhaHash: await hashPassword('Demo@12345'),
      role: 'paciente',
      ativo: true,
    },
  ]);
}

/**
 * Persistência em memória: os dados somem ao reiniciar o processo. Para
 * produção com dados reais, implemente esta interface com um banco gerenciado.
 */
export class InMemoryAltaRepository implements AltaRepository {
  private readonly sumarios = SUMARIOS;
  private readonly extracoes = new Map<string, ExtracaoAlta>();
  /** Plano vigente de cada paciente (o mais recente aprovado). */
  private readonly planos = new Map<string, PlanoAlta>();
  /** Todos os planos por ID, para o profissional consultar o comprovante de aceite. */
  private readonly planosPorId = new Map<string, PlanoAlta>();

  async listarSumarios() {
    return this.sumarios.map((sumario) => ({ ...sumario }));
  }

  async buscarSumario(id: string) {
    const sumario = this.sumarios.find((item) => item.id === id);
    return sumario ? { ...sumario } : null;
  }

  async salvarExtracao(extracao: ExtracaoAlta) {
    this.extracoes.set(extracao.id, structuredClone(extracao));
  }

  async buscarExtracao(id: string) {
    const extracao = this.extracoes.get(id);
    return extracao ? structuredClone(extracao) : null;
  }

  async listarExtracoesDoProfissional(profissionalId: string) {
    return [...this.extracoes.values()]
      .filter((item) => item.profissional_id === profissionalId)
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
      .map((item) => structuredClone(item));
  }

  async salvarPlano(plano: PlanoAlta) {
    this.planos.set(plano.paciente_id, structuredClone(plano));
    this.planosPorId.set(plano.id, structuredClone(plano));
  }

  async buscarPlanoDoPaciente(pacienteId: string) {
    const plano = this.planos.get(pacienteId);
    return plano ? structuredClone(plano) : null;
  }

  async buscarPlano(id: string) {
    const plano = this.planosPorId.get(id);
    return plano ? structuredClone(plano) : null;
  }
}


/** Fichário em memória: some ao reiniciar. Para dados reais, implemente com um banco gerenciado. */
export class InMemoryFichaRepository implements FichaRepository {
  private readonly fichas = new Map<string, FichaPaciente>();
  private readonly sumarios = new Map<string, SumarioPaciente>();

  constructor(iniciais: FichaPaciente[] = []) {
    for (const ficha of iniciais) this.fichas.set(ficha.id, structuredClone(ficha));
  }

  async listar() {
    return [...this.fichas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((item) => structuredClone(item));
  }

  async buscar(id: string) {
    const ficha = this.fichas.get(id);
    return ficha ? structuredClone(ficha) : null;
  }

  async buscarPorProntuario(numero: string) {
    const alvo = numero.trim().toUpperCase();
    const ficha = [...this.fichas.values()].find((item) => item.numero_prontuario.toUpperCase() === alvo);
    return ficha ? structuredClone(ficha) : null;
  }

  async salvar(ficha: FichaPaciente) {
    this.fichas.set(ficha.id, structuredClone(ficha));
  }

  async listarSumarios(pacienteId: string) {
    return [...this.sumarios.values()]
      .filter((item) => item.paciente_id === pacienteId)
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
      .map((item) => structuredClone(item));
  }

  async buscarSumario(id: string) {
    const sumario = this.sumarios.get(id);
    return sumario ? structuredClone(sumario) : null;
  }

  async salvarSumario(sumario: SumarioPaciente) {
    this.sumarios.set(sumario.id, structuredClone(sumario));
  }
}

/** Ficha FICTÍCIA da conta paciente de desenvolvimento (u-002). */
export const FICHAS_DEMONSTRACAO: FichaPaciente[] = [
  {
    id: 'u-002',
    nome: 'Paciente Demo',
    email: 'paciente@demo.altaassistida.dev',
    data_nascimento: '1958-03-14',
    numero_prontuario: 'PAC-0042',
    responsavel: 'Familiar Demo (fictício)',
    criado_em: '2026-11-01T12:00:00.000Z',
  },
];
