import { Router } from 'express';
import type { AltaService } from '../../../application/alta';
import type { ServicoToken } from '../../../application/portas';
import { aprovarExtracaoSchema, criarExtracaoSchema, transcreverPdfSchema } from '../esquemas/alta';
import { autenticar, exigirPerfil } from '../middlewares/autenticacao';
import { limitar } from '../middlewares/limite';

const parametro = (valor: string | string[]) => (Array.isArray(valor) ? valor[0] : valor);

export function rotasAlta(alta: AltaService, tokens: ServicoToken) {
  const router = Router();
  const autenticado = autenticar(tokens);
  const profissional = exigirPerfil('profissional');
  const paciente = exigirPerfil('paciente');

  // Cada chamada consome a IA: limita por profissional para conter custo e abuso.
  const limiteIA = limitar({ janelaMs: 10 * 60 * 1000, maximo: 20, chave: (req) => `ia:${req.auth?.sub ?? req.ip}` });

  router.get('/sumarios', autenticado, profissional, async (_req, res) => {
    res.json({ sumarios: await alta.listarSumarios() });
  });

  router.get('/termo-aceite', autenticado, profissional, (_req, res) => {
    res.json(alta.termoAceite());
  });

  router.get('/extracoes', autenticado, profissional, async (req, res) => {
    res.json({ extracoes: await alta.listarExtracoes(req.auth!.sub) });
  });

  router.post('/extracoes', autenticado, profissional, limiteIA, async (req, res) => {
    res.status(201).json(await alta.criarExtracao(criarExtracaoSchema.parse(req.body), req.auth!.sub));
  });

  // Transcrição de PDF pela IA: o texto volta para conferência humana e não é salvo aqui.
  router.post('/transcricoes', autenticado, profissional, limiteIA, async (req, res) => {
    res.json(await alta.transcreverPdf(transcreverPdfSchema.parse(req.body), req.auth!.sub));
  });

  router.get('/extracoes/:id', autenticado, profissional, async (req, res) => {
    res.json(await alta.buscarExtracao(parametro(req.params.id), req.auth!.sub));
  });

  router.get('/extracoes/:id/plano', autenticado, profissional, async (req, res) => {
    res.json(await alta.buscarPlanoDaExtracao(parametro(req.params.id), req.auth!.sub));
  });

  router.post('/extracoes/:id/aprovar', autenticado, profissional, async (req, res) => {
    res.json(await alta.aprovarExtracao(parametro(req.params.id), req.auth!.sub, aprovarExtracaoSchema.parse(req.body)));
  });

  router.get('/planos/me', autenticado, paciente, async (req, res) => {
    res.json(await alta.meuPlano(req.auth!.sub));
  });

  return router;
}
