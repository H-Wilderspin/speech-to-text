import { mealKey, mealSlots, weekdayNames, weekDays, type MealPlan, type MealValue } from './calendar';

export const repository = 'H-Wilderspin/speech-to-text-meals';
export const repositoryUrl = `https://github.com/${repository}`;
const api = `https://api.github.com/repos/${repository}/contents/`;
const raw = `https://raw.githubusercontent.com/${repository}/main/`;
const filePath = (week: string | undefined) => week ? `weeks/${week}.json` : 'defaults.json';
const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
export class PlanConflict extends Error {
  constructor(readonly latest: MealPlan, readonly scope: 'week' | 'defaults' = 'week') {
    super(`Someone changed this ${scope === 'defaults' ? 'weekly default' : 'meal'}. Cancel and reopen it to see their change.`);
  }
}

function parsePlan(value: unknown, week?: string): MealPlan {
  const data = value as { version?: unknown; meals?: unknown } | null;
  if (!data || !(data.version === 1 || (week && data.version === 2)) || !data.meals || typeof data.meals !== 'object' || Array.isArray(data.meals)) {
    throw new Error('The saved plan has an unsupported format. No changes were made.');
  }
  const keys = new Set(week
    ? weekDays(new Date(`${week}T12:00:00`)).flatMap(date => mealSlots.map(slot => mealKey(date, slot)))
    : weekdayNames.flatMap(day => mealSlots.map(slot => `${day.toLowerCase()}/${slot.toLowerCase()}`)));
  const result: MealPlan = {};
  for (const [key, meal] of Object.entries(data.meals)) {
    const skipped = Boolean(week) && data.version === 2 && meal === null;
    if (!keys.has(key) || (!skipped && (typeof meal !== 'string' || meal.length > 300))) {
      throw new Error('The saved plan contains an invalid meal. No changes were made.');
    }
    if (meal === null) result[key] = null;
    else if (typeof meal === 'string' && meal.trim()) result[key] = meal;
  }
  return result;
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error('Could not reach GitHub. Check your connection and try again.');
  }
  if (response.status === 401) throw new Error('GitHub access expired or is invalid. In Settings, use Disconnect GitHub, then connect a new token.');
  if (response.status === 403 || response.status === 429) {
    throw new Error('GitHub denied this request. Check write access, or wait if its request limit was reached.');
  }
  return response;
}

// Readers use the public file, avoiding the low unauthenticated API rate limit.
// The cache buster refreshes a shared plan without rebuilding the Pages website.
export async function readPlan(week: string, token = ''): Promise<MealPlan> {
  return readDocument(week, token);
}

export async function readDefaults(token = ''): Promise<MealPlan> {
  return readDocument(undefined, token);
}

async function readDocument(week: string | undefined, token: string): Promise<MealPlan> {
  if (token) return (await readFile(week, token)).plan;
  const response = await request(`${raw}${filePath(week)}?updated=${Date.now()}`);
  if (response.status === 404) return {};
  if (!response.ok) throw new Error('Could not load the meal plan. Try again.');
  return parsePlan(await response.json(), week);
}

async function readFile(week: string | undefined, token: string): Promise<{ plan: MealPlan; sha?: string }> {
  const response = await request(`${api}${filePath(week)}?ref=main`, { headers: { ...headers, Authorization: `Bearer ${token}` } });
  if (response.status === 404) return { plan: {} };
  if (!response.ok) throw new Error('Could not check the latest plan. Your change has not been saved.');
  const file = await response.json() as { sha: string; content: string; encoding: string };
  if (file.encoding !== 'base64' || !file.sha) throw new Error('Could not read the saved plan.');
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0)));
  return { sha: file.sha, plan: parsePlan(JSON.parse(decoded), week) };
}

export async function checkEditor(token: string): Promise<string> {
  const response = await request(`https://api.github.com/repos/${repository}`, {
    headers: { ...headers, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('This GitHub account cannot access the meal repository.');
  const data = await response.json() as { permissions?: { push?: boolean } };
  if (!data.permissions?.push) throw new Error('This GitHub account needs write access to the meal repository.');
  return token;
}

export async function saveMeal(week: string, key: string, previous: MealValue, value: string | null, token: string): Promise<MealPlan> {
  return saveEntry(week, key, previous, value, token);
}

export async function saveDefault(key: string, previous: MealValue, value: string, token: string): Promise<MealPlan> {
  return saveEntry(undefined, key, previous, value, token);
}

async function saveEntry(week: string | undefined, key: string, previous: MealValue, value: string | null, token: string): Promise<MealPlan> {
  if (!token) throw new Error('Connect GitHub to edit.');
  const next = value === null ? null : value.trim() || undefined;
  parsePlan({ version: week ? 2 : 1, meals: { [key]: next === undefined ? '' : next } }, week);
  const url = `${api}${filePath(week)}`;
  const authenticated = { ...headers, Authorization: `Bearer ${token}` };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { plan, sha } = await readFile(week, token);
    if (plan[key] === next) return plan; // Also handles a lost save response.
    if (plan[key] !== (previous === '' ? undefined : previous)) throw new PlanConflict(plan, week ? 'week' : 'defaults');
    const updated = { ...plan };
    if (next !== undefined) updated[key] = next; else delete updated[key];
    const bytes = new TextEncoder().encode(JSON.stringify({ version: week ? 2 : 1, meals: updated }, null, 2) + '\n');
    const content = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
    const saved = await request(url, { method: 'PUT', headers: { ...authenticated, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `${next === undefined ? 'Remove' : next === null ? 'Skip' : 'Set'} ${week ? 'meal' : 'weekly default'}: ${key}`, branch: 'main', sha, content }),
    });
    if (saved.ok) return updated;
    if (saved.status !== 409 && saved.status !== 422) throw new Error('GitHub did not save this meal. Your text is kept here; try again.');
    // Concurrent edits to another slot can be merged, but never overwrite a
    // changed value in this slot. The file SHA makes each write conditional.
  }
  throw new Error('The plan is busy with other edits. Try saving again.');
}
