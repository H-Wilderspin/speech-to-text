import { dateKey, weekdayNames, weekDays } from '../meals/calendar';

export type CleaningPlan = {
  tasks: Record<string, string | null>; completed: Record<string, boolean>;
  completionReset?: string;
};
export const emptyCleaningPlan = (): CleaningPlan => ({ tasks: {}, completed: {} });
export const cleaningDayLabel = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
export const recurringTaskKey = (date: Date, id: string) => `${weekdayNames[date.getDay()]!.toLowerCase()}/${id}`;

export function parseCleaningPlan(value: unknown, week?: string): CleaningPlan {
  const data = value as { version?: unknown; tasks?: unknown; completed?: unknown; completionReset?: unknown } | null;
  const record = (input: unknown): input is Record<string, unknown> => Boolean(input) && typeof input === 'object' && !Array.isArray(input);
  if (!data || (data.version !== 1 && data.version !== 2) || !record(data.tasks) || (data.completed !== undefined && !record(data.completed))) {
    throw new Error('The saved task plan has an unsupported format. No changes were made.');
  }
  const days = new Set(week ? weekDays(new Date(`${week}T12:00:00`)).map(dateKey) : weekdayNames.map(day => day.toLowerCase()));
  const validKey = (key: string) => {
    const [day, id, extra] = key.split('/');
    return days.has(day!) && Boolean(id && /^[a-zA-Z0-9-]{1,64}$/.test(id)) && extra === undefined;
  };
  const result = emptyCleaningPlan();
  if (data.version === 2 || data.completionReset !== undefined) {
    if (data.version !== 2 || !week || data.completionReset !== dateKey(weekDays(new Date(`${week}T12:00:00`))[6]!)) {
      throw new Error('The saved task plan contains an invalid completion reset. No changes were made.');
    }
    result.completionReset = data.completionReset as string;
  }
  for (const [key, task] of Object.entries(data.tasks)) {
    const skipped = Boolean(week) && task === null;
    if (!validKey(key) || (!skipped && !(typeof task === 'string' && task.trim() && task.length <= 300))) {
      throw new Error('The saved task plan contains an invalid task. No changes were made.');
    }
    result.tasks[key] = task as string | null;
  }
  for (const [key, done] of Object.entries(data.completed ?? {})) {
    if (!week || !validKey(key) || typeof done !== 'boolean') throw new Error('The saved task plan contains an invalid completion. No changes were made.');
    result.completed[key] = done;
  }
  return result;
}

export function tasksForDay(plan: CleaningPlan, defaults: CleaningPlan, date: Date) {
  const prefix = `${dateKey(date)}/`;
  const recurringPrefix = `${weekdayNames[date.getDay()]!.toLowerCase()}/`;
  const ids = new Set([
    ...Object.keys(defaults.tasks).filter(key => key.startsWith(recurringPrefix)).map(key => key.slice(recurringPrefix.length)),
    ...Object.keys(plan.tasks).filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length)),
  ]);
  return [...ids].flatMap(id => {
    const key = prefix + id;
    const defaultKey = recurringPrefix + id;
    const override = plan.tasks[key];
    const text = override ?? defaults.tasks[defaultKey];
    return text ? [{ id, key, defaultKey, text, skipped: override === null, recurring: override === undefined, done: plan.completed[key] === true }] : [];
  });
}
