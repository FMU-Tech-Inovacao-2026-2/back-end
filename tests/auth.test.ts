import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InMemoryUserRepository } from '../src/adapters/persistencia/memoria';
import { criarServicoToken, signJwt, verifyJwt } from '../src/adapters/seguranca/jwt';
import { hashPassword, servicoSenhaScrypt, verifyPassword } from '../src/adapters/seguranca/senhas';
import { AuthService } from '../src/application/auth';
import { ErroDominio } from '../src/domain/erros';

const SECRET = 'x'.repeat(40);

test('hash de senha: aceita a correta e rejeita a errada', async () => {
  const h = await hashPassword('Segredo@1');
  assert.ok(h.startsWith('scrypt$'));
  assert.equal(await verifyPassword('Segredo@1', h), true);
  assert.equal(await verifyPassword('segredo@1', h), false);
  assert.equal(await verifyPassword('x', 'lixo'), false);
});

test('JWT: válido, adulterado, expirado, segredo errado e alg=none', () => {
  const now = 1_000_000;
  const t = signJwt({ sub: 'u1', role: 'profissional' }, SECRET, 60, now);
  assert.equal(verifyJwt(t, SECRET, now + 10)?.sub, 'u1');
  assert.equal(verifyJwt(t, SECRET, now + 61), null); // expirado
  assert.equal(verifyJwt(t, 'y'.repeat(40), now + 10), null); // segredo errado

  const [h, p, s] = t.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ sub: 'u1', role: 'admin', iat: now, exp: now + 999 })).toString('base64url');
  assert.equal(verifyJwt(`${h}.${forgedPayload}.${s}`, SECRET, now + 10), null); // adulterado

  const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  assert.equal(verifyJwt(`${none}.${p}.`, SECRET, now + 10), null); // alg none
  assert.equal(verifyJwt('abc', SECRET), null);
});

test('login: sucesso, senha errada, e-mail inexistente e usuário inativo', async () => {
  const repo = new InMemoryUserRepository([
    { id: '1', nome: 'Ana', email: 'ana@x.com', senhaHash: await hashPassword('Senha@123'), role: 'profissional', ativo: true },
    { id: '2', nome: 'Bob', email: 'bob@x.com', senhaHash: await hashPassword('Senha@123'), role: 'paciente', ativo: false },
  ]);
  const svc = new AuthService({ users: repo, senhas: servicoSenhaScrypt, tokens: criarServicoToken(SECRET, 3600) });

  const ok = await svc.login({ email: 'ana@x.com', senha: 'Senha@123' });
  assert.equal(ok.tokenType, 'Bearer');
  assert.equal(verifyJwt(ok.accessToken, SECRET)?.sub, '1');
  assert.equal('senhaHash' in ok.user, false); // nunca vaza o hash

  for (const input of [
    { email: 'ana@x.com', senha: 'errada' },
    { email: 'nao@x.com', senha: 'Senha@123' },
    { email: 'bob@x.com', senha: 'Senha@123' },
  ]) {
    await assert.rejects(svc.login(input), (e: unknown) => e instanceof ErroDominio && e.tipo === 'nao_autenticado' && e.message === 'E-mail ou senha inválidos');
  }

  assert.equal((await svc.me('1')).email, 'ana@x.com');
  await assert.rejects(svc.me('2'));
});
