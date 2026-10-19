import { mealKey, mealSlots, weekdayNames, weekDays, type MealPlan, type MealValue } from './calendar';

import { readJsonFile, writeJsonFile } from '../planners/github';
export { repository, repositoryUrl, checkEditor } from '../planners/github';
const filePath = (week: string | undefined) => week ? `weeks/${week}.json` : 'defaults.json';
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

export async function readPlan(week: string, token = ''): Promise<MealPlan> {
  return (await readFile(week, token)).plan;
}
export async function readDefaults(token = ''): Promise<MealPlan> {
  return (await readFile(undefined, token)).plan;
}
async function readFile(week: string | undefined, token: string): Promise<{ plan: MealPlan; sha?: string }> {
  const file = await readJsonFile(filePath(week), token);
  return { sha: file.sha, plan: file.value === undefined ? {} : parsePlan(file.value, week) };
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { plan, sha } = await readFile(week, token);
    if (plan[key] === next) return plan; // Also handles a lost save response.
    if (plan[key] !== (previous === '' ? undefined : previous)) throw new PlanConflict(plan, week ? 'week' : 'defaults');
    const updated = { ...plan };
    if (next !== undefined) updated[key] = next; else delete updated[key];
    const saved = await writeJsonFile(filePath(week), { version: week ? 2 : 1, meals: updated }, sha, token,
      `${next === undefined ? 'Remove' : next === null ? 'Skip' : 'Set'} ${week ? 'meal' : 'weekly default'}: ${key}`);
    if (saved.ok) return updated;
    if (saved.status !== 409 && saved.status !== 422) throw new Error('GitHub did not save this meal. Your text is kept here; try again.');
    // Concurrent edits to another slot can be merged, but never overwrite a
    // changed value in this slot. The file SHA makes each write conditional.
  }
  throw new Error('The plan is busy with other edits. Try saving again.');
}
