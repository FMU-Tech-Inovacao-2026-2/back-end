# Back-end — HealthIA

API do módulo Alta Assistida, em Node.js, Express, TypeScript e Zod. Todos os usuários e prontuários usados nesta versão são fictícios.

## Executar localmente

Requer Node.js 20.19 ou superior.

```powershell
npm install
Copy-Item .env.example .env
```

Edite `.env` e configure um `JWT_SECRET` aleatório com pelo menos 32 caracteres. Escolha o modo de extração em `GEMINI_PROVEDOR`:

| Valor | Como extrai | Requisito |
| --- | --- | --- |
| `demonstracao` | Respostas preparadas para os sumários do catálogo, sem IA | Nenhum |
| `api-key` | Gemini API | `GEMINI_API_KEY` |
| `vertex` | Gemini no Vertex AI, com as credenciais do Google Cloud (ADC) | `GOOGLE_CLOUD_PROJECT` e `gcloud auth application-default login` |

Não compartilhe nem versione `.env`.

```powershell
npm run dev
```

API: `http://localhost:3000`. Verificação: `GET /health`.

## Contas fictícias de desenvolvimento

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Profissional | `medica@demo.altaassistida.dev` | `Demo@12345` |
| Paciente | `paciente@demo.altaassistida.dev` | `Demo@12345` |

Os papéis disponíveis são `profissional` e `paciente`; não há papel `admin`. Para que o front-end use esta API, configure `VITE_MODO_BACKEND=true` e `VITE_API_URL` no front-end.

## Fluxo disponível

1. O profissional cria uma extração (`POST /alta/extracoes`) a partir de um sumário da base, de texto digitado ou do texto de um arquivo lido no navegador.
2. O servidor confere cada citação contra o texto original e marca `origem_verificada`.
3. O profissional consulta o termo vigente (`GET /alta/termo-aceite`) e aprova os itens escolhidos (`POST /alta/extracoes/:id/aprovar`), enviando o aceite com todas as declarações.
4. O plano é gravado com o registro do aceite: profissional, data, versão do termo e hash SHA-256 do conteúdo aprovado.
5. O paciente consulta só o próprio plano (`GET /alta/planos/me`).

Rotas, formatos e códigos de erro estão no contrato compartilhado: `PitchInicial/pitchInicial/docs/contrato-api.md`.

## Aceite profissional e LGPD

- O termo fica em `src/modules/alta/alta.termo.ts`. Ao mudar o texto, incremente a versão; aprovações com versão antiga recebem `422 ACEITE_INCOMPLETO`.
- Itens sem origem verificada não podem ser aprovados (`403`).
- A trilha de auditoria (`src/lib/auditoria.ts`) registra IDs, contagens, versão do termo e hash, nunca texto clínico, senha ou token.
- O logger remove cabeçalho de autorização, senhas, tokens e textos clínicos.
- Respostas usam `Cache-Control: no-store`.

A redação do termo é acadêmica e precisa de validação jurídica antes de uso com pacientes reais.

## Docker

```powershell
docker compose up api-dev     # desenvolvimento com recarga, porta 3000
docker compose up api-prod    # imagem de produção, porta 3001
```

A imagem de produção usa `node:22-alpine`, roda sem privilégios na porta 8080 e não contém `.env`.

## Produção (Cloud Run + Vertex AI)

Sem banco persistente, a API só inicia com `NODE_ENV=production` se `HEALTHIA_MODO_PILOTO=true`. Esse modo serve para piloto acadêmico com dados fictícios. Em produção também são exigidos um `JWT_SECRET` diferente do exemplo e um `CORS_ORIGIN` explícito, sem `*`.

O workflow `.github/workflows/deploy.yml` publica no Cloud Run após o CI verde na `main`, usando Workload Identity Federation e o segredo do JWT no Secret Manager. O passo a passo está em `PitchInicial/pitchInicial/docs/deploy.md`.

## CI

`.github/workflows/ci.yml` roda em cada push e pull request: `typecheck`, `test`, `build`, auditoria das dependências de produção e build da imagem com checagem de `/health`.

## Limitações

- Usuários, sumários, extrações e planos ficam em memória e se perdem ao reiniciar. Por isso o deploy usa uma única instância.
- Use apenas textos inventados. A IA não diagnostica, não recomenda tratamento e não preenche lacunas.

## Comandos de desenvolvimento

```powershell
npm test
npm run typecheck
npm run build
```
