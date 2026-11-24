import { HttpError, type Env } from './types';

const repo = 'H-Wilderspin/speech-to-text-meals';
const baseHeaders = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'speech-to-text-family-sync' };
const unavailable = () => new HttpError(503, 'Family syncing needs attention from the person who set it up. Your changes stay on this device.', 3600);
const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
const url64 = (bytes: Uint8Array) => encode(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const part = (value: unknown) => url64(new TextEncoder().encode(JSON.stringify(value)));
let cached: { key: string; token: string; expires: number } | undefined;
let pending: { key: string; result: Promise<string> } | undefined;

async function installationToken(env: Env, renew = false): Promise<string> {
  const cacheKey = `${env.GITHUB_APP_ID}:${env.GITHUB_INSTALLATION_ID}:${env.GITHUB_PRIVATE_KEY}`;
  if (!renew && cached?.key === cacheKey && cached.expires > Date.now() + 60000) return cached.token;
  if (pending?.key === cacheKey) return pending.result;
  const result = (async () => {
    let stage = 'key-import';
    try {
      const pem = env.GITHUB_PRIVATE_KEY.replace(/-----[\w ]+-----|\s/g, '');
      const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
      const now = Math.floor(Date.now() / 1000);
      stage = 'jwt-sign';
      const payload = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID })}`;
      const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(payload));
      stage = 'token-request';
      const response = await fetch(`https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`, {
        method: 'POST', headers: { ...baseHeaders, Authorization: `Bearer ${payload}.${url64(new Uint8Array(signature))}` },
        body: JSON.stringify({ repositories: ['speech-to-text-meals'], permissions: { contents: 'write' } }),
        // Workers rejects redirect: 'error'. Manual keeps credentials on GitHub;
        // the non-OK check below rejects redirects without following them.
        signal: AbortSignal.timeout(10000), redirect: 'manual',
      });
      stage = `token-response-${response.status}`;
      if (!response.ok) throw unavailable();
      const data = await response.json() as { token?: string; expires_at?: string };
      if (!data.token || !data.expires_at || !Number.isFinite(Date.parse(data.expires_at))) throw unavailable();
      cached = { key: cacheKey, token: data.token, expires: Date.parse(data.expires_at) };
      return data.token;
    } catch {
      // Only a fixed stage/status: never log exceptions, keys, JWTs or response bodies.
      console.warn('GitHub App connection failed:', stage);
      throw unavailable();
    }
  })();
  pending = { key: cacheKey, result };
  try { return await result; } finally { if (pending?.result === result) pending = undefined; }
}

export async function githubFile(env: Env, path: string, update?: { value: unknown; sha?: string }): Promise<Response> {
  const content = update ? encode(new TextEncoder().encode(JSON.stringify(update.value, null, 2) + '\n')) : undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await installationToken(env, attempt > 0);
    let response: Response;
    try {
      response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}${update ? '' : '?ref=main'}`, {
        method: update ? 'PUT' : 'GET',
        headers: { ...baseHeaders, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: update ? JSON.stringify({ message: `Update family ${path}`, branch: 'main', sha: update.sha, content }) : undefined,
        signal: AbortSignal.timeout(10000), redirect: 'manual',
      });
    } catch { throw new HttpError(503, 'Family syncing is temporarily unavailable. Your changes stay on this device.', 300); }
    if (response.status === 401 && attempt === 0) continue;
    if (response.status === 403 || response.status === 429) {
      const seconds = Number(response.headers.get('retry-after'));
      throw new HttpError(503, 'Family syncing is temporarily unavailable. Your changes stay on this device.', Math.max(300, Number.isFinite(seconds) ? seconds : 3600));
    }
    if (response.status === 409 || response.status === 422) return Response.json({ error: 'The shared file changed. Refresh and merge before retrying.' }, { status: 409 });
    if (!update && response.status === 404) return Response.json({}, { status: 404 });
    if (!response.ok) throw unavailable();
    // Never relay upstream headers, tokens or arbitrary error bodies to the device.
    if (update) return Response.json({ saved: true });
    const file = await response.json() as { encoding?: string; content?: string; sha?: string };
    if (file.encoding !== 'base64' || !file.content || !file.sha) throw unavailable();
    const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0));
    return Response.json({ value: JSON.parse(new TextDecoder().decode(bytes)), sha: file.sha });
  }
  throw unavailable();
}
