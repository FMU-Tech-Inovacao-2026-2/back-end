# back-end — HealthIA

API em Node.js + TypeScript (Express 5, Zod, Gemini). Faz parte do projeto
[Alta Assistida](https://github.com/FMU-Tech-Inovacao-2026-2): transforma o sumário de alta
hospitalar em um plano de cuidados, sempre com aprovação de um profissional de saúde.

> **Somente dados fictícios.** Dados de saúde são dados pessoais sensíveis (LGPD).

## Como rodar

```bash
npm install
cp .env.example .env     # defina JWT_SECRET (mínimo 32 caracteres)
npm run dev              # http://localhost:3000
npm test                 # testes unitários
npm run build && npm start
```

## Estrutura

```
src/
├── server.ts                  # bootstrap
├── app.ts                     # createApp(deps): middlewares e rotas
├── config/env.ts              # variáveis de ambiente validadas com Zod
├── lib/                       # jwt, password (scrypt), errors, logger
├── middleware/                # authenticate, requireRole, rateLimit, errorHandler
└── modules/
    ├── auth/                  # rotas, schema (Zod) e service do login
    └── users/                 # model + UserRepository (hoje em memória)
tests/auth.test.ts
```

## Autenticação

### `POST /auth/login`

```json
{ "email": "medica@demo.altaassistida.dev", "senha": "Demo@12345" }
```

Resposta `200`:

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": "u-001", "nome": "Dra. Ana Demo", "email": "medica@demo.altaassistida.dev", "role": "profissional" }
}
```

| Status | Quando |
| ------ | ------ |
| 400 | corpo inválido (e-mail mal formado, senha vazia, JSON quebrado) |
| 401 | e-mail ou senha inválidos (mensagem única, também para usuário inativo) |
| 429 | mais de 10 tentativas em 15 min para o mesmo IP + e-mail |

### `GET /auth/me`

Header `Authorization: Bearer <accessToken>` → `{ "user": { ... } }`.

### Protegendo outras rotas

```ts
router.post('/extracoes', authenticate(jwtSecret), requireRole('profissional'), handler);
```

Perfis (`role`): `profissional` e `paciente`.

### Usuários de desenvolvimento (fictícios)

| E-mail | Perfil | Senha |
| ------ | ------ | ----- |
| medica@demo.altaassistida.dev | profissional | `Demo@12345` |
| paciente@demo.altaassistida.dev | paciente | `Demo@12345` |

Existem só fora de produção. Com `NODE_ENV=production` o servidor se recusa a subir até
existir um `UserRepository` real.

## Decisões de segurança

- Senhas com **scrypt** (`node:crypto`), salt aleatório e comparação em tempo constante.
- JWT **HS256** implementado com `node:crypto`; rejeita `alg=none`, assinatura inválida e token expirado.
- Resposta idêntica para e-mail inexistente, senha errada e usuário inativo, com hash falso para
  igualar o tempo de resposta (evita enumeração de usuários).
- `senhaHash` nunca sai da API; o logger omite `authorization` e `senha`.
- Helmet, CORS restrito por `CORS_ORIGIN` e limite de tamanho de senha (evita DoS no scrypt).

## Próximos passos

1. `SupabaseUserRepository` implementando `UserRepository` (e cadastro de usuários).
2. `POST /extracoes` com Gemini + validação de `trecho_origem`.
3. Fluxo de aprovação (`pendente` → `aprovado`) e leitura do plano pelo paciente.
4. Atualizar o README do `pitchInicial` (a stack do back agora é Node/Express, não FastAPI).
