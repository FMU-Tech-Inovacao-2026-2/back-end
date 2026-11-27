import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/lib/errors';
import { signJwt } from '../src/lib/jwt';
import { authenticate, requireRole } from '../src/middleware/authenticate';
import { AltaService } from '../src/modules/alta/alta.service';
import { GeminiExtractor } from '../src/modules/alta/gemini-extractor';
import { InMemoryAltaRepository } from '../src/modules/alta/alta.repository';
import { aprovarExtracaoSchema, criarExtracaoSchema } from '../src/modules/alta/alta.schema';
import type { ExtratorAlta } from '../src/modules/alta/alta.model';
import { TERMO_ACEITE } from '../src/modules/alta/alta.termo';
import { buildDevRepository } from '../src/modules/users/user.repository';

/** Aceite completo da versão vigente do termo. */
const ACEITE = { versao_termo: TERMO_ACEITE.versao, declaracoes: TERMO_ACEITE.declaracoes.map((item) => item.id) };

const SECRET = 'healthia-teste-segredo-jwt-40-caracteres';
const DATA = `Medicações na alta:\n- Furosemida 40 mg por via oral pela manhã, durante 7 dias.\nCuidados: pesar-se todos os dias pela manhã.`;

const extratorFalso: ExtratorAlta = {
  async extrair() {
    return {
      sugestoes: [
        { categoria: 'medicamento', titulo: 'Furosemida 40 mg', descricao: 'Via oral pela manhã por 7 dias.', trecho_origem: 'Furosemida 40 mg por via oral pela manhã, durante 7 dias.' },
        { categoria: 'cuidado', titulo: 'Acompanhar peso', descricao: 'Pesar pela manhã e anotar.', trecho_origem: 'pesar-se todos os dias pela manhã.' },
      ],
      nao_informado: ['Horário exato'],
    };
  },
};

async function preparar(extractor: ExtratorAlta = extratorFalso) {
  const users = await buildDevRepository();
  const repository = new InMemoryAltaRepository();
  return { users, repository, service: new AltaService(users, repository, extractor) };
}

test('lista pacientes fictícios e sumários da base sem expor hash de senha', async () => {
  const { service } = await preparar();
  const pacientes = await service.listarPacientes();
  const sumarios = await service.listarSumarios();
  assert.deepEqual(pacientes.map((item) => item.id), ['u-002']);
  assert.equal('senhaHash' in pacientes[0], false);
  assert.ok(sumarios.length >= 2);
  assert.match(sumarios[0].texto, /CASO FICTÍCIO/);
});

test('cria extrações a partir da base, texto digitado e arquivo importado', async () => {
  const { service } = await preparar();
  const sumarios = await service.listarSumarios();

  const base = await service.criarExtracao({ origem: 'base', paciente_id: 'u-002', sumario_id: sumarios[0].id }, 'u-001');
  assert.equal(base.sumario_id, sumarios[0].id);
  assert.match(base.texto_original, /Furosemida/);
  assert.equal(base.status, 'pendente');

  const texto = await service.criarExtracao({ origem: 'texto', paciente_id: 'u-002', texto: DATA }, 'u-001');
  assert.equal(texto.texto_original, DATA);

  const arquivo = await service.criarExtracao({ origem: 'arquivo', paciente_id: 'u-002', nome_arquivo: 'alta-ficticia.txt', texto: DATA }, 'u-001');
  assert.equal(arquivo.nome_arquivo, 'alta-ficticia.txt');
  assert.equal(arquivo.sugestoes.every((item) => item.origem_verificada), true);
});

test('aprova somente sugestões aceitas e disponibiliza o plano à conta paciente', async () => {
  const { service } = await preparar();
  const extracao = await service.criarExtracao({ origem: 'texto', paciente_id: 'u-002', texto: DATA }, 'u-001');
  const plano = await service.aprovarExtracao(extracao.id, 'u-001', {
    itens_aprovados: [extracao.sugestoes[0].id],
    sugestoes_editadas: [{ id: extracao.sugestoes[0].id, titulo: 'Furosemida revisada', descricao: 'Via oral pela manhã por 7 dias.' }],
    aceite: ACEITE,
  });
  assert.equal(plano.itens.length, 1);
  assert.equal(plano.itens[0].titulo, 'Furosemida revisada');
  assert.equal(plano.aceite.versao_termo, TERMO_ACEITE.versao);
  assert.match(plano.aceite.hash_conteudo, /^[0-9a-f]{64}$/);
  assert.equal((await service.buscarPlanoDaExtracao(extracao.id, 'u-001')).id, plano.id);
  assert.equal((await service.meuPlano('u-002')).id, plano.id);
  await assert.rejects(service.meuPlano('u-001'), (erro: any) => erro.status === 404);
});

test('rejeita edição de sugestão que não foi selecionada para o plano', async () => {
  const { service } = await preparar();
  const extracao = await service.criarExtracao({ origem: 'texto', paciente_id: 'u-002', texto: DATA }, 'u-001');
  await assert.rejects(service.aprovarExtracao(extracao.id, 'u-001', {
    itens_aprovados: [extracao.sugestoes[0].id],
    sugestoes_editadas: [{ id: extracao.sugestoes[1].id, titulo: 'Alterada', descricao: 'Alterada também.' }],
    aceite: ACEITE,
  }), (erro: any) => erro.status === 403);
});

test('não aprova sugestão com trecho inventado e não permite revisão por outro profissional', async () => {
  const extractorInventado: ExtratorAlta = {
    async extrair() {
      return { sugestoes: [{ categoria: 'medicamento', titulo: 'Item inventado', descricao: 'Sem evidência', trecho_origem: 'Trecho ausente.' }], nao_informado: [] };
    },
  };
  const { service } = await preparar(extractorInventado);
  const extracao = await service.criarExtracao({ origem: 'texto', paciente_id: 'u-002', texto: DATA }, 'u-001');
  assert.equal(extracao.sugestoes[0].origem_verificada, false);
  await assert.rejects(service.aprovarExtracao(extracao.id, 'u-001', { itens_aprovados: [extracao.sugestoes[0].id], aceite: ACEITE }), (erro: any) => erro.status === 403);
  await assert.rejects(service.buscarExtracao(extracao.id, 'outro-profissional'), (erro: any) => erro.status === 404);
});

test('valida formatos de criação e aprovação', () => {
  assert.equal(criarExtracaoSchema.safeParse({ origem: 'base', paciente_id: 'u-002', sumario_id: 'sumario-cardiaco-01' }).success, true);
  assert.equal(criarExtracaoSchema.safeParse({ origem: 'texto', paciente_id: 'u-002', texto: '   ' }).success, false);
  assert.equal(aprovarExtracaoSchema.safeParse({ itens_aprovados: [] }).success, false);
  assert.equal(aprovarExtracaoSchema.safeParse({ itens_aprovados: ['item-1'] }).success, false, 'aceite é obrigatório');
  assert.equal(aprovarExtracaoSchema.safeParse({ itens_aprovados: ['item-1'], aceite: ACEITE }).success, true);
  assert.equal(aprovarExtracaoSchema.safeParse({ itens_aprovados: ['item-1'], sugestoes_editadas: [{ id: 'item-1', titulo: 'Revisto', descricao: 'Descrição revisada.' }], aceite: ACEITE }).success, true);
});

test('middleware valida token e exige perfil profissional', () => {
  const token = signJwt({ sub: 'u-001', role: 'profissional' }, SECRET, 60);
  const req: { headers: Record<string, string>; auth?: { sub: string; role: string; iat: number; exp: number } } = { headers: { authorization: `Bearer ${token}` } };
  let avancou = false;
  authenticate(SECRET)(req as never, {} as never, () => { avancou = true });
  assert.equal(avancou, true);
  const permitiu = requireRole('profissional');
  permitiu(req as never, {} as never, () => undefined);

  const paciente = { auth: { sub: 'u-002', role: 'paciente' } };
  assert.throws(() => permitiu(paciente as never, {} as never, () => undefined), (erro: unknown) => erro instanceof AppError && erro.status === 403);
});

test('Gemini sem chave retorna erro controlado e não tenta chamada externa', async () => {
  const extractor = new GeminiExtractor(undefined);
  await assert.rejects(extractor.extrair(DATA), (erro: unknown) => erro instanceof AppError && erro.status === 503 && erro.message.includes('chave do Gemini'));
});
