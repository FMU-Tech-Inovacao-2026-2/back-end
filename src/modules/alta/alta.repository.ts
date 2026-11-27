import { randomUUID } from 'node:crypto';
import { SUMARIOS } from './alta.catalogo';
import type { ExtracaoAlta, PlanoAlta, SumarioCatalogo } from './alta.model';

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

export const novoId = () => randomUUID();
