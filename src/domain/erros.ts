/**
 * Erros de negócio, sem conhecimento de HTTP. O adaptador de entrada
 * (entrypoints/http) converte cada tipo no status adequado.
 */
export type TipoErro =
  | 'nao_autenticado'
  | 'sem_permissao'
  | 'nao_encontrado'
  | 'conflito'
  | 'dados_invalidos'
  | 'aceite_incompleto'
  | 'arquivo_grande'
  | 'muitas_tentativas'
  | 'indisponivel';

export class ErroDominio extends Error {
  constructor(
    public readonly tipo: TipoErro,
    public readonly codigo: string,
    message: string,
  ) {
    super(message);
    this.name = 'ErroDominio';
  }
}

export const naoAutenticado = (mensagem = 'Não autenticado') => new ErroDominio('nao_autenticado', 'NAO_AUTENTICADO', mensagem);
export const semPermissao = (mensagem = 'Sem permissão') => new ErroDominio('sem_permissao', 'SEM_PERMISSAO', mensagem);
export const naoEncontrado = (mensagem = 'Recurso não encontrado') => new ErroDominio('nao_encontrado', 'NAO_ENCONTRADO', mensagem);
export const conflito = (mensagem: string) => new ErroDominio('conflito', 'CONFLITO', mensagem);
export const dadosInvalidos = (mensagem: string) => new ErroDominio('dados_invalidos', 'DADOS_INVALIDOS', mensagem);
export const aceiteIncompleto = (mensagem: string) => new ErroDominio('aceite_incompleto', 'ACEITE_INCOMPLETO', mensagem);
export const arquivoGrande = (mensagem: string) => new ErroDominio('arquivo_grande', 'ARQUIVO_GRANDE', mensagem);
export const muitasTentativas = (mensagem = 'Muitas tentativas. Tente novamente mais tarde.') =>
  new ErroDominio('muitas_tentativas', 'MUITAS_TENTATIVAS', mensagem);
export const indisponivel = (mensagem: string) => new ErroDominio('indisponivel', 'SERVICO_INDISPONIVEL', mensagem);
