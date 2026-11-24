import { HttpError } from './types';

const invalid = () => new HttpError(400, 'This change has an unsupported format. No changes were saved.');
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
export function allowedPath(path: string, write: boolean): boolean {
  if (path === 'defaults.json' || path === 'shopping/list.json') return true;
  if (!write && path === 'shopping/regular-items.json') return true;
  const match = /^weeks\/(\d{4}-\d{2}-\d{2})\.json$/.exec(path);
  if (!match) return false;
  const date = new Date(`${match[1]}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === match[1] && date.getUTCDay() === 1;
}
export function validateDocument(path: string, value: unknown): unknown {
  const data = record(value);
  if (path === 'shopping/list.json') {
    if (data.version !== 1 || !Array.isArray(data.items) || data.items.length > 500) throw invalid();
    const ids = new Set<string>();
    return { version: 1, items: data.items.map((entry: unknown) => {
      const item = record(entry);
      if (typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(item.id) || ids.has(item.id)
        || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 300 || typeof item.checked !== 'boolean') throw invalid();
      ids.add(item.id);
      return { id: item.id, text: item.text, checked: item.checked };
    }) };
  }
  const weekly = path.startsWith('weeks/');
  if (!(data.version === 1 || (weekly && data.version === 2))) throw invalid();
  const meals = record(data.meals);
  const days = weekly ? Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${path.slice(6, -5)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    return date.toISOString().slice(0, 10);
  }) : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const keys = new Set(days.flatMap(day => ['breakfast', 'lunch', 'dinner'].map(slot => `${day}/${slot}`)));
  for (const [key, meal] of Object.entries(meals)) {
    if (!keys.has(key) || !(typeof meal === 'string' && meal.length <= 300 || weekly && meal === null)) throw invalid();
  }
  return { version: data.version, meals };
}

// Bound the actual streamed body, not just a caller-supplied Content-Length.
export async function jsonBody(request: Request, maxBytes = 262144): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw invalid();
  const reader = request.body?.getReader();
  if (!reader) throw invalid();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, 'This change is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return record(JSON.parse(new TextDecoder().decode(bytes))); }
  catch { throw invalid(); }
}
