import type { TermoAceite } from './alta';

/**
 * Termo de aceite do profissional. O texto é a fonte única: o front-end busca
 * em GET /alta/termo-aceite e o servidor grava no plano exatamente estas
 * declarações. Ao mudar o texto, incremente a versão.
 *
 * A redação é acadêmica e precisa de validação jurídica antes de uso real.
 */
export const TERMO_ACEITE: TermoAceite = {
  versao: '2026-11-v1',
  titulo: 'Termo de aceite profissional',
  resumo:
    'As sugestões foram organizadas por inteligência artificial a partir do sumário informado. Elas só chegam ao paciente depois desta confirmação.',
  declaracoes: [
    {
      id: 'revisao_integral',
      texto: 'Revisei cada item aprovado e conferi o trecho de origem correspondente no sumário de alta.',
    },
    {
      id: 'ciente_limitacoes_ia',
      texto:
        'Estou ciente de que a IA pode omitir, interpretar mal ou errar informações e de que as sugestões não substituem meu julgamento clínico.',
    },
    {
      id: 'decisao_profissional',
      texto:
        'Assumo a decisão profissional sobre o conteúdo aprovado, que será disponibilizado ao paciente como orientação de alta.',
    },
    {
      id: 'finalidade_lgpd',
      texto:
        'Uso os dados de saúde deste paciente somente para a tutela da sua saúde e a continuidade do cuidado, conforme a LGPD (Lei nº 13.709/2018, art. 11, II, "f").',
    },
  ],
};
