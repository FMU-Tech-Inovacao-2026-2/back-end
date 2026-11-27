import { unavailable } from '../../lib/errors';
import { RESPOSTAS_DEMONSTRACAO, SUMARIOS } from './alta.catalogo';
import type { ConteudoExtraido, ExtratorAlta } from './alta.model';

/**
 * Extrator SEM IA para apresentações e ambientes sem credencial do Gemini.
 * Só reconhece os sumários fictícios do catálogo e devolve respostas
 * preparadas. A verificação de origem continua sendo feita pelo serviço.
 */
export class ExtratorDemonstracao implements ExtratorAlta {
  async extrair(texto: string): Promise<ConteudoExtraido> {
    const sumario = SUMARIOS.find((item) => item.texto.trim() === texto.trim());
    const resposta = sumario ? RESPOSTAS_DEMONSTRACAO[sumario.id] : undefined;
    if (!resposta) {
      throw unavailable('Este ambiente está em modo demonstração: escolha um sumário da base. Textos livres exigem a IA configurada.');
    }
    return structuredClone(resposta);
  }
}
