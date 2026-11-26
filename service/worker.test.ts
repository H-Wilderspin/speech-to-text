import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { generateKeyPairSync, verify } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { hash } from './worker';
import * as pairing from './pairing';
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
  const code = (await response.json() as { code: string }).code;
  expect(code).toMatch(/^[0-9]{6}$/);
  return code;
}
async function connect() {
  const code = await invite();
  expect((await call('/pair', 'POST', { code, token }, '')).status).toBe(200);
  return code;
}
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('./migrations/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(`./migrations/${file}`, import.meta.url), 'utf8'));
  }
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
afterEach(() => { sqlite.close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('mobile owner page', () => {
  const ownerRequest = (path: string, method = 'GET', cookie = '', origin = 'https://sync.example', access = '', body?: unknown) => worker.fetch(new Request(`https://sync.example${path}`, {
    method, headers: { Cookie: cookie, Origin: origin, Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
  async function login() {
    const response = await ownerRequest('/admin/session', 'POST', '', undefined, env.ADMIN_TOKEN);
    expect(response.status).toBe(204);
    const cookie = response.headers.get('Set-Cookie')!;
    expect(cookie).toContain('HttpOnly; Secure; SameSite=Strict; Max-Age=43200');
    expect(cookie).not.toContain(env.ADMIN_TOKEN);
    return cookie.split(';')[0]!;
  }
  it('serves a non-cacheable, framed-out page without credentials or database access even while paused', async () => {
    env.SYNC_PAUSED = 'true';
    sqlite.exec('DROP TABLE guard');
    for (const path of ['/admin', '/admin/']) {
      const response = await worker.fetch(new Request(`https://sync.example${path}`), env);
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
      expect(response.headers.get('Content-Security-Policy')).toContain("form-action 'none'");
      const html = await response.text();
      expect(html).toContain('Create pairing code');
      expect(html).not.toContain('__NONCE__');
      expect(html).not.toContain(env.ADMIN_TOKEN);
    }
  });
  it('requires owner access, limits browser sessions to invitations, and preserves code constraints', async () => {
    expect((await ownerRequest('/admin/session', 'POST', '', undefined, token)).status).toBe(401);
    expect((await ownerRequest('/admin/session')).status).toBe(401);
    const cookie = await login();
    expect((await ownerRequest('/admin/session', 'GET', cookie)).status).toBe(200);
    for (const path of ['/admin/status', '/admin/devices', '/session']) {
      expect((await ownerRequest(path, 'GET', cookie, env.APP_ORIGIN)).status).toBe(401);
    }
    expect((await ownerRequest('/admin/pause', 'POST', cookie, undefined, '', { paused: true })).status).toBe(401);
    expect((await ownerRequest('/admin/invites', 'POST', cookie, undefined, '', { label: ' ' })).status).toBe(400);
    vi.spyOn(pairing, 'pairingCode').mockReturnValueOnce('001234');
    const response = await ownerRequest('/admin/invites', 'POST', cookie, undefined, '', { label: 'Phone' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ code: '001234' });
    for (let i = 0; i < 4; i++) await invite();
    expect((await ownerRequest('/admin/invites', 'POST', cookie, undefined, '', { label: 'Extra' })).status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects cross-origin or origin-less cookie mutations and cross-origin logins', async () => {
    const cookie = await login();
    for (const origin of ['', env.APP_ORIGIN, 'https://evil.example']) {
      expect((await ownerRequest('/admin/session', 'POST', '', origin, env.ADMIN_TOKEN)).status).toBe(403);
      expect((await ownerRequest('/admin/invites', 'POST', cookie, origin, '', { label: 'Phone' })).status).toBe(403);
      expect((await ownerRequest('/admin/session', 'DELETE', cookie, origin)).status).toBe(403);
    }
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM invites').get()?.total).toBe(0);
    // CLI calls still work without an Origin header or cookies.
    expect((await call('/admin/invites', 'POST', { label: 'CLI' }, env.ADMIN_TOKEN, '')).status).toBe(200);
  });
  it('rejects tampering, expires sessions, and invalidates sessions when the owner key rotates', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const cookie = await login();
    const tampered = cookie.slice(0, -1) + (cookie.endsWith('0') ? '1' : '0');
    expect((await ownerRequest('/admin/session', 'GET', tampered)).status).toBe(401);
    vi.setSystemTime(start + 12 * 60 * 60000 - 1);
    expect((await ownerRequest('/admin/session', 'GET', cookie)).status).toBe(200);
    vi.setSystemTime(start + 12 * 60 * 60000);
    expect((await ownerRequest('/admin/session', 'GET', cookie)).status).toBe(401);
    vi.setSystemTime(start);
    env.ADMIN_TOKEN = 'rotated-'.repeat(12);
    expect((await ownerRequest('/admin/session', 'GET', cookie)).status).toBe(401);
    const logout = await ownerRequest('/admin/session', 'DELETE', cookie);
    expect(logout.status).toBe(204);
    expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});

describe('family device boundary', () => {
  it('keeps leading zeros, tolerates dictated spacing, and retries code collisions without replacing invitations', async () => {
    vi.spyOn(pairing, 'pairingCode').mockReturnValueOnce('001234').mockReturnValueOnce('001234').mockReturnValueOnce('005678');
    expect(await invite()).toBe('001234');
    expect(await invite()).toBe('005678');
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM invites').get()?.total).toBe(2);
    expect((await call('/pair', 'POST', { code: '001 234', token })).status).toBe(200);
    expect((await call('/pair', 'POST', { code: '005-678', token: otherToken })).status).toBe(200);
  });
  it('keeps older long invitations usable without changing existing device access', async () => {
    const code = 'AAAA-BBBB-CCCC-DDDD-EEEE';
    sqlite.prepare('INSERT INTO invites (code_hash, label, expires_at) VALUES (?, ?, ?)')
      .run(await hash(code.replaceAll('-', '')), 'Existing invitation', Date.now() + 86400000);
    expect((await call('/pair', 'POST', { code, token })).status).toBe(200);
    expect((await call('/session')).status).toBe(200);
  });
  it('limits unused invitations atomically without invalidating existing ones', async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, () => call('/admin/invites', 'POST', { label: 'Tablet' }, env.ADMIN_TOKEN)));
    expect(responses.filter(response => response.status === 200)).toHaveLength(5);
    expect(responses.filter(response => response.status === 409)).toHaveLength(7);
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM invites').get()?.total).toBe(5);
    const code = (await responses.find(response => response.status === 200)!.json() as { code: string }).code;
    expect((await call('/pair', 'POST', { code, token })).status).toBe(200);
    await invite(); // a consumed invitation frees an unused-code slot
  });
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
  it('allows pairing just before 24 hours and keeps the device approved afterwards', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const code = await invite();
    vi.setSystemTime(start + 24 * 60 * 60000 - 1);
    expect((await call('/pair', 'POST', { code, token })).status).toBe(200);
    vi.setSystemTime(start + 365 * 24 * 60 * 60000);
    // Creating another invitation also cleans up expired invitations.
    await invite();
    expect((await call('/session')).status).toBe(200);
  });
  it('expires an unused invitation exactly 24 hours after creation', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const response = await call('/admin/invites', 'POST', { label: 'Tablet' }, env.ADMIN_TOKEN);
    const invitation = await response.json() as { code: string; expires: number };
    expect(invitation.expires).toBe(start + 24 * 60 * 60000);
    vi.setSystemTime(invitation.expires);
    expect((await call('/pair', 'POST', { code: invitation.code, token })).status).toBe(400);
    expect((await call('/session')).status).toBe(401);
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

describe('email pairing', () => {
  const address = 'dad@example.test';
  beforeEach(() => {
    env.PAIRING_EMAIL_ALLOWLIST = JSON.stringify([address, 'mum@example.test']);
    env.PAIRING_EMAIL_FROM = 'owner@example.test';
    env.BREVO_API_KEY = 'test-email-api-secret';
    fetchMock.mockImplementation(async () => Response.json({ messageId: 'test-message' }, { status: 201 }));
  });
  const requestCode = (email = address) => call('/pair/email', 'POST', { email }, '');
  function sentCode(index = 0) {
    return JSON.parse(fetchMock.mock.calls[index]![1]!.body as string).textContent.match(/code is (\d{6})/)[1] as string;
  }
  it('lists only approved addresses, fails closed on incomplete configuration and rejects invalid requests', async () => {
    const options = await call('/pair/options', 'GET', undefined, '');
    expect(options.headers.get('Cache-Control')).toBe('no-store');
    expect(await options.json()).toEqual({ emailEnabled: true, emails: [address, 'mum@example.test'] });
    expect((await requestCode('bad-address')).status).toBe(400);
    expect((await requestCode('x'.repeat(2000))).status).toBe(413);
    expect((await call('/pair/email', 'POST', { email: address }, '', 'https://evil.example')).status).toBe(403);
    for (const value of ['[]', 'not-json', JSON.stringify([address, 123]), JSON.stringify([address, 'bad'])]) {
      env.PAIRING_EMAIL_ALLOWLIST = value;
      expect(await (await call('/pair/options', 'GET', undefined, '')).json()).toEqual({ emailEnabled: false, emails: [] });
      expect((await requestCode()).status).toBe(503);
    }
    env.PAIRING_EMAIL_ALLOWLIST = JSON.stringify([address]);
    delete env.BREVO_API_KEY;
    expect((await requestCode()).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sends only to an exact approved address, keeps codes private and remembers access after OTP expiry', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    vi.spyOn(pairing, 'pairingCode').mockReturnValueOnce('001234');
    const unknown = await requestCode('stranger@example.test');
    const response = await requestCode('  DAD@EXAMPLE.TEST  ');
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(await unknown.json());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init?.redirect).toBe('manual');
    expect(init?.headers).toMatchObject({ 'api-key': env.BREVO_API_KEY });
    const mail = JSON.parse(init!.body as string);
    expect(mail.to).toEqual([{ email: address }]);
    expect(mail.sender).toEqual({ email: env.PAIRING_EMAIL_FROM, name: 'Speech to Text' });
    expect(sentCode()).toBe('001234');
    expect(mail.textContent).toContain('24 hours');
    expect(mail.htmlContent).toContain('001234');
    expect(mail.htmlContent).toContain('24 hours');
    expect(mail.textContent).not.toContain(env.ADMIN_TOKEN);
    const stored = JSON.stringify(sqlite.prepare('SELECT * FROM invites').all()) + JSON.stringify(sqlite.prepare('SELECT * FROM email_pairing_requests').all());
    expect(stored).not.toContain(address);
    expect(stored).not.toContain('001234');
    expect(sqlite.prepare('SELECT expires_at FROM invites').get()?.expires_at).toBe(start + 86400000);
    vi.setSystemTime(start + 86400000 - 1);
    expect((await call('/pair', 'POST', { code: sentCode(), token })).status).toBe(200);
    expect((await call('/pair', 'POST', { code: sentCode(), token })).status).toBe(200);
    expect((await call('/pair', 'POST', { code: sentCode(), token: otherToken })).status).toBe(400);
    vi.setSystemTime(start + 2 * 86400000);
    expect((await call('/session')).status).toBe(200);
  });
  it('rejects an emailed code exactly at 24 hours and when its address is removed', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    await requestCode();
    vi.setSystemTime(start + 86400000);
    expect((await call('/pair', 'POST', { code: sentCode(), token })).status).toBe(400);
    await requestCode('mum@example.test');
    env.PAIRING_EMAIL_ALLOWLIST = JSON.stringify([address]);
    expect((await call('/pair', 'POST', { code: sentCode(1), token })).status).toBe(400);
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM devices').get()?.total).toBe(0);
  });
  it('limits simultaneous resends, replaces only that recipient’s unused code and preserves manual codes', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const manual = await invite();
    const responses = await Promise.all(Array.from({ length: 10 }, () => requestCode()));
    expect(responses.every(response => response.status === 202)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(start + 60000);
    await requestCode();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await call('/pair', 'POST', { code: sentCode(0), token })).status).toBe(400);
    expect((await call('/pair', 'POST', { code: sentCode(1), token })).status).toBe(200);
    expect((await call('/pair', 'POST', { code: manual, token: otherToken })).status).toBe(200);
    expect(sqlite.prepare('SELECT requests FROM email_pairing_requests').get()?.requests).toBe(2);
  });
  it('limits each recipient to five requests per UTC day, including rejected email sends', async () => {
    vi.useFakeTimers();
    const start = Date.parse('2026-11-26T12:00:00Z');
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let index = 0; index < 8; index++) {
      vi.setSystemTime(start + index * 60000);
      expect((await requestCode()).status).toBe(202);
    }
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(warning.mock.calls.every(args => args.length === 1 && args[0] === 'Pairing email could not be sent.')).toBe(true);
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM invites').get()?.total).toBe(0);
    vi.setSystemTime(Date.parse('2026-11-27T00:00:00Z'));
    await requestCode();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
  it('enforces the shared daily send budget without exposing address membership or weakening guessing limits', async () => {
    vi.useFakeTimers();
    const start = Date.parse('2026-11-26T12:00:00Z');
    const addresses = Array.from({ length: 5 }, (_, index) => `person${index}@example.test`);
    env.PAIRING_EMAIL_ALLOWLIST = JSON.stringify(addresses);
    for (let index = 0; index < 20; index++) {
      vi.setSystemTime(start + index * 60000);
      await requestCode(addresses[index % 4]);
      sqlite.exec('UPDATE invites SET expires_at = 0');
    }
    expect(fetchMock).toHaveBeenCalledTimes(20);
    const limited = await requestCode(addresses[4]);
    const unknown = await requestCode('unknown@example.test');
    expect(await limited.json()).toEqual(await unknown.json());
    expect(fetchMock).toHaveBeenCalledTimes(20);
    expect(sqlite.prepare('SELECT requests FROM email_pairing_guard').get()?.requests).toBe(20);
    for (let index = 0; index < 5; index++) await call('/pair', 'POST', { code: 'bad', token });
    await requestCode(addresses[4]);
    expect((await call('/pair', 'POST', { code: '123456', token })).status).toBe(429);
  });
  it('does not follow email redirects, disclose provider failures, or delete existing manual invitations', async () => {
    const manual = await invite();
    fetchMock.mockResolvedValue(new Response('secret provider details', { status: 302, headers: { Location: 'https://evil.example' } }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await requestCode();
    expect(response.status).toBe(202);
    expect(await response.text()).not.toContain('secret');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM invites').get()?.total).toBe(1);
    expect((await call('/pair', 'POST', { code: manual, token })).status).toBe(200);
  });
});

describe('short-code guessing protection', () => {
  it('counts concurrent malformed attempts globally and recovers at the exact short-window boundary', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const code = await invite();
    const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => call('/pair', 'POST', { code: 'bad', token: `different-${index}` })));
    expect(responses.filter(response => response.status === 400)).toHaveLength(5);
    expect(responses.filter(response => response.status === 429)).toHaveLength(7);
    expect(responses.find(response => response.status === 429)!.headers.get('Retry-After')).toBe('900');
    vi.setSystemTime(start + 900000 - 1);
    expect((await call('/pair', 'POST', { code, token })).status).toBe(429);
    vi.setSystemTime(start + 900000);
    expect((await call('/pair', 'POST', { code, token })).status).toBe(200);
  });
  it('enforces the 24-hour budget across short-window resets without stopping connected devices', async () => {
    vi.useFakeTimers();
    await connect();
    const start = Date.now() + 86400000;
    for (let window = 0; window < 4; window++) {
      vi.setSystemTime(start + window * 900000);
      for (let guess = 0; guess < 5; guess++) expect((await call('/pair', 'POST', { code: 'bad', token })).status).toBe(400);
    }
    vi.setSystemTime(start + 3600000);
    const code = await invite(); // owner code generation must not reset the budget
    expect((await call('/pair', 'POST', { code, token: otherToken })).status).toBe(429);
    expect(sqlite.prepare('SELECT long_attempts FROM pairing_guard').get()?.long_attempts).toBe(20);
    expect((await call('/session')).status).toBe(200);
    vi.setSystemTime(start + 86400000 - 1);
    expect((await call('/pair', 'POST', { code, token: otherToken })).status).toBe(429);
    vi.setSystemTime(start + 86400000);
    expect((await call('/pair', 'POST', { code, token: otherToken })).status).toBe(200);
  });
  it('fails closed if the pairing limiter is unavailable, while existing sessions still work', async () => {
    await connect();
    sqlite.exec('DROP TABLE pairing_guard');
    expect((await call('/pair', 'POST', { code: '123456', token: otherToken })).status).toBe(503);
    expect((await call('/session')).status).toBe(200);
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
