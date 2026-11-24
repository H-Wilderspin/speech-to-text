import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { generateKeyPairSync, verify } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './worker';
import type { Database, Env, Statement } from './types';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
let sqlite: DatabaseSync;
let env: Env;
const token = `device_${'1'.repeat(64)}`;
const otherToken = `device_${'2'.repeat(64)}`;
const revision = 'a'.repeat(40);
const fetchMock = vi.fn<typeof fetch>();

function statement(sql: string): Statement {
  let args: (string | number | null)[] = [];
  return {
    bind(...values) { args = values; return this; },
    async first<T>() { return sqlite.prepare(sql).get(...args) as T ?? null; },
    async all<T>() { return { results: sqlite.prepare(sql).all(...args) as T[] }; },
    async run() { return sqlite.prepare(sql).run(...args); },
  };
}
async function call(path: string, method = 'GET', body?: unknown, access = token, origin = 'https://family.example') {
  return worker.fetch(new Request(`https://sync.example${path}`, {
    method, headers: { Origin: origin, Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
}
async function invite() {
  const response = await call('/admin/invites', 'POST', { label: 'Granddad tablet' }, env.ADMIN_TOKEN);
  expect(response.status).toBe(200);
  return (await response.json() as { code: string }).code;
}
async function connect() {
  const code = await invite();
  expect((await call('/pair', 'POST', { code, token }, '')).status).toBe(200);
  return code;
}
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('./migrations/0001_devices.sql', import.meta.url), 'utf8'));
  const db: Database = { prepare: statement, async batch(statements) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const query of statements) results.push(await query.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  env = { DB: db, APP_ORIGIN: 'https://family.example', ADMIN_TOKEN: 'owner-'.repeat(12), SYNC_PAUSED: 'false',
    DAILY_REQUEST_LIMIT: '5000', GITHUB_APP_ID: crypto.randomUUID(), GITHUB_INSTALLATION_ID: '123', GITHUB_PRIVATE_KEY: privateKey };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url, init) => {
    // Match workerd: Node supports this mode but Workers throws before sending.
    if (init?.redirect === 'error') throw new TypeError('Unsupported redirect mode');
    if (String(url).endsWith('/access_tokens')) return Response.json({ token: 'installation-secret', expires_at: new Date(Date.now() + 3600000).toISOString() });
    return Response.json({ encoding: 'base64', sha: revision, content: btoa('{"version":1,"items":[]}') });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { sqlite.close(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('family device boundary', () => {
  it('pairs once, recovers a lost response and stores only hashes', async () => {
    const code = await connect();
    expect((await call('/pair', 'POST', { code, token })).status).toBe(200);
    expect((await call('/pair', 'POST', { code, token: otherToken })).status).toBe(400);
    expect((await call('/session')).status).toBe(200);
    const devices = sqlite.prepare('SELECT * FROM devices').all();
    expect(devices).toHaveLength(1);
    expect(JSON.stringify(devices)).not.toContain(token);
    expect(JSON.stringify(sqlite.prepare('SELECT * FROM invites').all())).not.toContain(code.replaceAll('-', ''));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('expires unused codes and cannot resurrect a revoked device', async () => {
    const code = await connect();
    const devices = await (await call('/admin/devices', 'GET', undefined, env.ADMIN_TOKEN)).json() as { id: string }[];
    expect((await call(`/admin/devices/${devices[0]!.id}`, 'DELETE', undefined, env.ADMIN_TOKEN)).status).toBe(200);
    expect((await call('/session')).status).toBe(401);
    expect((await call('/pair', 'POST', { code, token })).status).toBe(400);
    const expired = await invite();
    sqlite.exec('UPDATE invites SET expires_at = 0');
    expect((await call('/pair', 'POST', { code: expired, token: otherToken })).status).toBe(400);
  });
  it('restricts origins and owner operations, including preflight headers', async () => {
    expect((await call('/session', 'GET', undefined, token, 'https://evil.example')).status).toBe(403);
    expect((await call('/admin/invites', 'POST', { label: 'bad' })).status).toBe(401);
    const preflight = await call('/files', 'OPTIONS');
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(env.APP_ORIGIN);
    expect(preflight.headers.get('Access-Control-Expose-Headers')).toBe('Retry-After');
    expect(preflight.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });
  it('rejects arbitrary files, invalid weeks, catalogue writes and malformed schemas before GitHub', async () => {
    await connect();
    for (const path of ['../README.md', 'cleaning/x.json', 'weeks/2026-02-30.json', 'weeks/2026-11-24.json', 'shopping/regular-items.json']) {
      expect((await call(`/files?path=${encodeURIComponent(path)}`, 'PUT', { value: {} })).status).toBe(400);
    }
    const file = '/files?path=shopping/list.json';
    const item = { id: 'a', text: 'Milk', checked: false };
    for (const value of [{ version: 1, items: [item, item] }, { version: 1, items: [{ ...item, checked: 'yes' }] }, { version: 1, items: Array(501).fill(item) }]) {
      expect((await call(file, 'PUT', { value })).status).toBe(400);
    }
    expect((await call('/files?path=defaults.json', 'PUT', { value: { version: 1, meals: { 'monday/breakfast': null } } })).status).toBe(400);
    expect((await call('/files?path=weeks/2026-11-23.json', 'PUT', { value: { version: 2, meals: { '2026-11-30/lunch': 'Soup' } } })).status).toBe(400);
    expect((await call(file, 'PUT', { sha: 'invalid', value: { version: 1, items: [] } })).status).toBe(400);
    expect((await call(file, 'PUT', { value: 'x'.repeat(262144) })).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('free service guard', () => {
  it('pauses at an atomic daily cap, permits owner recovery, and resets at UTC midnight', async () => {
    await connect();
    env.DAILY_REQUEST_LIMIT = '3'; // pairing consumed one request
    const results = await Promise.all(Array.from({ length: 10 }, () => call('/session')));
    expect(results.filter(response => response.status === 200)).toHaveLength(2);
    expect(results.filter(response => response.status === 503)).toHaveLength(8);
    expect(sqlite.prepare('SELECT requests FROM guard').get()?.requests).toBe(3);
    expect(Number(results.find(response => response.status === 503)!.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await call('/admin/status', 'GET', undefined, env.ADMIN_TOKEN)).status).toBe(200);
    sqlite.exec("UPDATE guard SET day = '2000-01-01'");
    expect((await call('/session')).status).toBe(200);
  });
  it('fails closed on database failure or missing opt-in and keeps the owner pause across days', async () => {
    await connect();
    expect((await call('/admin/pause', 'POST', { paused: true }, env.ADMIN_TOKEN)).status).toBe(200);
    sqlite.exec("UPDATE guard SET day = '2000-01-01'");
    expect((await call('/session')).status).toBe(503);
    await call('/admin/pause', 'POST', { paused: false }, env.ADMIN_TOKEN);
    expect((await call('/session')).status).toBe(200);
    delete env.SYNC_PAUSED;
    expect((await call('/session')).status).toBe(503);
    env.SYNC_PAUSED = 'false';
    sqlite.exec('DROP TABLE guard');
    expect((await call('/session')).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GitHub App transport', () => {
  it('rejects redirects without forwarding App or installation credentials', async () => {
    await connect();
    const redirect = () => new Response(null, { status: 302, headers: { Location: 'https://other.example' } });
    fetchMock.mockResolvedValueOnce(redirect());
    expect((await call('/files?path=defaults.json')).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]!.redirect).toBe('manual');
    await call('/files?path=defaults.json'); // establish installation access
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(redirect());
    expect((await call('/files?path=defaults.json')).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]!.redirect).toBe('manual');
    expect((await call('/session')).status).toBe(200);
  });
  it('signs a real JWT, caches installation access, and makes UTF-8 conditional writes to the fixed repo', async () => {
    await connect();
    const response = await call('/files?path=shopping/list.json');
    expect(await response.json()).toEqual({ sha: revision, value: { version: 1, items: [] } });
    const value = { version: 1, items: [{ id: 'milk', text: 'Crème 🥛', checked: false }] };
    expect((await call('/files?path=shopping/list.json', 'PUT', { value, sha: revision })).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const jwt = (fetchMock.mock.calls[0]![1]!.headers as Record<string, string>).Authorization!.slice(7);
    const [header, payload, signature] = jwt.split('.') as [string, string, string];
    expect(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), keys.publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    expect(claims.iss).toBe(env.GITHUB_APP_ID);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(600);
    const [url, request] = fetchMock.mock.calls[2]!;
    expect(url).toBe('https://api.github.com/repos/H-Wilderspin/speech-to-text-meals/contents/shopping/list.json');
    const body = JSON.parse(request!.body as string);
    expect(body.sha).toBe(revision); expect(body.branch).toBe('main');
    expect(JSON.parse(Buffer.from(body.content, 'base64').toString())).toEqual(value);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(token);
  });
  it('renews after an upstream 401, but never asks grandparents to re-pair for App failure', async () => {
    await connect();
    fetchMock.mockResolvedValueOnce(Response.json({ token: 'old', expires_at: new Date(Date.now() + 3600000).toISOString() }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));
    expect((await call('/files?path=defaults.json')).status).toBe(200);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/access_tokens'))).toHaveLength(2);
    fetchMock.mockResolvedValue(new Response('private error', { status: 401 }));
    const response = await call('/files?path=defaults.json');
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private error');
    expect((await call('/session')).status).toBe(200);
  });
  it('preserves SHA conflicts, absent files and rate limit retry guidance', async () => {
    await connect();
    await call('/files?path=defaults.json'); // populate installation access
    fetchMock.mockResolvedValueOnce(new Response('', { status: 409 }));
    expect((await call('/files?path=defaults.json', 'PUT', { value: { version: 1, meals: {} }, sha: revision })).status).toBe(409);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
    expect((await call('/files?path=weeks/2026-11-23.json')).status).toBe(404);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '7200' } }));
    const response = await call('/files?path=defaults.json');
    expect(response.status).toBe(503); expect(response.headers.get('Retry-After')).toBe('7200');
  });
});
