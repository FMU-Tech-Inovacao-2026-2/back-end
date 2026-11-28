import type { ServicoToken } from '../../application/portas';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TokenPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
}

const b64u = (input: Buffer | string) => Buffer.from(input).toString('base64url');

function sign(data: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

export function signJwt(
  claims: { sub: string; role: string },
  secret: string,
  expiresInSeconds: number,
  now = Math.floor(Date.now() / 1000),
): string {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64u(
    JSON.stringify({ ...claims, iat: now, exp: now + expiresInSeconds } satisfies TokenPayload),
  );
  const signature = b64u(sign(`${header}.${payload}`, secret));
  return `${header}.${payload}.${signature}`;
}

/** Retorna o payload se o token for válido e não expirado; caso contrário, null. */
export function verifyJwt(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  try {
    const head = JSON.parse(Buffer.from(header, 'base64url').toString());
    if (head.alg !== 'HS256' || head.typ !== 'JWT') return null; // bloqueia alg=none etc.

    const expected = sign(`${header}.${payload}`, secret);
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as TokenPayload;
    if (typeof data.exp !== 'number' || data.exp <= now) return null;
    if (typeof data.sub !== 'string' || typeof data.role !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

/** Adaptador da porta ServicoToken com JWT HS256. */
export function criarServicoToken(segredo: string, validadeSegundos: number): ServicoToken {
  return {
    validadeSegundos,
    emitir: (claims) => signJwt(claims, segredo, validadeSegundos),
    verificar: (token) => verifyJwt(token, segredo),
  };
}
