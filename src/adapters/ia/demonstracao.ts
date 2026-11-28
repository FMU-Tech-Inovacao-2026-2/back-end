import type { ExtratorIA, ResultadoExtracaoIA, ResultadoTranscricaoIA } from '../../application/portas';
import { indisponivel } from '../../domain/erros';
import { RESPOSTAS_DEMONSTRACAO, SUMARIOS } from './catalogo';

/**
 * Adaptador da porta ExtratorIA SEM IA, para apresentações e ambientes sem
 * credencial do Gemini. Só reconhece os sumários fictícios do catálogo e
 * devolve respostas preparadas. As salvaguardas do domínio continuam valendo.
 */
export class ExtratorDemonstracao implements ExtratorIA {
  async extrair(texto: string): Promise<ResultadoExtracaoIA> {
    const inicio = Date.now();
    const sumario = SUMARIOS.find((item) => item.texto.trim() === texto.trim());
    const resposta = sumario ? RESPOSTAS_DEMONSTRACAO[sumario.id] : undefined;
    if (!resposta) {
      throw indisponivel('Este ambiente está em modo demonstração: escolha um sumário da base. Textos livres exigem a IA configurada.');
    }
    return {
      conteudo: structuredClone(resposta),
      uso: { modelo: 'demonstracao', tokens_entrada: 0, tokens_saida: 0, duracao_ms: Date.now() - inicio, reparos: 0 },
    };
  }

  async transcreverPdf(): Promise<ResultadoTranscricaoIA> {
    throw indisponivel('Leitura de PDF pela IA exige a IA configurada (GEMINI_PROVEDOR=api-key ou vertex). PDFs com texto selecionável continuam sendo lidos no navegador.');
  }
}
