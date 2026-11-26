import { hash } from './crypto';
import { createInvitation } from './invitations';
import { HttpError, type Env } from './types';
import { jsonBody } from './validation';

export const emailPairingMessage = 'If this email is approved, a code should arrive shortly. Check your spam folder, or ask the family administrator for a pairing code.';
const normalize = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = (value: string) => value.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(value);

function allowedEmails(env: Env): string[] {
  try {
    const values: unknown = JSON.parse(env.PAIRING_EMAIL_ALLOWLIST ?? '[]');
    if (!Array.isArray(values) || !values.length || values.length > 20 || !values.every(value => validEmail(normalize(value)))) return [];
    return [...new Set(values.map(normalize))];
  } catch { return []; }
}

export const emailPairingEnabled = (env: Env) => !!env.BREVO_API_KEY && validEmail(normalize(env.PAIRING_EMAIL_FROM))
  && !!env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 32 && allowedEmails(env).length > 0;

export function emailPairingOptions(env: Env) {
  const emailEnabled = emailPairingEnabled(env);
  // The owner explicitly wants approved addresses visible in the unpaired UI.
  // Read them from server configuration, never embed them in frontend assets.
  return { emailEnabled, emails: emailEnabled ? allowedEmails(env) : [] };
}

const recipientHash = (env: Env, email: string) => hash(`${env.ADMIN_TOKEN}:email-pairing:${email}`);

export async function emailStillAllowed(env: Env, emailHash: string): Promise<boolean> {
  if (!emailPairingEnabled(env)) return false;
  return (await Promise.all(allowedEmails(env).map(email => recipientHash(env, email)))).includes(emailHash);
}

export async function requestEmailCode(request: Request, env: Env): Promise<Response> {
  if (!emailPairingEnabled(env)) throw new HttpError(503, 'Email codes are not available. Ask the family administrator for a pairing code.', 60);
  const body = await jsonBody(request, 1024);
  const email = normalize(body.email);
  if (!validEmail(email)) throw new HttpError(400, 'Enter a valid email address.');
  const accepted = () => Response.json({ message: emailPairingMessage, retryAfter: 60 }, { status: 202 });
  // Keep delivery status, resend limits and capacity out of the response.
  // The options endpoint lists approved addresses; D1/logs still omit addresses.
  if (!allowedEmails(env).includes(email)) return accepted();
  const emailHash = await recipientHash(env, email);
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const admitted = await env.DB.prepare(`INSERT INTO email_pairing_requests (email_hash, day, requests, last_sent)
    VALUES (?, ?, 1, ?) ON CONFLICT(email_hash) DO UPDATE SET
      day = excluded.day, requests = CASE WHEN day = excluded.day THEN requests + 1 ELSE 1 END, last_sent = excluded.last_sent
    WHERE last_sent <= ? AND (day != excluded.day OR requests < 5) RETURNING email_hash`)
    .bind(emailHash, day, now, now - 60000).first();
  if (!admitted) return accepted();
  const budget = await env.DB.prepare(`UPDATE email_pairing_guard SET day = ?, requests = CASE WHEN day = ? THEN requests + 1 ELSE 1 END
    WHERE id = 1 AND (day != ? OR requests < 20) RETURNING id`).bind(day, day, day).first();
  if (!budget) return accepted();

  let codeHash: string | undefined;
  try {
    const invitation = await createInvitation(env, 'Family device (email)', emailHash);
    codeHash = await hash(invitation.code);
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { 'api-key': env.BREVO_API_KEY!, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: [{ email }], sender: { email: normalize(env.PAIRING_EMAIL_FROM), name: 'Speech to Text' },
        subject: 'Your Speech to Text pairing code',
        textContent: `Your pairing code is ${invitation.code}.\n\nEnter all six digits in Speech to Text: Settings > Family connection > Pairing code.\n\nThis code connects one device and expires in 24 hours. Only the newest emailed code works. Once connected, your device stays connected.\n\nIf you did not request this code, you can ignore this email. Do not share the code with anyone else.`,
        htmlContent: `<div style="font-family: sans-serif; font-size: 18px; line-height: 1.6"><p>Your Speech to Text pairing code:</p><p style="font-size: 36px; font-weight: bold; letter-spacing: 4px">${invitation.code}</p><p>Enter all six digits in <strong>Settings &gt; Family connection &gt; Pairing code</strong>.</p><p>This code connects one device and expires in <strong>24 hours</strong>. Only the newest emailed code works. Once connected, your device stays connected.</p><p>If you did not request this code, you can ignore this email. Do not share the code with anyone else.</p></div>`,
      }),
    });
    if (!response.ok || typeof (await response.json() as { messageId?: unknown }).messageId !== 'string') {
      throw new Error('Email provider did not accept the message.');
    }
  } catch (error) {
    if (codeHash) await env.DB.prepare('DELETE FROM invites WHERE code_hash = ? AND claimed_hash IS NULL').bind(codeHash).run();
    // Fixed diagnostic only: provider errors may contain recipients or message bodies.
    if (!(error instanceof HttpError && error.status === 409)) console.warn('Pairing email could not be sent.');
  }
  return accepted();
}
