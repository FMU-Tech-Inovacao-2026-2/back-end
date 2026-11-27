# Imagem de produção da API HealthIA (Cloud Run ou qualquer runtime de contêiner).
# Segredos nunca entram na imagem: chegam por variável de ambiente ou Secret Manager.

# --- Build: instala dependências completas e compila o TypeScript ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Dependências de produção, sem as de desenvolvimento ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# --- Execução: usuário sem privilégios e só o necessário ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    TRUST_PROXY=1

COPY --chown=node:node package.json ./
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node
EXPOSE 8080

# Usado pelo Docker local; o Cloud Run faz a própria checagem na porta.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" > /dev/null || exit 1

CMD ["node", "dist/server.js"]
