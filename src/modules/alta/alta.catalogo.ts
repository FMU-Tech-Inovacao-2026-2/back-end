import type { ConteudoExtraido, SumarioCatalogo } from './alta.model';

/**
 * Sumários FICTÍCIOS do catálogo. Mantenha sincronizado com
 * PitchInicial/pitchInicial/data/sumarios-ficticios.
 */
export const SUMARIOS: SumarioCatalogo[] = [
  {
    id: 'sumario-cardiaco-01',
    titulo: 'Alta após internação cardiológica (fictício)',
    descricao: 'Caso completo com medicação, cuidados, retorno e sinal de alerta.',
    texto: `SUMÁRIO DE ALTA HOSPITALAR — CASO FICTÍCIO\n\nPaciente: Paciente Demo (identificação inventada)\n\nDiagnóstico de alta: insuficiência cardíaca descompensada.\n\nMedicações na alta:\n- Furosemida 40 mg por via oral pela manhã, durante 7 dias.\n- Enalapril 10 mg por via oral a cada 12 horas.\n\nCuidados: pesar-se todos os dias pela manhã e anotar o peso.\n\nRetorno: consulta com cardiologia em 14 dias.\n\nSinais de alerta: procurar atendimento se houver falta de ar em repouso ou inchaço que piore.`,
  },
  {
    id: 'sumario-pos-operatorio-02',
    titulo: 'Alta após procedimento (fictício)',
    descricao: 'Caso curto com analgesia, cuidado local e retorno.',
    texto: `SUMÁRIO DE ALTA — CASO FICTÍCIO\n\nPaciente: Paciente Demo (identificação inventada)\n\nMedicação: Paracetamol 750 mg por via oral a cada 8 horas se houver dor, por até 3 dias.\n\nCuidados: manter o curativo limpo e seco até a avaliação da equipe.\n\nRetorno: retornar ao ambulatório em 7 dias para revisão.`,
  },
];

/**
 * Respostas preparadas para GEMINI_PROVEDOR=demonstracao. Imitam a saída da IA,
 * inclusive um erro proposital (citação que não existe no texto) para mostrar
 * que o servidor bloqueia a aprovação quando a origem não é confirmada.
 */
export const RESPOSTAS_DEMONSTRACAO: Record<string, ConteudoExtraido> = {
  'sumario-cardiaco-01': {
    sugestoes: [
      { categoria: 'medicamento', titulo: 'Furosemida 40 mg', descricao: 'Via oral pela manhã, durante 7 dias.', trecho_origem: 'Furosemida 40 mg por via oral pela manhã, durante 7 dias.' },
      { categoria: 'medicamento', titulo: 'Enalapril 10 mg', descricao: 'Via oral a cada 12 horas.', trecho_origem: 'Enalapril 10 mg por via oral a cada 12 horas.' },
      { categoria: 'medicamento', titulo: 'Enalapril 10 mg à noite', descricao: 'Sugestão com citação que não existe no sumário (erro proposital da demonstração).', trecho_origem: 'Enalapril 10 mg por via oral à noite.' },
      { categoria: 'cuidado', titulo: 'Acompanhar o peso', descricao: 'Pesar-se todos os dias pela manhã e anotar o resultado.', trecho_origem: 'pesar-se todos os dias pela manhã e anotar o peso.' },
      { categoria: 'retorno', titulo: 'Consulta com cardiologia', descricao: 'Retorno em 14 dias.', trecho_origem: 'consulta com cardiologia em 14 dias.' },
      { categoria: 'alerta', titulo: 'Falta de ar ou inchaço', descricao: 'Procurar atendimento se houver falta de ar em repouso ou inchaço que piore.', trecho_origem: 'procurar atendimento se houver falta de ar em repouso ou inchaço que piore.' },
    ],
    nao_informado: ['Horário exato da Enalapril', 'Peso de referência para comparação'],
  },
  'sumario-pos-operatorio-02': {
    sugestoes: [
      { categoria: 'medicamento', titulo: 'Paracetamol 750 mg se houver dor', descricao: 'Via oral a cada 8 horas, se houver dor, por até 3 dias.', trecho_origem: 'Paracetamol 750 mg por via oral a cada 8 horas se houver dor, por até 3 dias.' },
      { categoria: 'cuidado', titulo: 'Cuidar do curativo', descricao: 'Manter limpo e seco até a avaliação da equipe.', trecho_origem: 'manter o curativo limpo e seco até a avaliação da equipe.' },
      { categoria: 'retorno', titulo: 'Retorno ao ambulatório', descricao: 'Revisão em 7 dias.', trecho_origem: 'retornar ao ambulatório em 7 dias para revisão.' },
    ],
    nao_informado: ['Sinais de alerta para procurar atendimento'],
  },
};
