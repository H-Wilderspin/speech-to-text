import { HttpError, paused, type Env } from './types';

export function pairingCode(): string {
  // Reject the uneven tail instead of biasing some of the million possible codes.
  let value: number;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]!; } while (value >= 4294000000);
  return String(value % 1000000).padStart(6, '0');
}

export async function admitPairing(env: Env) {
  const now = Date.now();
  const shortWindow = 15 * 60000;
  const longWindow = 24 * 60 * 60000;
  // One persistent, atomic budget for ALL callers, including malformed requests.
  // Client tokens/IPs are not trusted as rate-limit identities.
  const accepted = await env.DB.prepare(`UPDATE pairing_guard SET
    short_start = CASE WHEN short_start <= ? THEN ? ELSE short_start END,
    short_attempts = CASE WHEN short_start <= ? THEN 1 ELSE short_attempts + 1 END,
    long_start = CASE WHEN long_start <= ? THEN ? ELSE long_start END,
    long_attempts = CASE WHEN long_start <= ? THEN 1 ELSE long_attempts + 1 END
    WHERE id = 1 AND (short_start <= ? OR short_attempts < 5)
      AND (long_start <= ? OR long_attempts < 20) RETURNING id`)
    .bind(now - shortWindow, now, now - shortWindow, now - longWindow, now, now - longWindow,
      now - shortWindow, now - longWindow).first();
  if (accepted) return;
  const state = await env.DB.prepare('SELECT * FROM pairing_guard WHERE id = 1')
    .first<{ short_start: number; short_attempts: number; long_start: number; long_attempts: number }>();
  if (!state) throw paused();
  const retryAt = Math.max(now,
    state.short_attempts >= 5 ? state.short_start + shortWindow : now,
    state.long_attempts >= 20 ? state.long_start + longWindow : now);
  const seconds = Math.max(1, Math.ceil((retryAt - now) / 1000));
  throw new HttpError(429, `Too many pairing attempts. Please try again in ${Math.ceil(seconds / 60)} minutes. Connected devices can still sync.`, seconds);
}
