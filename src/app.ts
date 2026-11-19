import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { authRoutes } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import type { UserRepository } from './modules/users/user.repository';
import { errorHandler, notFound } from './middleware/errorHandler';

export interface AppDeps {
  users: UserRepository;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  corsOrigin: string;
}

export function createApp(deps: AppDeps) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: deps.corsOrigin.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const authService = new AuthService(deps.users, {
    jwtSecret: deps.jwtSecret,
    expiresInSeconds: deps.jwtExpiresInSeconds,
  });
  app.use('/auth', authRoutes(authService, deps.jwtSecret));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
