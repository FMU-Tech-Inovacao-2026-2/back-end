import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { criarExtracaoSchema, aprovarExtracaoSchema } from './alta.schema';
import type { AltaService } from './alta.service';

export function altaRoutes(service: AltaService, jwtSecret: string) {
  const router = Router();
  const autenticado = authenticate(jwtSecret);
  const profissional = requireRole('profissional');
  const paciente = requireRole('paciente');
  const idDaRota = (valor: string | string[]) => (Array.isArray(valor) ? valor[0] : valor);

  // Cada extração consome a IA: limita por profissional para conter custo e abuso.
  const limiteExtracao = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, key: (req) => `extracao:${req.auth?.sub ?? req.ip}` });

  router.get('/sumarios', autenticado, profissional, async (_req, res) => {
    res.json({ sumarios: await service.listarSumarios() });
  });

  router.get('/termo-aceite', autenticado, profissional, (_req, res) => {
    res.json(service.termoAceite());
  });

  router.get('/extracoes', autenticado, profissional, async (req, res) => {
    res.json({ extracoes: await service.listarExtracoes(req.auth!.sub) });
  });

  router.post('/extracoes', autenticado, profissional, limiteExtracao, async (req, res) => {
    const input = criarExtracaoSchema.parse(req.body);
    const extracao = await service.criarExtracao(input, req.auth!.sub);
    res.status(201).json(extracao);
  });

  router.get('/extracoes/:id', autenticado, profissional, async (req, res) => {
    res.json(await service.buscarExtracao(idDaRota(req.params.id), req.auth!.sub));
  });

  router.get('/extracoes/:id/plano', autenticado, profissional, async (req, res) => {
    res.json(await service.buscarPlanoDaExtracao(idDaRota(req.params.id), req.auth!.sub));
  });

  router.post('/extracoes/:id/aprovar', autenticado, profissional, async (req, res) => {
    const input = aprovarExtracaoSchema.parse(req.body);
    res.json(await service.aprovarExtracao(idDaRota(req.params.id), req.auth!.sub, input));
  });

  router.get('/planos/me', autenticado, paciente, async (req, res) => {
    res.json(await service.meuPlano(req.auth!.sub));
  });

  return router;
}
