import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { buildDevRepository } from './modules/users/user.repository';

async function main() {
  if (env.NODE_ENV === 'production') {
    // Trocar pelo repositório do Supabase antes de subir em produção.
    throw new Error('Nenhum UserRepository de produção configurado ainda (use Supabase).');
  }

  const users = await buildDevRepository();
  const app = createApp({
    users,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresInSeconds: env.JWT_EXPIRES_IN_SECONDS,
    corsOrigin: env.CORS_ORIGIN,
  });

  app.listen(env.PORT, () => {
    logger.info(`API no ar em http://localhost:${env.PORT}`);
    logger.info('Usuários de DEV: medica@demo.altaassistida.dev | paciente@demo.altaassistida.dev (senha: Demo@12345)');
  });
}

main().catch((err) => {
  logger.error({ err }, 'falha ao iniciar');
  process.exit(1);
});
