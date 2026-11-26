import { hash } from './crypto';
import { pairingCode } from './pairing';
import { HttpError, type Env } from './types';

export const invitationLifetime = 24 * 60 * 60000;

export async function createInvitation(env: Env, label: string, emailHash?: string) {
  const now = Date.now();
  await env.DB.prepare('DELETE FROM invites WHERE expires_at <= ?').bind(now).run();
  if (emailHash) {
    // A resend replaces only this recipient's unused code, never manual codes or
    // consumed invitations needed to recover a lost pairing response.
    await env.DB.prepare('DELETE FROM invites WHERE email_hash = ? AND claimed_hash IS NULL').bind(emailHash).run();
  }
  const expires = now + invitationLifetime;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = pairingCode();
    const codeHash = await hash(code);
    const inserted = await env.DB.prepare(`INSERT INTO invites (code_hash, label, expires_at, email_hash)
      SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM invites WHERE claimed_hash IS NULL AND expires_at > ?) < 5
        AND (SELECT COUNT(*) FROM devices) + (SELECT COUNT(*) FROM invites) < 100
      ON CONFLICT(code_hash) DO NOTHING RETURNING code_hash`)
      .bind(codeHash, label, expires, emailHash ?? null, now).first();
    if (inserted) return { code, expires };
  }
  throw new HttpError(409, 'Could not create a code. Use an existing code or wait for unused codes to expire (up to five at once).');
}
