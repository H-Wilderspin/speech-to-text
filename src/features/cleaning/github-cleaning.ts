import { readJsonFile, writeJsonFile } from '../planners/github';
import { emptyCleaningPlan, parseCleaningPlan, type CleaningPlan } from './tasks';
import { cleaningDocument, resetCompletions } from './completion-reset';

const path = (week?: string) => week ? `cleaning/weeks/${week}.json` : 'cleaning/defaults.json';
export class CleaningConflict extends Error {
  constructor(readonly latest: CleaningPlan, readonly scope: 'week' | 'defaults') {
    super('Someone changed this task. Cancel and reopen it to see their change.');
  }
}
async function readFile(week: string | undefined, token: string) {
  const file = await readJsonFile(path(week), token);
  return { sha: file.sha, plan: file.value === undefined ? emptyCleaningPlan() : parseCleaningPlan(file.value, week) };
}
export async function readCleaningPlan(week: string | undefined, token = ''): Promise<CleaningPlan> {
  return (await readFile(week, token)).plan;
}

// Anonymous readers see the same reset without needing write access. Editors
// persist it conditionally; a second device must re-read the marker after a race.
export async function syncCleaningWeek(week: string, token = ''): Promise<CleaningPlan> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { plan, sha } = await readFile(week, token);
    const updated = resetCompletions(plan, week);
    if (updated === plan || !token) return updated;
    const saved = await writeJsonFile(path(week), cleaningDocument(updated), sha, token, `Reset task ticks for Sunday: ${updated.completionReset}`);
    if (saved.ok) return updated;
    if (saved.status !== 409 && saved.status !== 422) throw new Error('Could not save the Sunday task reset. Refresh to try again.');
  }
  throw new Error('The task plan is busy with other edits. Refresh to try again.');
}

export type CleaningChange =
  | { field: 'tasks'; key: string; previous: string | null | undefined; value: string | null | undefined }
  | { field: 'completed'; key: string; previous: boolean | undefined; value: boolean };

// Merge at task/checkbox granularity, never replacing another task or a dated
// exception when editing recurrence. Completion lives only in its dated week.
export async function saveCleaningChange(week: string | undefined, change: CleaningChange, token: string): Promise<CleaningPlan> {
  if (!token) throw new Error('Connect GitHub in Settings to edit tasks.');
  const next = typeof change.value === 'string' ? change.value.trim() || undefined : change.value;
  const sample = emptyCleaningPlan();
  if (change.field === 'tasks') sample.tasks[change.key] = typeof next === 'string' ? next : null;
  else sample.completed[change.key] = change.value;
  // Validate removals using a harmless text value; null is only a dated skip.
  if (change.field === 'tasks' && next === undefined) sample.tasks[change.key] = 'Removed';
  parseCleaningPlan({ version: 1, ...sample }, week);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { plan: stored, sha } = await readFile(week, token);
    const plan = resetCompletions(stored, week);
    const current = plan[change.field][change.key];
    if (current === next && plan === stored) return plan;
    if (current !== next && current !== change.previous) throw new CleaningConflict(plan, week ? 'week' : 'defaults');
    const updated = { ...plan, tasks: { ...plan.tasks }, completed: { ...plan.completed } };
    if (change.field === 'tasks') {
      if (next === undefined) delete updated.tasks[change.key];
      else updated.tasks[change.key] = next as string | null;
    } else updated.completed[change.key] = change.value;
    const saved = await writeJsonFile(path(week), cleaningDocument(updated), sha, token, `Update tasks ${change.field}: ${change.key}`);
    if (saved.ok) return updated;
    if (saved.status !== 409 && saved.status !== 422) throw new Error('GitHub did not save this change. Try again; your task is kept here.');
  }
  throw new Error('The task plan is busy with other edits. Try saving again.');
}
