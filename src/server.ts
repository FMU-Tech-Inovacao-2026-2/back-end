import { createApp } from './app';
import { env } from './config/env';
import { AuditoriaLog } from './lib/auditoria';
import { logger } from './lib/logger';
import { buildDevRepository } from './modules/users/user.repository';
import { GeminiExtractor } from './modules/alta/gemini-extractor';
import { ExtratorDemonstracao } from './modules/alta/demonstracao-extractor';
import { AltaService } from './modules/alta/alta.service';
import { InMemoryAltaRepository } from './modules/alta/alta.repository';
import type { ExtratorAlta } from './modules/alta/alta.model';

function criarExtrator(): ExtratorAlta {
  if (env.GEMINI_PROVEDOR === 'demonstracao') return new ExtratorDemonstracao();
  return new GeminiExtractor({
    provedor: env.GEMINI_PROVEDOR,
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  });
}

async function main() {
  if (env.NODE_ENV === 'production' && !env.HEALTHIA_MODO_PILOTO) {
    // Ainda não há banco nem provedor de identidade de produção. Sem a flag, a API não sobe em produção.
    throw new Error(
      'Nenhum repositório persistente de produção configurado. Para um piloto com dados fictícios, defina HEALTHIA_MODO_PILOTO=true.',
    );
  }

  const auditoria = new AuditoriaLog();
  const users = await buildDevRepository();
  const alta = new AltaService(users, new InMemoryAltaRepository(), criarExtrator(), { auditoria });
  const app = createApp({
    users,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresInSeconds: env.JWT_EXPIRES_IN_SECONDS,
    corsOrigin: env.CORS_ORIGIN,
    trustProxy: env.TRUST_PROXY,
    auditoria,
    alta,
    info: {
      versao: process.env.K_REVISION ?? process.env.npm_package_version ?? 'dev',
      modoExtracao: env.GEMINI_PROVEDOR,
      piloto: env.HEALTHIA_MODO_PILOTO,
    },
  });

  const servidor = app.listen(env.PORT, () => {
    logger.info(`API no ar na porta ${env.PORT} (extração: ${env.GEMINI_PROVEDOR}${env.HEALTHIA_MODO_PILOTO ? ', modo piloto' : ''})`);
    if (env.NODE_ENV !== 'production') {
      logger.info('Contas fictícias de DEV: medica@demo.altaassistida.dev | paciente@demo.altaassistida.dev (veja o README)');
    } else {
      logger.warn('Modo piloto: dados em memória e contas fictícias. Não use dados reais de pacientes.');
    }
  });

  // Cloud Run envia SIGTERM antes de encerrar a instância.
  const encerrar = (sinal: string) => {
    logger.info(`Recebido ${sinal}; encerrando conexões.`);
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'falha ao iniciar');
  process.exit(1);
});
