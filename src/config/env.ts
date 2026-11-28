import 'dotenv/config';
import { z } from 'zod';

const booleano = z
  .enum(['true', 'false'])
  .default('false')
  .transform((valor) => valor === 'true');

const SEGREDO_DE_EXEMPLO = 'troque-este-segredo-por-um-valor-aleatorio-longo';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    /** Caminho opcional de um arquivo JSONL com a trilha de auditoria (uma linha por evento). */
    AUDITORIA_ARQUIVO: z.string().trim().optional().transform((valor) => valor || undefined),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    /** Quantidade de proxies confiáveis à frente da API (Cloud Run/load balancer = 1). */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter no mínimo 32 caracteres'),
    JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().max(43_200).default(3600),

    /**
     * Como a extração é feita:
     * - api-key: Gemini Developer API com GEMINI_API_KEY.
     * - vertex: Gemini no Vertex AI com credenciais padrão do Google Cloud (ADC), sem chave no ambiente.
     * - demonstracao: sugestões preparadas apenas para os sumários fictícios do catálogo, sem IA.
     */
    GEMINI_PROVEDOR: z.enum(['api-key', 'vertex', 'demonstracao']).default('api-key'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.5-flash'),
    /** Modelos tentados em ordem quando o principal está indisponível, sobrecarregado ou descontinuado. */
    GEMINI_MODELOS_RESERVA: z
      .string()
      .default('gemini-3.8-flash,gemini-3.1-flash-lite')
      .transform((valor) => valor.split(',').map((item) => item.trim()).filter(Boolean)),
    GEMINI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(45_000),
    GOOGLE_CLOUD_PROJECT: z.string().trim().optional(),
    GOOGLE_CLOUD_LOCATION: z.string().trim().min(1).default('us-central1'),

    /**
     * Libera a execução com NODE_ENV=production usando os repositórios em memória
     * e as contas fictícias. Serve para piloto acadêmico com dados inventados,
     * nunca para dados reais de pacientes.
     */
    HEALTHIA_MODO_PILOTO: booleano,
  })
  .superRefine((valores, ctx) => {
    if (valores.GEMINI_PROVEDOR === 'vertex' && !valores.GOOGLE_CLOUD_PROJECT) {
      ctx.addIssue({ code: 'custom', path: ['GOOGLE_CLOUD_PROJECT'], message: 'Obrigatório quando GEMINI_PROVEDOR=vertex' });
    }
    if (valores.NODE_ENV !== 'production') return;
    if (valores.JWT_SECRET === SEGREDO_DE_EXEMPLO) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Use um segredo aleatório em produção, não o valor do .env.example' });
    }
    const origens = valores.CORS_ORIGIN.split(',').map((origem) => origem.trim());
    if (origens.some((origem) => origem === '*' || origem === '')) {
      ctx.addIssue({ code: 'custom', path: ['CORS_ORIGIN'], message: 'Informe as origens exatas do front-end em produção (sem *)' });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:');
  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
