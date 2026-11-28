import { z } from 'zod';

const opcional = (max: number) =>
  z.string().trim().max(max).optional().transform((valor) => (valor ? valor : undefined));

const dataNascimento = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')
  .refine((valor) => {
    const data = new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(valor) && data <= new Date() && data.getUTCFullYear() >= 1900;
  }, 'Data de nascimento inválida');

const camposFicha = {
  nome: z.string().trim().min(3, 'Informe o nome completo').max(120),
  data_nascimento: dataNascimento,
  numero_prontuario: z.string().trim().min(1, 'Informe o número do prontuário').max(40).regex(/^[A-Za-z0-9._/-]+$/, 'Use letras, números, ponto, hífen ou barra'),
  telefone: opcional(30),
  responsavel: opcional(120),
  observacoes: opcional(1000),
};

export const criarPacienteSchema = z.object({
  ...camposFicha,
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('E-mail inválido')),
});

export const atualizarPacienteSchema = z
  .object(camposFicha)
  .partial()
  .refine((valor) => Object.keys(valor).length > 0, 'Nada para atualizar');

export const criarSumarioSchema = z.discriminatedUnion('origem', [
  z.object({
    origem: z.literal('texto'),
    titulo: z.string().trim().min(3).max(160),
    texto: z.string().trim().min(1, 'Informe o texto do sumário').max(20_000),
  }),
  z.object({
    origem: z.literal('arquivo'),
    titulo: z.string().trim().min(3).max(160),
    nome_arquivo: z.string().trim().min(1).max(180),
    texto: z.string().trim().min(1).max(20_000),
  }),
  z.object({
    origem: z.literal('pdf_ia'),
    titulo: z.string().trim().min(3).max(160),
    nome_arquivo: z.string().trim().min(1).max(180),
    texto: z.string().trim().min(1).max(20_000),
    /** O profissional declara que conferiu a transcrição com o PDF original. */
    transcricao_conferida: z.literal(true, { error: 'Confirme que conferiu a transcrição com o PDF original.' }),
  }),
]);

