/**
 * Raiz de composição: o único lugar que conhece todas as camadas.
 * Lê a configuração, cria os adaptadores, injeta nas portas dos casos de uso
 * e entrega ao adaptador de entrada HTTP.
 */
import { env } from './config/env';
import { AuditoriaLog } from './adapters/auditoria/auditoria';
import { ExtratorDemonstracao } from './adapters/ia/demonstracao';
import { GeminiExtractor } from './adapters/ia/gemini';
import { logger } from './adapters/log/logger';
import { buildDevRepository, FICHAS_DEMONSTRACAO, InMemoryAltaRepository, InMemoryFichaRepository, novoId } from './adapters/persistencia/memoria';
import { criarServicoToken } from './adapters/seguranca/jwt';
import { gerarSenhaProvisoria, servicoSenhaScrypt } from './adapters/seguranca/senhas';
import { AltaService } from './application/alta';
import { AuthService } from './application/auth';
import { PacienteService } from './application/pacientes';
import type { ExtratorIA } from './application/portas';
import { criarApp } from './entrypoints/http/app';

function criarIA(): ExtratorIA {
  if (env.GEMINI_PROVEDOR === 'demonstracao') return new ExtratorDemonstracao();
  return new GeminiExtractor({
    provedor: env.GEMINI_PROVEDOR,
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
    modelosReserva: env.GEMINI_MODELOS_RESERVA,
    timeoutMs: env.GEMINI_TIMEOUT_MS,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  });
}

async function main() {
  if (env.NODE_ENV === 'production' && !env.HEALTHIA_MODO_PILOTO) {
    // Ainda não há banco nem provedor de identidade de produção. Sem a flag, a API não sobe em produção.
    throw new Error('Nenhum repositório persistente de produção configurado. Para um piloto com dados fictícios, defina HEALTHIA_MODO_PILOTO=true.');
  }

  const auditoria = new AuditoriaLog({ arquivo: env.AUDITORIA_ARQUIVO });
  const tokens = criarServicoToken(env.JWT_SECRET, env.JWT_EXPIRES_IN_SECONDS);
  const users = await buildDevRepository();
  const fichas = new InMemoryFichaRepository(FICHAS_DEMONSTRACAO);

  const app = criarApp({
    auth: new AuthService({ users, senhas: servicoSenhaScrypt, tokens, auditoria }),
    alta: new AltaService({ users, repositorio: new InMemoryAltaRepository(), ia: criarIA(), fichas, auditoria, gerarId: novoId }),
    pacientes: new PacienteService({ users, fichas, senhas: servicoSenhaScrypt, gerarId: novoId, gerarSenhaProvisoria, auditoria }),
    tokens,
    corsOrigin: env.CORS_ORIGIN,
    trustProxy: env.TRUST_PROXY,
    info: {
      versao: process.env.K_REVISION ?? process.env.npm_package_version ?? 'dev',
      modoExtracao: env.GEMINI_PROVEDOR,
      piloto: env.HEALTHIA_MODO_PILOTO,
    },
  });

  const servidor = app.listen(env.PORT, () => {
    const modelos = env.GEMINI_PROVEDOR === 'demonstracao' ? '' : `, modelo ${env.GEMINI_MODEL}`;
    logger.info(`API no ar na porta ${env.PORT} (extração: ${env.GEMINI_PROVEDOR}${modelos}${env.HEALTHIA_MODO_PILOTO ? ', modo piloto' : ''})`);
    if (env.AUDITORIA_ARQUIVO) logger.info(`Auditoria também em ${env.AUDITORIA_ARQUIVO}`);
    if (env.NODE_ENV !== 'production') {
      logger.info('Contas fictícias de DEV: medica@demo.altaassistida.dev | paciente@demo.altaassistida.dev (veja o README)');
    } else {
      logger.warn('Modo piloto: dados em memória e contas fictícias. Não use dados reais de pacientes.');
    }
  });

  // Cloud Run envia SIGTERM antes de encerrar a instância.
  const encerrar = (sinal: string) => {
    logger.info(`Recebido ${sinal}; encerrando conexões.`);
    servidor.close(async () => {
      await auditoria.esvaziar();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'falha ao iniciar');
  process.exit(1);
});
