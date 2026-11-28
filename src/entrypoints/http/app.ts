import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { AltaService } from '../../application/alta';
import type { AuthService } from '../../application/auth';
import type { PacienteService } from '../../application/pacientes';
import type { ServicoToken } from '../../application/portas';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros';
import { rotasAlta } from './rotas/alta';
import { rotasAuth } from './rotas/auth';
import { rotasPacientes } from './rotas/pacientes';

export interface DependenciasHttp {
  auth: AuthService;
  alta: AltaService;
  pacientes: PacienteService;
  tokens: ServicoToken;
  corsOrigin: string;
  /** Quantidade de proxies confiáveis (Cloud Run = 1). Define o IP real usado no limite de tentativas. */
  trustProxy?: number;
  /** Informações públicas e não sensíveis exibidas em /health. */
  info?: { versao?: string; modoExtracao?: string; piloto?: boolean };
}

/** Adaptador de entrada HTTP (Express). Não contém regra de negócio. */
export function criarApp(deps: DependenciasHttp) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', deps.trustProxy ?? 0);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({
    origin: deps.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean),
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    maxAge: 600,
  }));
  // PDFs para transcrição chegam em base64 (até 10 MB de arquivo); o restante da API aceita até 1 MB.
  app.use('/alta/transcricoes', express.json({ limit: '15mb' }));
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

  app.use('/auth', rotasAuth(deps.auth, deps.tokens));
  app.use('/pacientes', rotasPacientes(deps.pacientes, deps.alta, deps.tokens));
  app.use('/alta', rotasAlta(deps.alta, deps.tokens));

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}
