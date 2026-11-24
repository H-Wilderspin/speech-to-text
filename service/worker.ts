import { githubFile } from './github-app';
import { allowedPath, jsonBody, validateDocument } from './validation';
import { HttpError, paused, type Env } from './types';
import { admitPairing, pairingCode } from './pairing';

export const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))),
  byte => byte.toString(16).padStart(2, '0')).join('');
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
const bearer = (request: Request) => request.headers.get('authorization')?.match(/^Bearer (\S{1,256})$/)?.[1] ?? '';
const json = (value: unknown, status = 200) => Response.json(value, { status });

async function admin(request: Request, env: Env, path: string): Promise<Response> {
  // Hash both operands before comparison; owner credentials must have at least 256 bits of randomness.
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32 || await hash(bearer(request)) !== await hash(env.ADMIN_TOKEN)) {
    throw new HttpError(401, 'Owner access required.');
  }
  if (path === '/admin/status' && request.method === 'GET') {
    const guard = await env.DB.prepare('SELECT day, requests, paused FROM guard WHERE id = 1').first();
    return json({ guard, configurationPaused: env.SYNC_PAUSED !== 'false', dailyLimit: dailyLimit(env) });
  }
  if (path === '/admin/pause' && request.method === 'POST') {
    const body = await jsonBody(request, 1024);
    if (typeof body.paused !== 'boolean') throw new HttpError(400, 'Choose paused true or false.');
    await env.DB.prepare('UPDATE guard SET paused = ? WHERE id = 1').bind(body.paused ? 1 : 0).run();
    return json({ paused: body.paused });
  }
  if (path === '/admin/devices' && request.method === 'GET') {
    return json((await env.DB.prepare('SELECT id, label, created_at FROM devices ORDER BY created_at').all()).results);
  }
  if (/^\/admin\/devices\/[a-f0-9]{32}$/.test(path) && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(path.split('/').at(-1)!).run();
    return json({ revoked: true });
  }
  if (path === '/admin/invites' && request.method === 'POST') {
    const body = await jsonBody(request, 1024);
    if (typeof body.label !== 'string' || !body.label.trim() || body.label.length > 80) throw new HttpError(400, 'Enter a device label (up to 80 characters).');
    const now = Date.now();
    await env.DB.prepare('DELETE FROM invites WHERE expires_at < ?').bind(now).run();
    const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM devices').first<{ total: number }>();
    const invites = await env.DB.prepare('SELECT COUNT(*) AS total FROM invites').first<{ total: number }>();
    if ((count?.total ?? 0) + (invites?.total ?? 0) >= 100) throw new HttpError(409, 'Remove an old device or wait for invitations to expire.');
    const expires = now + 24 * 60 * 60000;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = pairingCode();
      // Limit valid targets as well as guesses. Conditional insertion also protects
      // against simultaneous owner requests and does not replace colliding codes.
      const inserted = await env.DB.prepare(`INSERT INTO invites (code_hash, label, expires_at)
        SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM invites WHERE claimed_hash IS NULL AND expires_at > ?) < 5
          AND (SELECT COUNT(*) FROM devices) + (SELECT COUNT(*) FROM invites) < 100
        ON CONFLICT(code_hash) DO NOTHING RETURNING code_hash`)
        .bind(await hash(code), body.label.trim(), expires, now).first();
      if (inserted) return json({ code, expires });
    }
    throw new HttpError(409, 'Could not create a code. Use an existing code or wait for unused codes to expire (up to five at once).');
  }
  throw new HttpError(404, 'Unknown owner action.');
}

function dailyLimit(env: Env): number {
  const value = Number(env.DAILY_REQUEST_LIMIT ?? '5000');
  // Never permit a config typo to disable admission control or exceed the reviewed ceiling.
  return Number.isInteger(value) && value > 0 && value <= 5000 ? value : 5000;
}
async function admit(env: Env) {
  if (env.SYNC_PAUSED !== 'false') throw paused();
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  // One conditional SQL statement is atomic across concurrent Workers. Only admitted
  // requests write the counter; denied requests do not keep incrementing it.
  const accepted = await env.DB.prepare(`UPDATE guard SET day = ?, requests = CASE WHEN day = ? THEN requests + 1 ELSE 1 END
    WHERE id = 1 AND paused = 0 AND (day != ? OR requests < ?) RETURNING requests`)
    .bind(day, day, day, dailyLimit(env)).first();
  if (accepted) return;
  const state = await env.DB.prepare('SELECT paused FROM guard WHERE id = 1').first<{ paused: number }>();
  if (!state || state.paused) throw paused();
  const midnight = Date.parse(`${day}T00:00:00Z`) + 86400000;
  throw paused(Math.ceil((midnight - now.getTime()) / 1000) + 30);
}

async function pair(request: Request, env: Env) {
  await admitPairing(env);
  const body = await jsonBody(request, 1024);
  const code = typeof body.code === 'string' ? body.code.toUpperCase().replace(/[\s-]/g, '') : '';
  // Existing long invitations remain usable until their original expiry.
  if (!/^(?:[0-9]{6}|[A-F0-9]{20})$/.test(code) || typeof body.token !== 'string' || !/^device_[a-f0-9]{64}$/.test(body.token)) {
    throw new HttpError(400, 'Check the pairing code and try again.');
  }
  const codeHash = await hash(code);
  const tokenHash = await hash(body.token);
  const now = Date.now();
  // Atomic claim; retrying with the same client-generated secret recovers a lost
  // response. Another device cannot reuse the code, and revocation cannot be undone.
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO devices (id, token_hash, label, created_at)
      SELECT ?, ?, label, ? FROM invites WHERE code_hash = ? AND expires_at > ? AND claimed_hash IS NULL`)
      .bind(random(), tokenHash, now, codeHash, now),
    env.DB.prepare(`UPDATE invites SET claimed_hash = ? WHERE code_hash = ? AND claimed_hash IS NULL
      AND EXISTS (SELECT 1 FROM devices WHERE token_hash = ?)`)
      .bind(tokenHash, codeHash, tokenHash),
  ]);
  const device = await env.DB.prepare(`SELECT devices.id FROM invites JOIN devices ON devices.token_hash = invites.claimed_hash
    WHERE code_hash = ? AND claimed_hash = ? AND expires_at > ?`).bind(codeHash, tokenHash, now).first();
  if (!device) throw new HttpError(400, 'This pairing code has expired or was already used. Ask for a new code.');
  return json({ connected: true });
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/admin/')) return admin(request, env, url.pathname);
  await admit(env);
  if (url.pathname === '/pair' && request.method === 'POST') return pair(request, env);
  const token = bearer(request);
  if (!/^device_[a-f0-9]{64}$/.test(token)) throw new HttpError(401, 'Connect this device in Settings with a family pairing code.');
  const device = await env.DB.prepare('SELECT id FROM devices WHERE token_hash = ?').bind(await hash(token)).first();
  if (!device) throw new HttpError(401, 'This device is no longer connected. Ask for a new pairing code in Settings.');
  if (url.pathname === '/session' && request.method === 'GET') return json({ connected: true });
  if (url.pathname === '/files' && ['GET', 'PUT'].includes(request.method)) {
    const path = url.searchParams.get('path') ?? '';
    const write = request.method === 'PUT';
    if (!allowedPath(path, write)) throw new HttpError(400, 'This file cannot be edited through the family app.');
    if (!write) return githubFile(env, path);
    const body = await jsonBody(request);
    if (body.sha !== undefined && (typeof body.sha !== 'string' || !/^[a-f0-9]{40,64}$/.test(body.sha))) throw new HttpError(400, 'Invalid file revision.');
    return githubFile(env, path, { value: validateDocument(path, body.value), sha: body.sha as string | undefined });
  }
  throw new HttpError(404, 'Unknown action.');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin');
    const permitted = origin === env.APP_ORIGIN;
    if (origin && !permitted) return json({ error: 'Origin not allowed.' }, 403);
    const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' });
    if (permitted) {
      headers.set('Access-Control-Allow-Origin', env.APP_ORIGIN);
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      headers.set('Access-Control-Expose-Headers', 'Retry-After');
      headers.set('Access-Control-Max-Age', '600');
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    let response: Response;
    try { response = await route(request, env); }
    catch (error) {
      // D1 quota/errors fail closed; don't leak database, credential or GitHub details.
      const failure = error instanceof HttpError ? error : paused();
      response = json({ error: failure.message }, failure.status);
      if (failure.retryAfter) headers.set('Retry-After', String(Math.min(86430, failure.retryAfter)));
    }
    response.headers.forEach((value, key) => headers.set(key, value));
    return new Response(response.body, { status: response.status, headers });
  },
};
