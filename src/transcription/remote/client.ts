import type { SpeakerProfile } from '../../storage/profiles';
import type { AudioWindow } from './windows';

export interface Connection { url: string; key: string }
export interface RemoteWord { text: string; start: number; end: number; speakerId?: string }
export interface WindowResult { index: number; words: RemoteWord[]; processingMs: number }

export async function checkService(connection: Connection, signal: AbortSignal) {
  const response = await fetch(`${serviceUrl(connection.url)}/health`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
  });
  if (!response.ok || (await response.json()).protocol !== 1) throw new Error('The PC comparison service is not ready.');
}

export function serviceUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Add the comparison service address in Settings.'); }
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Enter an HTTPS service address.');
  return url.origin;
}

export async function sendWindow(connection: Connection, window: AudioWindow, profiles: readonly SpeakerProfile[], signal: AbortSignal): Promise<WindowResult> {
  const pcm = new Uint8Array(window.samples.length * 2);
  const view = new DataView(pcm.buffer);
  for (let i = 0; i < window.samples.length; i++) view.setInt16(i * 2, Math.round(Math.max(-1, Math.min(1, window.samples[i]!)) * 32767), true);
  let binary = '';
  for (let i = 0; i < pcm.length; i += 8192) binary += String.fromCharCode(...pcm.subarray(i, i + 8192));
  const body = JSON.stringify({ index: window.index, startSample: window.startSample, acceptFrom: window.acceptFrom,
    acceptUntil: window.acceptUntil, pcm: btoa(binary), profiles: profiles.map(({ id, embedding, modelVersion }) => ({ id, embedding, modelVersion })) });
  pcm.fill(0); binary = '';
  const response = await fetch(`${serviceUrl(connection.url)}/v1/transcribe`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.key.trim()}` }, body,
    signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(response.status === 401 ? 'Check the service access code in Settings.'
    : response.status === 503 ? 'The comparison service is busy. Try again shortly.' : 'The comparison service could not process this recording.');
  const result: WindowResult = await response.json();
  if (result.index !== window.index || !Array.isArray(result.words) || result.words.length > 1000
    || !Number.isFinite(result.processingMs) || !result.words.every((word) => typeof word.text === 'string' && word.text.length <= 200
      && Number.isFinite(word.start) && Number.isFinite(word.end) && word.start >= 0 && word.end >= word.start
      && word.end <= window.samples.length / 16000 + .05
      && (word.speakerId === undefined || profiles.some((profile) => profile.id === word.speakerId)))) throw new Error('The comparison service returned an incompatible response.');
  return result;
}
