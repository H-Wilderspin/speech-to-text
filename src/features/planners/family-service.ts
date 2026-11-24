// Public deployment setting only. Credentials must never use a VITE_ variable.
export const familyServiceUrl = (import.meta.env.VITE_SYNC_SERVICE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
export const isDeviceToken = (token: string) => token.startsWith('device_');
export class DeviceAccessError extends Error {}
export class SyncPausedError extends Error {
  constructor(message: string, readonly retryAt: number) { super(message); }
}
let pausedUntil = 0;
let pauseMessage = '';
let pairingRetryAt = 0;
let pairingMessage = '';

export async function serviceRequest(path: string, token = '', init?: RequestInit): Promise<Response> {
  if (path === '/pair' && Date.now() < pairingRetryAt) throw new Error(pairingMessage);
  if (Date.now() < pausedUntil) throw new SyncPausedError(pauseMessage, pausedUntil);
  if (!familyServiceUrl) throw new Error('The family connection is not configured. Ask the person who set up the app for help.');
  // A relative address is only supplied by Vite's opt-in development proxy.
  const url = new URL(familyServiceUrl, import.meta.env.DEV && familyServiceUrl.startsWith('/') ? window.location.origin : undefined);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('The family connection needs a secure address.');
  }
  let response: Response;
  try {
    response = await fetch(`${url.href.replace(/\/+$/, '')}${path}`, { ...init, headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', ...init?.headers,
    }, cache: 'no-store', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(30000) });
  } catch { throw new Error('Could not reach family syncing. Your changes stay on this device.'); }
  if (response.ok || response.status === 404 || response.status === 409) return response;
  let message = 'Family syncing is unavailable. Your changes stay on this device.';
  try {
    const body = await response.json() as { error?: string };
    if (typeof body.error === 'string') message = body.error;
  } catch { /* Provider quota responses may be HTML rather than our JSON. */ }
  if (response.status === 401) throw new DeviceAccessError(message);
  if (response.status === 429 || response.status >= 500) {
    const retry = response.headers.get('retry-after');
    const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : retry ? (Date.parse(retry) - Date.now()) / 1000 : 900;
    if (path === '/pair' && response.status === 429) {
      pairingRetryAt = Date.now() + Math.max(1, Math.min(86430, Number.isFinite(seconds) ? seconds : 900)) * 1000;
      pairingMessage = message;
      throw new Error(message);
    }
    pausedUntil = Date.now() + Math.max(60, Math.min(86430, Number.isFinite(seconds) ? seconds : 900)) * 1000;
    pauseMessage = message;
    throw new SyncPausedError(message, pausedUntil);
  }
  throw new Error(message);
}

export function newDeviceToken(): string {
  return 'device_' + Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function pairDevice(code: string, token: string): Promise<string> {
  code = code.toUpperCase().replace(/[\s-]/g, '');
  if (!/^(?:[0-9]{6}|[A-F0-9]{20})$/.test(code)) throw new Error('Enter the six-digit pairing code.');
  const response = await serviceRequest('/pair', '', { method: 'POST', body: JSON.stringify({ code, token }) });
  if (!response.ok) throw new Error('Could not connect this device. Check the pairing code.');
  return token;
}
