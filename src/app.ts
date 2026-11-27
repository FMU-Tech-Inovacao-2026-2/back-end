import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Auditoria } from './lib/auditoria';
import { authRoutes } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import type { UserRepository } from './modules/users/user.repository';
import { errorHandler, notFound } from './middleware/errorHandler';
import { altaRoutes } from './modules/alta/alta.routes';
import type { AltaService } from './modules/alta/alta.service';
import { userRoutes } from './modules/users/user.routes';

export interface AppDeps {
  users: UserRepository;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  corsOrigin: string;
  alta: AltaService;
  /** Quantidade de proxies confiáveis (Cloud Run = 1). Define o IP real usado no limite de tentativas. */
  trustProxy?: number;
  auditoria?: Auditoria;
  /** Informações públicas e não sensíveis exibidas em /health. */
  info?: { versao?: string; modoExtracao?: string; piloto?: boolean };
}

export function createApp(deps: AppDeps) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', deps.trustProxy ?? 0);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({
    origin: deps.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    maxAge: 600,
  }));
  app.use(express.json({ limit: '1mb' }));

  // Respostas com dados de saúde nunca ficam em cache de navegador ou proxy.
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      versao: deps.info?.versao ?? 'dev',
      extracao: deps.info?.modoExtracao ?? 'api-key',
      piloto: deps.info?.piloto ?? false,
    });
  });

  const authService = new AuthService(deps.users, {
    jwtSecret: deps.jwtSecret,
    expiresInSeconds: deps.jwtExpiresInSeconds,
  }, deps.auditoria);
  app.use('/auth', authRoutes(authService, deps.jwtSecret));
  app.use(userRoutes(deps.users, deps.jwtSecret));
  app.use('/alta', altaRoutes(deps.alta, deps.jwtSecret));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
