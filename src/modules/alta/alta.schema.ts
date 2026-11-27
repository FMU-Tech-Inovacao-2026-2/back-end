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
  }),
]);

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
  aceite: aceiteSchema,
});

export type CriarExtracaoInput = z.infer<typeof criarExtracaoSchema>;
export type AprovarExtracaoInput = z.infer<typeof aprovarExtracaoSchema>;
