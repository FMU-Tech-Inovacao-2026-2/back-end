import pino from 'pino';

const emTeste = process.env.NODE_ENV === 'test' || process.argv.includes('--test');

export const logger = pino({
  level: emTeste ? 'silent' : process.env.LOG_LEVEL ?? 'info',
  // Nunca registrar credenciais nem conteúdo clínico (LGPD: minimização).
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'senha',
      '*.senha',
      'texto',
      '*.texto',
      'texto_original',
      '*.texto_original',
      'accessToken',
      '*.accessToken',
    ],
    censor: '[removido]',
  },
  // Em produção, JSON puro: o Cloud Logging interpreta "severity" a partir do nível.
  formatters: {
    level: (label) => ({ level: label, severity: label.toUpperCase() }),
  },
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
