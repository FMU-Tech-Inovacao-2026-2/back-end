import { Router } from 'express';
import type { AltaService } from '../../../application/alta';
import type { PacienteService } from '../../../application/pacientes';
import type { ServicoToken } from '../../../application/portas';
import { atualizarPacienteSchema, criarPacienteSchema, criarSumarioSchema } from '../esquemas/pacientes';
import { autenticar, exigirPerfil } from '../middlewares/autenticacao';

const parametro = (valor: string | string[]) => (Array.isArray(valor) ? valor[0] : valor);

/** Fichário de pacientes: só o perfil profissional, validado no servidor em cada rota. */
export function rotasPacientes(pacientes: PacienteService, alta: AltaService, tokens: ServicoToken) {
  const router = Router();
  router.use(autenticar(tokens), exigirPerfil('profissional'));

  router.get('/', async (req, res) => {
    const busca = typeof req.query.busca === 'string' ? req.query.busca.slice(0, 100) : undefined;
    res.json({ pacientes: await pacientes.listar(busca) });
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await pacientes.criar(criarPacienteSchema.parse(req.body), req.auth!.sub));
  });

  router.get('/:id', async (req, res) => {
    const pacienteId = parametro(req.params.id);
    const { paciente, sumarios } = await pacientes.ficha(pacienteId, req.auth!.sub);
    const [extracoes, plano] = await Promise.all([alta.listarExtracoes(req.auth!.sub, pacienteId), alta.planoVigente(pacienteId)]);
    res.json({ paciente, sumarios, extracoes, plano_vigente: plano });
  });

  router.patch('/:id', async (req, res) => {
    res.json({ paciente: await pacientes.atualizar(parametro(req.params.id), atualizarPacienteSchema.parse(req.body), req.auth!.sub) });
  });

  router.post('/:id/sumarios', async (req, res) => {
    res.status(201).json(await pacientes.criarSumario(parametro(req.params.id), criarSumarioSchema.parse(req.body), req.auth!.sub));
  });

  router.get('/:id/sumarios/:sumarioId', async (req, res) => {
    res.json(await pacientes.buscarSumario(parametro(req.params.id), parametro(req.params.sumarioId)));
  });

  return router;
}
