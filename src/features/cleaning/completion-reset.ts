import { addDays, dateKey } from '../meals/calendar';
import type { CleaningPlan } from './tasks';

// A week's ticks expire once, at the start of its Sunday in local calendar time.
// The shared marker protects ticks made afterwards, including on another device.
export function resetCompletions(plan: CleaningPlan, week: string | undefined, now = new Date()): CleaningPlan {
  if (!week) return plan;
  const sunday = dateKey(addDays(new Date(`${week}T12:00:00`), 6));
  if (dateKey(now) < sunday || plan.completionReset === sunday) return plan;
  return { ...plan, completed: {}, completionReset: sunday };
}

export const cleaningDocument = (plan: CleaningPlan) => ({ version: plan.completionReset ? 2 : 1, ...plan });
