import { HttpError, type Env } from './types';

const cookieName = '__Secure-family-pairing';
const lifetime = 12 * 60 * 60;
const encoder = new TextEncoder();
const cookie = (value: string, maxAge: number) =>
  `${cookieName}=${value}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

export function requireOwnerOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    throw new HttpError(403, 'Open the pairing page on the family service to continue.');
  }
}

async function signingKey(env: Env) {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) throw new HttpError(401, 'Owner access required.');
  return crypto.subtle.importKey('raw', encoder.encode(env.ADMIN_TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

const message = (request: Request, value: string) => encoder.encode(`family-pairing-v1:${new URL(request.url).origin}:${value}`);

export async function newOwnerSession(request: Request, env: Env): Promise<string> {
  const value = `${Date.now() + lifetime * 1000}.${crypto.randomUUID()}`;
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env), message(request, value));
  const hex = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
  return cookie(`${value}.${hex}`, lifetime);
}

export async function hasOwnerSession(request: Request, env: Env): Promise<boolean> {
  const value = request.headers.get('cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? '';
  const match = /^(\d{13})\.([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(value);
  if (!match || Number(match[1]) <= Date.now() || Number(match[1]) > Date.now() + lifetime * 1000) return false;
  const signature = Uint8Array.from(match[3]!.match(/../g)!, byte => parseInt(byte, 16));
  return crypto.subtle.verify('HMAC', await signingKey(env), signature, message(request, `${match[1]}.${match[2]}`));
}

export const clearOwnerSession = () => cookie('', 0);
