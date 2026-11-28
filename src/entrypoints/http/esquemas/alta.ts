import { z } from 'zod';

const pacienteId = z.string().trim().min(1).max(100);

export const criarExtracaoSchema = z.discriminatedUnion('origem', [
  z.object({
    origem: z.literal('base'),
    paciente_id: pacienteId,
    sumario_id: z.string().trim().min(1).max(100),
  }),
  z.object({
    origem: z.literal('texto'),
    paciente_id: pacienteId,
    texto: z.string().trim().min(1, 'Informe o texto do sumário').max(20_000),
  }),
  z.object({
    origem: z.literal('arquivo'),
    paciente_id: pacienteId,
    nome_arquivo: z.string().trim().min(1).max(180),
    texto: z.string().trim().min(1, 'Não foi possível ler texto do arquivo').max(20_000),
    /** true quando o texto veio da transcrição de PDF pela IA, conferida pelo profissional. */
    transcricao_ia: z.boolean().optional(),
  }),
  z.object({
    origem: z.literal('ficha'),
    paciente_id: pacienteId,
    sumario_id: z.string().trim().min(1).max(100),
  }),
]);

/** PDF em base64 (até 10 MB de arquivo). */
export const transcreverPdfSchema = z.object({
  nome_arquivo: z.string().trim().min(1).max(180),
  pdf_base64: z.string().min(10).max(14_000_000),
});

export const aceiteSchema = z.object({
  versao_termo: z.string().trim().min(1).max(40),
  declaracoes: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
});

export const aprovarExtracaoSchema = z.object({
  itens_aprovados: z.array(z.string().min(1)).min(1, 'Aceite pelo menos uma sugestão.').max(100),
  sugestoes_editadas: z.array(z.object({
    id: z.string().min(1),
    titulo: z.string().trim().min(1).max(180),
    descricao: z.string().trim().min(1).max(1000),
  })).max(100).optional(),
  /** Salvaguarda G2: cada sugestão não aprovada precisa de motivo (as sem origem confirmada são reprovadas pelo servidor). */
  itens_reprovados: z.array(z.object({
    id: z.string().min(1),
    motivo: z.string().trim().min(3, 'Explique o motivo da reprovação (mínimo de 3 caracteres).').max(500),
  })).max(100).default([]),
  aceite: aceiteSchema,
});
