/**
 * Ficha do paciente (fichário). Minimização (LGPD, art. 6º, III): só o necessário
 * para identificar o paciente na unidade, contatá-lo e organizar a alta.
 * Não há CPF, endereço nem dados financeiros.
 */
export interface FichaPaciente {
  /** Mesmo ID da conta de acesso do paciente. */
  id: string;
  nome: string;
  email: string;
  /** AAAA-MM-DD */
  data_nascimento: string;
  /** Identificador interno da unidade (ex.: PAC-0042). */
  numero_prontuario: string;
  telefone?: string;
  responsavel?: string;
  /** Anotações administrativas. A IA não lê este campo. */
  observacoes?: string;
  criado_em: string;
  criado_por?: string;
  atualizado_em?: string;
}

/** Como o sumário entrou na ficha. */
export type OrigemSumario = 'texto' | 'arquivo' | 'pdf_ia';

export interface SumarioPaciente {
  id: string;
  paciente_id: string;
  titulo: string;
  origem: OrigemSumario;
  nome_arquivo?: string;
  texto: string;
  /** true quando o texto veio de transcrição de PDF pela IA e foi conferido pelo profissional. */
  transcricao_ia: boolean;
  criado_em: string;
  criado_por: string;
}

/** Linha da lista de sumários, sem o texto clínico. */
export type ResumoSumario = Omit<SumarioPaciente, 'texto'> & { caracteres: number };

export const resumirSumario = ({ texto, ...resto }: SumarioPaciente): ResumoSumario => ({
  ...resto,
  caracteres: texto.length,
});
