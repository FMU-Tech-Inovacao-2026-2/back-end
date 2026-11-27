export type CategoriaAlta = 'medicamento' | 'cuidado' | 'alerta' | 'retorno';
export type StatusAlta = 'pendente' | 'aprovado';
export type OrigemEntrada = 'base' | 'texto' | 'arquivo';

export interface SugestaoAlta {
  id: string;
  categoria: CategoriaAlta;
  titulo: string;
  descricao: string;
  trecho_origem: string;
  origem_verificada: boolean;
}

export interface SumarioCatalogo {
  id: string;
  titulo: string;
  descricao: string;
  texto: string;
}

export interface ExtracaoAlta {
  id: string;
  paciente_id: string;
  profissional_id: string;
  origem: OrigemEntrada;
  sumario_id?: string;
  nome_arquivo?: string;
  texto_original: string;
  status: StatusAlta;
  sugestoes: SugestaoAlta[];
  nao_informado: string[];
  criado_em: string;
  itens_aprovados?: string[];
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
  /** SHA-256 dos itens aprovados, versão do termo e extração: prova de integridade do que foi aceito. */
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

export interface ConteudoExtraido {
  sugestoes: Array<Omit<SugestaoAlta, 'id' | 'origem_verificada'>>;
  nao_informado: string[];
}

export interface ExtratorAlta {
  extrair(texto: string): Promise<ConteudoExtraido>;
}
