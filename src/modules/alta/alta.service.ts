import { createHash } from 'node:crypto';
import { auditoriaNula, type Auditoria } from '../../lib/auditoria';
import { aceiteIncompleto, conflict, forbidden, notFound } from '../../lib/errors';
import { toPublicUser, type PublicUser } from '../users/user.model';
import type { UserRepository } from '../users/user.repository';
import type { AprovarExtracaoInput, CriarExtracaoInput } from './alta.schema';
import { novoId, type AltaRepository } from './alta.repository';
import { TERMO_ACEITE } from './alta.termo';
import type {
  ConteudoExtraido,
  ExtracaoAlta,
  ExtratorAlta,
  PlanoAlta,
  RegistroAceite,
  ResumoExtracao,
  SugestaoAlta,
  TermoAceite,
} from './alta.model';

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

/** A citação só é aceita se existir no texto original. O que o modelo declara não basta. */
export function verificarOrigem(sugestao: Pick<SugestaoAlta, 'trecho_origem'>, textoOriginal: string) {
  const trecho = normalizar(sugestao.trecho_origem);
  return trecho.length >= 8 && normalizar(textoOriginal).includes(trecho);
}

export function hashDoConteudo(extracaoId: string, versaoTermo: string, itens: SugestaoAlta[]) {
  const canonico = JSON.stringify({
    extracao_id: extracaoId,
    versao_termo: versaoTermo,
    itens: itens.map(({ id, categoria, titulo, descricao, trecho_origem }) => ({ id, categoria, titulo, descricao, trecho_origem })),
  });
  return createHash('sha256').update(canonico).digest('hex');
}

interface Opcoes {
  clock?: () => Date;
  auditoria?: Auditoria;
  termo?: TermoAceite;
}

export class AltaService {
  private readonly clock: () => Date;
  private readonly auditoria: Auditoria;
  private readonly termo: TermoAceite;

  constructor(
    private readonly users: UserRepository,
    private readonly repository: AltaRepository,
    private readonly extractor: ExtratorAlta,
    opcoes: Opcoes = {},
  ) {
    this.clock = opcoes.clock ?? (() => new Date());
    this.auditoria = opcoes.auditoria ?? auditoriaNula;
    this.termo = opcoes.termo ?? TERMO_ACEITE;
  }

  async listarPacientes(): Promise<PublicUser[]> {
    return (await this.users.listPatients()).map(toPublicUser);
  }

  listarSumarios() {
    return this.repository.listarSumarios();
  }

  termoAceite(): TermoAceite {
    return structuredClone(this.termo);
  }

  async criarExtracao(input: CriarExtracaoInput, profissionalId: string): Promise<ExtracaoAlta> {
    const paciente = await this.users.findById(input.paciente_id);
    if (!paciente || paciente.role !== 'paciente' || !paciente.ativo) throw notFound('Paciente não encontrado');

    let textoOriginal: string;
    let sumarioId: string | undefined;
    let nomeArquivo: string | undefined;
    if (input.origem === 'base') {
      const sumario = await this.repository.buscarSumario(input.sumario_id);
      if (!sumario) throw notFound('Sumário de exemplo não encontrado');
      textoOriginal = sumario.texto;
      sumarioId = sumario.id;
    } else {
      textoOriginal = input.texto;
      if (input.origem === 'arquivo') nomeArquivo = input.nome_arquivo;
    }

    const conteudo: ConteudoExtraido = await this.extractor.extrair(textoOriginal);
    const sugestoes = conteudo.sugestoes.map((item) => ({
      ...item,
      id: novoId(),
      origem_verificada: verificarOrigem(item, textoOriginal),
    }));
    const extracao: ExtracaoAlta = {
      id: novoId(),
      paciente_id: paciente.id,
      profissional_id: profissionalId,
      origem: input.origem,
      ...(sumarioId ? { sumario_id: sumarioId } : {}),
      ...(nomeArquivo ? { nome_arquivo: nomeArquivo } : {}),
      texto_original: textoOriginal,
      status: 'pendente',
      sugestoes,
      nao_informado: conteudo.nao_informado,
      criado_em: this.clock().toISOString(),
    };
    await this.repository.salvarExtracao(extracao);
    this.auditoria.registrar('alta.extracao_criada', {
      extracao_id: extracao.id,
      profissional_id: profissionalId,
      paciente_id: paciente.id,
      origem: input.origem,
      total_sugestoes: sugestoes.length,
      sugestoes_sem_origem: sugestoes.filter((item) => !item.origem_verificada).length,
    });
    return extracao;
  }

  async buscarExtracao(id: string, profissionalId: string): Promise<ExtracaoAlta> {
    const extracao = await this.repository.buscarExtracao(id);
    if (!extracao || extracao.profissional_id !== profissionalId) throw notFound('Extração não encontrada');
    return extracao;
  }

  async listarExtracoes(profissionalId: string): Promise<ResumoExtracao[]> {
    const [extracoes, sumarios] = await Promise.all([
      this.repository.listarExtracoesDoProfissional(profissionalId),
      this.repository.listarSumarios(),
    ]);
    const titulos = new Map(sumarios.map((item) => [item.id, item.titulo]));
    const nomes = new Map<string, string>();
    for (const id of new Set(extracoes.map((item) => item.paciente_id))) {
      nomes.set(id, (await this.users.findById(id))?.nome ?? 'Paciente');
    }
    return extracoes.map((item) => ({
      id: item.id,
      paciente_id: item.paciente_id,
      paciente_nome: nomes.get(item.paciente_id) ?? 'Paciente',
      origem: item.origem,
      titulo: item.sumario_id
        ? titulos.get(item.sumario_id) ?? 'Sumário da base'
        : item.nome_arquivo ?? 'Texto digitado',
      status: item.status,
      total_sugestoes: item.sugestoes.length,
      total_aprovadas: item.itens_aprovados?.length ?? 0,
      criado_em: item.criado_em,
      ...(item.aprovado_em ? { aprovado_em: item.aprovado_em } : {}),
    }));
  }

  async aprovarExtracao(id: string, profissionalId: string, input: AprovarExtracaoInput): Promise<PlanoAlta> {
    const extracao = await this.buscarExtracao(id, profissionalId);
    if (extracao.status !== 'pendente') throw conflict('Esta extração já foi aprovada.');

    // Aceite humano explícito (LGPD e responsabilidade profissional): versão vigente e todas as declarações.
    if (input.aceite.versao_termo !== this.termo.versao) {
      throw aceiteIncompleto('O termo de aceite mudou. Recarregue a página e confirme a versão atual.');
    }
    const declaradas = new Set(input.aceite.declaracoes);
    const faltando = this.termo.declaracoes.filter((item) => !declaradas.has(item.id));
    if (faltando.length > 0) {
      throw aceiteIncompleto('Confirme todas as declarações do termo de aceite antes de aprovar.');
    }

    const ids = new Set(input.itens_aprovados);
    const edicoes = new Map((input.sugestoes_editadas ?? []).map((item) => [item.id, item]));
    if ([...edicoes.keys()].some((id) => !ids.has(id))) {
      throw forbidden('Só é possível editar sugestões selecionadas para aprovação.');
    }
    const itens = extracao.sugestoes.filter((item) => ids.has(item.id)).map((item) => {
      const edicao = edicoes.get(item.id);
      return edicao ? { ...item, titulo: edicao.titulo, descricao: edicao.descricao } : item;
    });
    if (itens.length !== ids.size) throw notFound('Uma ou mais sugestões não pertencem a esta extração.');
    if (itens.some((item) => !item.origem_verificada)) {
      throw forbidden('Há sugestões sem trecho de origem confirmado. Elas não podem ser aprovadas.');
    }

    const profissional = await this.users.findById(profissionalId);
    const agora = this.clock().toISOString();
    const aceite: RegistroAceite = {
      versao_termo: this.termo.versao,
      declaracoes: this.termo.declaracoes.map((item) => ({ ...item })),
      profissional_id: profissionalId,
      profissional_nome: profissional?.nome ?? 'Profissional responsável',
      registrado_em: agora,
      hash_conteudo: hashDoConteudo(extracao.id, this.termo.versao, itens),
    };
    const plano: PlanoAlta = {
      id: novoId(),
      paciente_id: extracao.paciente_id,
      profissional_id: profissionalId,
      extracao_id: extracao.id,
      itens,
      criado_em: agora,
      aceite,
    };
    await this.repository.salvarPlano(plano);
    await this.repository.salvarExtracao({ ...extracao, status: 'aprovado', itens_aprovados: [...ids], plano_id: plano.id, aprovado_em: agora });
    this.auditoria.registrar('alta.plano_aprovado', {
      plano_id: plano.id,
      extracao_id: extracao.id,
      profissional_id: profissionalId,
      paciente_id: extracao.paciente_id,
      itens_aprovados: itens.length,
      itens_editados: edicoes.size,
      itens_reprovados: extracao.sugestoes.length - itens.length,
      versao_termo: aceite.versao_termo,
      hash_conteudo: aceite.hash_conteudo,
    });
    return plano;
  }

  /** Plano e comprovante de aceite de uma extração aprovada pelo próprio profissional. */
  async buscarPlanoDaExtracao(extracaoId: string, profissionalId: string): Promise<PlanoAlta> {
    const extracao = await this.buscarExtracao(extracaoId, profissionalId);
    const plano = extracao.plano_id ? await this.repository.buscarPlano(extracao.plano_id) : null;
    if (!plano) throw notFound('Esta extração ainda não tem plano aprovado.');
    return plano;
  }

  async meuPlano(pacienteId: string): Promise<PlanoAlta> {
    const plano = await this.repository.buscarPlanoDoPaciente(pacienteId);
    if (!plano) throw notFound('Ainda não há um plano aprovado para sua conta.');
    this.auditoria.registrar('alta.plano_consultado', { plano_id: plano.id, paciente_id: pacienteId });
    return plano;
  }
}
