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

O modelo padrão é `gemini-3.5-flash` (`GEMINI_MODEL`). Se ele estiver indisponível, sobrecarregado ou descontinuado, a API tenta os modelos de `GEMINI_MODELOS_RESERVA`, cada um com o tempo limite de `GEMINI_TIMEOUT_MS`.

Não compartilhe nem versione `.env`.

### A chave do Gemini não funciona?

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `/health` mostra `"extracao":"demonstracao"` | `GEMINI_PROVEDOR=demonstracao` ignora a chave | Use `GEMINI_PROVEDOR=api-key` e reinicie a API |
| "Não foi possível consultar a IA agora" e log com 404 | Modelo descontinuado para a conta (ex.: `gemini-2.5-flash` em contas novas) | Ajuste `GEMINI_MODEL` para um modelo disponível |
| Log com 503 ou 429 | Modelo sobrecarregado ou cota esgotada | Aguarde ou inclua outro modelo em `GEMINI_MODELOS_RESERVA` |
| "A chave do Gemini foi recusada" | Chave inválida, revogada ou de outro projeto | Gere outra chave no Google AI Studio |

Os logs registram o modelo e o código de erro, nunca a chave nem o texto enviado.

```powershell
npm run dev
```

API: `http://localhost:3000`. Verificação: `GET /health`.

## Arquitetura

O código segue arquitetura hexagonal, como o projeto de referência:

```
src/
  domain/       regras puras: verificação de origem, aceite, decisões (G2), hash
  application/  casos de uso (auth, pacientes, alta) e portas (interfaces)
  adapters/     Gemini, demonstração, memória, scrypt, JWT, auditoria JSONL, logger
  entrypoints/  HTTP (Express): rotas, esquemas Zod, autenticação, erros
  server.ts     raiz de composição
```

Detalhes e a tabela de salvaguardas: `PitchInicial/pitchInicial/docs/arquitetura.md`.

## Testar no Postman

Importe `docs/postman/HealthIA.postman_collection.json`. Rode, na ordem: **Login profissional → Termo de aceite vigente → Criar extração (texto) → Aprovar extração → Login paciente → Meu plano**. Os scripts guardam o token, os IDs e a versão do termo. A requisição de aprovação monta o corpo sozinha: aprova as sugestões verificadas e reprova uma com motivo.

## Contas fictícias de desenvolvimento

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Profissional | `medica@demo.altaassistida.dev` | `Demo@12345` |
| Paciente | `paciente@demo.altaassistida.dev` | `Demo@12345` |

Os papéis disponíveis são `profissional` e `paciente`; não há papel `admin`. Para que o front-end use esta API, configure `VITE_MODO_BACKEND=true` e `VITE_API_URL` no front-end.

## Fichário de pacientes

O profissional cadastra pacientes (`POST /pacientes`), edita os dados (`PATCH /pacientes/:id`) e adiciona sumários de alta à ficha (`POST /pacientes/:id/sumarios`). O cadastro cria a conta do paciente com uma senha provisória exibida uma única vez. A ficha (`GET /pacientes/:id`) reúne dados, sumários, altas do profissional e plano vigente. A ficha não coleta CPF nem endereço.

## PDF lido pela IA

`POST /alta/transcricoes` recebe um PDF em base64 (até 10 MB) e devolve a transcrição literal feita pelo Gemini. O texto não é salvo: o profissional confere com o PDF original, corrige se preciso e confirma. Só então o texto vira sumário (`origem: "pdf_ia"`, com `transcricao_conferida: true`) ou entrada de extração (`transcricao_ia: true`). As citações das sugestões são verificadas contra esse texto conferido.

## Fluxo disponível

1. O profissional cria uma extração (`POST /alta/extracoes`) a partir de um sumário da ficha, da base de exemplos, de texto digitado ou do texto de um arquivo.
2. O servidor confere cada citação contra o texto original e marca `origem_verificada`.
3. O profissional consulta o termo vigente (`GET /alta/termo-aceite`) e aprova os itens escolhidos (`POST /alta/extracoes/:id/aprovar`), enviando as reprovações com motivo e o aceite com todas as declarações.
4. O plano é gravado com o registro do aceite: profissional, data, versão do termo e hash SHA-256 do conteúdo aprovado.
5. O paciente consulta só o próprio plano (`GET /alta/planos/me`).

Rotas, formatos e códigos de erro estão no contrato compartilhado: `PitchInicial/pitchInicial/docs/contrato-api.md`. Arquitetura e LGPD: `docs/arquitetura.md` e `docs/dados-e-seguranca.md` no mesmo repositório. Mudanças por versão: `CHANGELOG.md`.

## Aceite profissional e LGPD

- O termo fica em `src/modules/alta/alta.termo.ts`. Ao mudar o texto, incremente a versão; aprovações com versão antiga recebem `422 ACEITE_INCOMPLETO`.
- Itens sem origem verificada não podem ser aprovados (`403`) e são reprovados automaticamente.
- Toda sugestão verificada e não aprovada exige motivo (`400` sem motivo). Os motivos ficam no comprovante e no hash, nunca no plano do paciente.
- Cada extração registra o modelo, os tokens, o tempo e os reparos da IA (`ia`).
- `AUDITORIA_ARQUIVO` grava também a auditoria em JSONL.
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
