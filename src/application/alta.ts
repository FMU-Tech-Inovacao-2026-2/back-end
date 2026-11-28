import {
  decidirSugestoes,
  hashDoConteudo,
  reprovacoesDaExtracao,
  validarAceite,
  verificarOrigem,
  type ExtracaoAlta,
  type OrigemEntrada,
  type PlanoAlta,
  type RegistroAceite,
  type ReprovacaoRegistrada,
  type ResumoExtracao,
  type TermoAceite,
  type UsoIA,
} from '../domain/alta';
import { arquivoGrande, conflito, dadosInvalidos, naoEncontrado } from '../domain/erros';
import { TERMO_ACEITE } from '../domain/termo-aceite';
import { toPublicUser, type PublicUser } from '../domain/usuario';
import {
  auditoriaNula,
  type AltaRepository,
  type Auditoria,
  type ExtratorIA,
  type FichaRepository,
  type GeradorId,
  type Relogio,
  type UserRepository,
} from './portas';

/** Entradas dos casos de uso. O adaptador HTTP valida e entrega neste formato. */
export type CriarExtracaoInput =
  | { origem: 'base'; paciente_id: string; sumario_id: string }
  | { origem: 'texto'; paciente_id: string; texto: string }
  | { origem: 'arquivo'; paciente_id: string; nome_arquivo: string; texto: string; transcricao_ia?: boolean }
  | { origem: 'ficha'; paciente_id: string; sumario_id: string };

export interface AprovarExtracaoInput {
  itens_aprovados: string[];
  itens_reprovados?: Array<{ id: string; motivo: string }>;
  sugestoes_editadas?: Array<{ id: string; titulo: string; descricao: string }>;
  aceite: { versao_termo: string; declaracoes: string[] };
}

export interface TranscreverPdfInput {
  nome_arquivo: string;
  pdf_base64: string;
}

export type PlanoComReprovacoes = PlanoAlta & { reprovacoes: ReprovacaoRegistrada[] };

const LIMITE_PDF_BYTES = 10 * 1024 * 1024;

interface Dependencias {
  users: UserRepository;
  repositorio: AltaRepository;
  ia: ExtratorIA;
  fichas?: FichaRepository;
  auditoria?: Auditoria;
  relogio?: Relogio;
  gerarId: GeradorId;
  termo?: TermoAceite;
}

/** Casos de uso do Alta Assistida. Orquestram portas e aplicam as regras do domínio. */
export class AltaService {
  private readonly deps: Required<Omit<Dependencias, 'fichas'>> & { fichas?: FichaRepository };

  constructor(deps: Dependencias) {
    this.deps = {
      ...deps,
      auditoria: deps.auditoria ?? auditoriaNula,
      relogio: deps.relogio ?? (() => new Date()),
      termo: deps.termo ?? TERMO_ACEITE,
    };
  }

  private registrarUsoIA(operacao: 'extracao' | 'transcricao', uso: UsoIA, profissionalId: string) {
    this.deps.auditoria.registrar('ia.chamada', { operacao, profissional_id: profissionalId, ...uso });
  }

  async listarPacientes(): Promise<PublicUser[]> {
    return (await this.deps.users.listPatients()).map(toPublicUser);
  }

  listarSumarios() {
    return this.deps.repositorio.listarSumarios();
  }

  termoAceite(): TermoAceite {
    return structuredClone(this.deps.termo);
  }

  private async lerEntrada(input: CriarExtracaoInput, pacienteId: string) {
    if (input.origem === 'base') {
      const sumario = await this.deps.repositorio.buscarSumario(input.sumario_id);
      if (!sumario) throw naoEncontrado('Sumário de exemplo não encontrado');
      return { texto: sumario.texto, sumario_id: sumario.id };
    }
    if (input.origem === 'ficha') {
      const sumario = this.deps.fichas ? await this.deps.fichas.buscarSumario(input.sumario_id) : null;
      if (!sumario || sumario.paciente_id !== pacienteId) throw naoEncontrado('Sumário não encontrado na ficha deste paciente');
      return {
        texto: sumario.texto,
        sumario_paciente_id: sumario.id,
        ...(sumario.nome_arquivo ? { nome_arquivo: sumario.nome_arquivo } : {}),
        ...(sumario.transcricao_ia ? { transcricao_ia: true } : {}),
      };
    }
    if (input.origem === 'arquivo') {
      return { texto: input.texto, nome_arquivo: input.nome_arquivo, ...(input.transcricao_ia ? { transcricao_ia: true } : {}) };
    }
    return { texto: input.texto };
  }

  async criarExtracao(input: CriarExtracaoInput, profissionalId: string): Promise<ExtracaoAlta> {
    const paciente = await this.deps.users.findById(input.paciente_id);
    if (!paciente || paciente.role !== 'paciente' || !paciente.ativo) throw naoEncontrado('Paciente não encontrado');

    const { texto, ...origemDoTexto } = await this.lerEntrada(input, paciente.id);
    const { conteudo, uso } = await this.deps.ia.extrair(texto);
    this.registrarUsoIA('extracao', uso, profissionalId);

    const sugestoes = conteudo.sugestoes.map((item) => ({
      ...item,
      id: this.deps.gerarId(),
      origem_verificada: verificarOrigem(item, texto),
    }));
    const extracao: ExtracaoAlta = {
      id: this.deps.gerarId(),
      paciente_id: paciente.id,
      profissional_id: profissionalId,
      origem: input.origem as OrigemEntrada,
      ...origemDoTexto,
      texto_original: texto,
      status: 'pendente',
      sugestoes,
      nao_informado: conteudo.nao_informado,
      criado_em: this.deps.relogio().toISOString(),
      ia: uso,
    };
    await this.deps.repositorio.salvarExtracao(extracao);
    this.deps.auditoria.registrar('alta.extracao_criada', {
      extracao_id: extracao.id,
      profissional_id: profissionalId,
      paciente_id: paciente.id,
      origem: input.origem,
      total_sugestoes: sugestoes.length,
      sugestoes_sem_origem: sugestoes.filter((item) => !item.origem_verificada).length,
      modelo: uso.modelo,
    });
    return extracao;
  }

  async buscarExtracao(id: string, profissionalId: string): Promise<ExtracaoAlta> {
    const extracao = await this.deps.repositorio.buscarExtracao(id);
    if (!extracao || extracao.profissional_id !== profissionalId) throw naoEncontrado('Extração não encontrada');
    return extracao;
  }

  async listarExtracoes(profissionalId: string, pacienteId?: string): Promise<ResumoExtracao[]> {
    const [todas, sumarios] = await Promise.all([
      this.deps.repositorio.listarExtracoesDoProfissional(profissionalId),
      this.deps.repositorio.listarSumarios(),
    ]);
    const extracoes = pacienteId ? todas.filter((item) => item.paciente_id === pacienteId) : todas;
    const titulos = new Map(sumarios.map((item) => [item.id, item.titulo]));
    for (const item of extracoes) {
      if (item.sumario_paciente_id && this.deps.fichas && !titulos.has(item.sumario_paciente_id)) {
        const daFicha = await this.deps.fichas.buscarSumario(item.sumario_paciente_id);
        if (daFicha) titulos.set(daFicha.id, daFicha.titulo);
      }
    }
    const nomes = new Map<string, string>();
    for (const id of new Set(extracoes.map((item) => item.paciente_id))) {
      nomes.set(id, (await this.deps.users.findById(id))?.nome ?? 'Paciente');
    }
    return extracoes.map((item) => ({
      id: item.id,
      paciente_id: item.paciente_id,
      paciente_nome: nomes.get(item.paciente_id) ?? 'Paciente',
      origem: item.origem,
      titulo: item.sumario_id
        ? titulos.get(item.sumario_id) ?? 'Sumário da base'
        : item.sumario_paciente_id
          ? titulos.get(item.sumario_paciente_id) ?? 'Sumário da ficha'
          : item.nome_arquivo ?? 'Texto digitado',
      status: item.status,
      total_sugestoes: item.sugestoes.length,
      total_aprovadas: item.itens_aprovados?.length ?? 0,
      criado_em: item.criado_em,
      ...(item.aprovado_em ? { aprovado_em: item.aprovado_em } : {}),
    }));
  }

  async aprovarExtracao(id: string, profissionalId: string, input: AprovarExtracaoInput): Promise<PlanoComReprovacoes> {
    const extracao = await this.buscarExtracao(id, profissionalId);
    if (extracao.status !== 'pendente') throw conflito('Esta extração já foi aprovada.');

    // Aceite humano explícito (LGPD e responsabilidade profissional).
    validarAceite(this.deps.termo, input.aceite);
    // Salvaguarda G2: cada sugestão aprovada (com origem) ou reprovada (com motivo).
    const { itens, decisoes, reprovacoes } = decidirSugestoes(extracao.sugestoes, {
      itens_aprovados: input.itens_aprovados,
      itens_reprovados: input.itens_reprovados ?? [],
      sugestoes_editadas: input.sugestoes_editadas ?? [],
    });

    const profissional = await this.deps.users.findById(profissionalId);
    const agora = this.deps.relogio().toISOString();
    const aceite: RegistroAceite = {
      versao_termo: this.deps.termo.versao,
      declaracoes: this.deps.termo.declaracoes.map((item) => ({ ...item })),
      profissional_id: profissionalId,
      profissional_nome: profissional?.nome ?? 'Profissional responsável',
      registrado_em: agora,
      hash_conteudo: hashDoConteudo(extracao.id, this.deps.termo.versao, itens, reprovacoes),
    };
    const plano: PlanoAlta = {
      id: this.deps.gerarId(),
      paciente_id: extracao.paciente_id,
      profissional_id: profissionalId,
      extracao_id: extracao.id,
      itens,
      criado_em: agora,
      aceite,
    };
    await this.deps.repositorio.salvarPlano(plano);
    await this.deps.repositorio.salvarExtracao({
      ...extracao,
      status: 'aprovado',
      itens_aprovados: itens.map((item) => item.id),
      decisoes,
      plano_id: plano.id,
      aprovado_em: agora,
    });
    this.deps.auditoria.registrar('alta.plano_aprovado', {
      plano_id: plano.id,
      extracao_id: extracao.id,
      profissional_id: profissionalId,
      paciente_id: extracao.paciente_id,
      itens_aprovados: itens.length,
      itens_editados: decisoes.filter((item) => item.editada).length,
      itens_reprovados: reprovacoes.length,
      reprovacoes_automaticas: reprovacoes.filter((item) => item.automatica).length,
      versao_termo: aceite.versao_termo,
      hash_conteudo: aceite.hash_conteudo,
    });
    return { ...plano, reprovacoes };
  }

  /** Plano, comprovante e reprovações (só para o profissional que aprovou). */
  async buscarPlanoDaExtracao(extracaoId: string, profissionalId: string): Promise<PlanoComReprovacoes> {
    const extracao = await this.buscarExtracao(extracaoId, profissionalId);
    const plano = extracao.plano_id ? await this.deps.repositorio.buscarPlano(extracao.plano_id) : null;
    if (!plano) throw naoEncontrado('Esta extração ainda não tem plano aprovado.');
    return { ...plano, reprovacoes: reprovacoesDaExtracao(extracao) };
  }

  /** Plano vigente do paciente para a ficha, sem registrar consulta do próprio paciente. */
  planoVigente(pacienteId: string): Promise<PlanoAlta | null> {
    return this.deps.repositorio.buscarPlanoDoPaciente(pacienteId);
  }

  /**
   * Transcrição literal de PDF pela IA. O texto NÃO é salvo aqui: volta para o
   * profissional conferir com o PDF original antes de qualquer extração.
   */
  async transcreverPdf(input: TranscreverPdfInput, profissionalId: string) {
    const pdf = Buffer.from(input.pdf_base64, 'base64');
    if (pdf.length > LIMITE_PDF_BYTES) throw arquivoGrande('O PDF deve ter no máximo 10 MB.');
    if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') throw dadosInvalidos('O arquivo enviado não é um PDF válido.');
    const { texto, uso } = await this.deps.ia.transcreverPdf(pdf);
    this.registrarUsoIA('transcricao', uso, profissionalId);
    this.deps.auditoria.registrar('alta.transcricao_pdf', { profissional_id: profissionalId, bytes: pdf.length, caracteres: texto.length, modelo: uso.modelo });
    return { texto, modelo: uso.modelo, transcricao_ia: true as const };
  }

  async meuPlano(pacienteId: string): Promise<PlanoAlta> {
    const plano = await this.deps.repositorio.buscarPlanoDoPaciente(pacienteId);
    if (!plano) throw naoEncontrado('Ainda não há um plano aprovado para sua conta.');
    this.deps.auditoria.registrar('alta.plano_consultado', { plano_id: plano.id, paciente_id: pacienteId });
    return plano;
  }
}
