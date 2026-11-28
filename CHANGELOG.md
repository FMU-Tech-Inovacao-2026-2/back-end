# Changelog — back-end

Todas as mudanças relevantes deste repositório. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Datas em DD/MM/AAAA.

## [Não publicado]

### Adicionado
- Arquitetura hexagonal: `src/domain` (regras puras), `src/application` (casos de uso e portas), `src/adapters` (Gemini, demonstração, memória, scrypt, JWT, auditoria, logger) e `src/entrypoints/http` (Express); `server.ts` como raiz de composição.
- Salvaguarda S1: a resposta do Gemini fora do esquema é devolvida ao modelo para correção, até 2 vezes.
- Salvaguarda G2: `itens_reprovados` com motivo obrigatório na aprovação; reprovações automáticas para itens sem origem; `decisoes` gravadas na extração; `reprovacoes` no comprovante e no hash de integridade.
- Consumo da IA: campo `ia` (modelo, tokens, tempo, reparos) na extração e evento de auditoria `ia.chamada`.
- Auditoria em JSONL opcional (`AUDITORIA_ARQUIVO`), gravada em ordem e sem bloquear a requisição.
- Verificação de origem (S2) passa a ignorar hifenização de quebra de linha de PDF.
- Coleção Postman em `docs/postman/HealthIA.postman_collection.json`.
- Fichário de pacientes (`/pacientes`): listar com busca, cadastrar, consultar a ficha, editar (`PATCH`) e adicionar sumários de alta.
- Cadastro de paciente cria a conta de acesso com senha provisória exibida uma única vez.
- `POST /alta/transcricoes`: transcrição literal de PDF (inclusive digitalizado) pela IA, sem salvar o texto, para conferência humana.
- Extração a partir de sumário da ficha (`origem: "ficha"`) e marcação `transcricao_ia` na extração.
- Modelos de reserva do Gemini (`GEMINI_MODELOS_RESERVA`) e tempo limite por chamada (`GEMINI_TIMEOUT_MS`), com troca automática em 404, 429 e 5xx.
- Mensagens específicas para chave recusada e modelo inválido.
- Eventos de auditoria `paciente.*` e `alta.transcricao_pdf`.
- `CHANGELOG.md`.

### Alterado
- Erros de negócio (`ErroDominio`) não conhecem HTTP; o adaptador HTTP converte cada tipo em status. Os códigos de erro da API não mudaram.
- Rotas e esquemas Zod movidos para `src/entrypoints/http`; testes ajustados às novas camadas.
- Modelo padrão do Gemini: `gemini-2.5-flash` → `gemini-3.5-flash`. O 2.5 deixou de estar disponível para contas novas (erro 404).
- `GET /pacientes` passou a devolver fichas completas com contagem de sumários (antes: usuários públicos).
- CORS aceita `PATCH`. JSON de até 15 MB só em `/alta/transcricoes`; demais rotas seguem com 1 MB.
- `.env.example` documenta as novas variáveis.

### Corrigido
- O logger era criado antes de o `.env` ser lido e ignorava `NODE_ENV` e `LOG_LEVEL` (em desenvolvimento, o log saía em JSON bruto). Agora o `.env` é carregado primeiro.
- `.gitignore`: `*.log` e `var/` estavam na mesma linha.

### Segurança
- A auditoria descarta também motivos de reprovação.
- Auditoria descarta nome, nascimento, telefone, observações, senha provisória e PDF; o logger redige senha provisória e PDF.
- Sumário `pdf_ia` exige `transcricao_conferida: true`.
- Transcrição valida a assinatura `%PDF-` e o limite de 10 MB.

## [1.0.0] — 27/11/2026

### Adicionado
- Módulo Alta Assistida: extração a partir da base, texto ou arquivo; verificação de origem no servidor; termo de aceite versionado; plano com registro do aceite (hash SHA-256); `GET /alta/extracoes/:id/plano`.
- Extração pela Gemini API, Vertex AI ou modo demonstração.
- Trilha de auditoria sem conteúdo clínico.
- Dockerfile sem privilégios, CI e deploy no Cloud Run com Workload Identity Federation.
