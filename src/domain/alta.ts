import { createHash } from 'node:crypto';
import { aceiteIncompleto, dadosInvalidos, naoEncontrado, semPermissao } from './erros';

/**
 * Domínio do Alta Assistida: entidades e regras puras. Não conhece Express,
 * Zod, Gemini nem persistência. Toda regra de segurança clínica mora aqui.
 */
export type CategoriaAlta = 'medicamento' | 'cuidado' | 'alerta' | 'retorno';
export type StatusAlta = 'pendente' | 'aprovado';
export type OrigemEntrada = 'base' | 'texto' | 'arquivo' | 'ficha';

export interface SugestaoAlta {
  id: string;
  categoria: CategoriaAlta;
  titulo: string;
  descricao: string;
  trecho_origem: string;
  /** Calculado pelo servidor (salvaguarda S2), nunca pelo modelo. */
  origem_verificada: boolean;
}

export interface SumarioCatalogo {
  id: string;
  titulo: string;
  descricao: string;
  texto: string;
}

/** Consumo de uma chamada de IA, sem conteúdo clínico. */
export interface UsoIA {
  modelo: string;
  tokens_entrada: number;
  tokens_saida: number;
  duracao_ms: number;
  /** Tentativas de reparo da resposta (salvaguarda S1). */
  reparos: number;
}

/** Decisão do profissional sobre uma sugestão (salvaguarda G2). */
export interface DecisaoSugestao {
  id: string;
  decisao: 'aprovada' | 'reprovada';
  /** Obrigatório na reprovação. */
  motivo?: string;
  /** true quando o servidor reprovou por origem não confirmada. */
  automatica: boolean;
  editada: boolean;
}

export interface ExtracaoAlta {
  id: string;
  paciente_id: string;
  profissional_id: string;
  origem: OrigemEntrada;
  sumario_id?: string;
  sumario_paciente_id?: string;
  nome_arquivo?: string;
  transcricao_ia?: boolean;
  texto_original: string;
  status: StatusAlta;
  sugestoes: SugestaoAlta[];
  nao_informado: string[];
  criado_em: string;
  /** Modelo e consumo da IA que gerou as sugestões. */
  ia?: UsoIA;
  itens_aprovados?: string[];
  decisoes?: DecisaoSugestao[];
  plano_id?: string;
  aprovado_em?: string;
}

/** Linha da lista de extrações do profissional, sem texto clínico. */
export interface ResumoExtracao {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  origem: OrigemEntrada;
  titulo: string;
  status: StatusAlta;
  total_sugestoes: number;
  total_aprovadas: number;
  criado_em: string;
  aprovado_em?: string;
}

export interface DeclaracaoAceite {
  id: string;
  texto: string;
}

export interface TermoAceite {
  versao: string;
  titulo: string;
  resumo: string;
  declaracoes: DeclaracaoAceite[];
}

/** Evidência do aceite humano gravada junto ao plano. */
export interface RegistroAceite {
  versao_termo: string;
  declaracoes: DeclaracaoAceite[];
  profissional_id: string;
  profissional_nome: string;
  registrado_em: string;
  /** SHA-256 da extração, versão do termo, itens aprovados e reprovações. */
  hash_conteudo: string;
}

export interface PlanoAlta {
  id: string;
  paciente_id: string;
  profissional_id: string;
  extracao_id: string;
  itens: SugestaoAlta[];
  criado_em: string;
  aceite: RegistroAceite;
}

/** Reprovação mostrada ao profissional no comprovante. Nunca vai ao paciente. */
export interface ReprovacaoRegistrada {
  id: string;
  categoria: CategoriaAlta;
  titulo: string;
  trecho_origem: string;
  motivo: string;
  automatica: boolean;
}

export interface ConteudoExtraido {
  sugestoes: Array<Omit<SugestaoAlta, 'id' | 'origem_verificada'>>;
  nao_informado: string[];
}

export const MOTIVO_ORIGEM_NAO_CONFIRMADA = 'Origem não confirmada no texto original (bloqueio automático do servidor).';
export const MOTIVO_MINIMO = 3;
export const MOTIVO_MAXIMO = 500;

/**
 * Normaliza para comparar citações: remove hifenização de quebra de linha
 * (comum em PDF), acentos, aspas e espaços extras, e ignora maiúsculas.
 */
export function normalizarTexto(texto: string) {
  return texto
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, '$1$2')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[“”"'‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

/** Salvaguarda S2: a citação só vale se existir no texto original. O que o modelo declara não basta. */
export function verificarOrigem(sugestao: Pick<SugestaoAlta, 'trecho_origem'>, textoOriginal: string) {
  const trecho = normalizarTexto(sugestao.trecho_origem);
  return trecho.length >= 8 && normalizarTexto(textoOriginal).includes(trecho);
}

/** Exige a versão vigente do termo e todas as declarações. */
export function validarAceite(termo: TermoAceite, aceite: { versao_termo: string; declaracoes: string[] }) {
  if (aceite.versao_termo !== termo.versao) {
    throw aceiteIncompleto('O termo de aceite mudou. Recarregue a página e confirme a versão atual.');
  }
  const declaradas = new Set(aceite.declaracoes);
  if (termo.declaracoes.some((item) => !declaradas.has(item.id))) {
    throw aceiteIncompleto('Confirme todas as declarações do termo de aceite antes de aprovar.');
  }
}

export interface EntradaDecisoes {
  itens_aprovados: string[];
  itens_reprovados: Array<{ id: string; motivo: string }>;
  sugestoes_editadas: Array<{ id: string; titulo: string; descricao: string }>;
}

/**
 * Salvaguarda G2: toda sugestão recebe uma decisão explícita. Aprovar exige
 * origem verificada; reprovar exige motivo. Itens sem origem confirmada são
 * reprovados automaticamente. Nada fica sem registro.
 */
export function decidirSugestoes(sugestoes: SugestaoAlta[], entrada: EntradaDecisoes) {
  const porId = new Map(sugestoes.map((item) => [item.id, item]));
  const aprovados = new Set(entrada.itens_aprovados);
  const motivos = new Map(entrada.itens_reprovados.map((item) => [item.id, item.motivo.trim()]));
  const edicoes = new Map(entrada.sugestoes_editadas.map((item) => [item.id, item]));

  if (aprovados.size === 0) throw dadosInvalidos('Aceite pelo menos uma sugestão.');
  for (const id of [...aprovados, ...motivos.keys(), ...edicoes.keys()]) {
    if (!porId.has(id)) throw naoEncontrado('Uma ou mais sugestões não pertencem a esta extração.');
  }
  if ([...motivos.keys()].some((id) => aprovados.has(id))) {
    throw dadosInvalidos('Uma sugestão não pode ser aprovada e reprovada ao mesmo tempo.');
  }
  if ([...edicoes.keys()].some((id) => !aprovados.has(id))) {
    throw semPermissao('Só é possível editar sugestões selecionadas para aprovação.');
  }

  const decisoes: DecisaoSugestao[] = [];
  const itens: SugestaoAlta[] = [];
  const reprovacoes: ReprovacaoRegistrada[] = [];
  const semMotivo: string[] = [];

  for (const sugestao of sugestoes) {
    if (aprovados.has(sugestao.id)) {
      if (!sugestao.origem_verificada) {
        throw semPermissao('Há sugestões sem trecho de origem confirmado. Elas não podem ser aprovadas.');
      }
      const edicao = edicoes.get(sugestao.id);
      itens.push(edicao ? { ...sugestao, titulo: edicao.titulo, descricao: edicao.descricao } : sugestao);
      decisoes.push({ id: sugestao.id, decisao: 'aprovada', automatica: false, editada: Boolean(edicao) });
      continue;
    }
    const automatica = !sugestao.origem_verificada;
    const motivo = motivos.get(sugestao.id) || (automatica ? MOTIVO_ORIGEM_NAO_CONFIRMADA : '');
    if (motivo.length < MOTIVO_MINIMO) {
      semMotivo.push(sugestao.titulo);
      continue;
    }
    const final = motivo.slice(0, MOTIVO_MAXIMO);
    decisoes.push({ id: sugestao.id, decisao: 'reprovada', motivo: final, automatica, editada: false });
    reprovacoes.push({ id: sugestao.id, categoria: sugestao.categoria, titulo: sugestao.titulo, trecho_origem: sugestao.trecho_origem, motivo: final, automatica });
  }

  if (semMotivo.length) {
    throw dadosInvalidos(`Informe o motivo da reprovação de: ${semMotivo.join('; ')}.`);
  }
  return { itens, decisoes, reprovacoes };
}

/** Integridade do que foi decidido: aprovados (com edições) e reprovações com motivo. */
export function hashDoConteudo(extracaoId: string, versaoTermo: string, itens: SugestaoAlta[], reprovacoes: ReprovacaoRegistrada[] = []) {
  const canonico = JSON.stringify({
    extracao_id: extracaoId,
    versao_termo: versaoTermo,
    itens: itens.map(({ id, categoria, titulo, descricao, trecho_origem }) => ({ id, categoria, titulo, descricao, trecho_origem })),
    reprovacoes: reprovacoes.map(({ id, motivo, automatica }) => ({ id, motivo, automatica })),
  });
  return createHash('sha256').update(canonico).digest('hex');
}

/** Reconstrói as reprovações a partir das decisões gravadas na extração. */
export function reprovacoesDaExtracao(extracao: ExtracaoAlta): ReprovacaoRegistrada[] {
  const porId = new Map(extracao.sugestoes.map((item) => [item.id, item]));
  return (extracao.decisoes ?? [])
    .filter((decisao) => decisao.decisao === 'reprovada')
    .flatMap((decisao) => {
      const sugestao = porId.get(decisao.id);
      return sugestao
        ? [{ id: sugestao.id, categoria: sugestao.categoria, titulo: sugestao.titulo, trecho_origem: sugestao.trecho_origem, motivo: decisao.motivo ?? '', automatica: decisao.automatica }]
        : [];
    });
}
