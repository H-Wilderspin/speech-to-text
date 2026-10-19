import { describe, expect, it } from 'vitest';
import { cleaningDocument, resetCompletions } from './completion-reset';
import { parseCleaningPlan, type CleaningPlan } from './tasks';

const plan: CleaningPlan = {
  tasks: { '2026-10-19/shop': 'Shopping trip', '2026-10-20/dust': null },
  completed: { '2026-10-19/shop': true, '2026-10-20/dust': false },
};
describe('Sunday task completion reset', () => {
  it('resets at local Sunday midnight, retaining tasks, skips and the original snapshot', () => {
    expect(resetCompletions(plan, '2026-10-19', new Date(2026, 9, 24, 23, 59, 59))).toBe(plan);
    const reset = resetCompletions(plan, '2026-10-19', new Date(2026, 9, 25, 0));
    expect(reset).toEqual({ tasks: plan.tasks, completed: {}, completionReset: '2026-10-25' });
    expect(plan.completed['2026-10-19/shop']).toBe(true);
    expect(parseCleaningPlan(cleaningDocument(reset), '2026-10-19')).toEqual(reset);
  });
  it('catches up when reopening after Sunday, but never clears subsequent ticks again', () => {
    const reset = resetCompletions(plan, '2026-10-19', new Date(2026, 9, 28));
    reset.completed['2026-10-19/shop'] = true;
    expect(resetCompletions(reset, '2026-10-19', new Date(2026, 10, 8))).toBe(reset);
    expect(reset.completed['2026-10-19/shop']).toBe(true);
  });
  it('leaves recurring defaults and future weeks alone and handles New Year', () => {
    expect(resetCompletions(plan, undefined, new Date(2027, 0, 3))).toBe(plan);
    expect(resetCompletions(plan, '2026-10-26', new Date(2026, 9, 25))).toBe(plan);
    expect(resetCompletions({ tasks: {}, completed: {} }, '2026-12-28', new Date(2027, 0, 3)).completionReset).toBe('2027-01-03');
  });
  it('rejects wrong or missing reset markers and retains version 1 compatibility', () => {
    expect(parseCleaningPlan({ version: 1, ...plan }, '2026-10-19')).toEqual(plan);
    for (const value of [
      { version: 2, ...plan },
      { version: 2, ...plan, completionReset: '2026-10-24' },
      { version: 1, ...plan, completionReset: '2026-10-25' },
    ]) expect(() => parseCleaningPlan(value, '2026-10-19')).toThrow('invalid completion reset');
    expect(() => parseCleaningPlan({ version: 2, tasks: {}, completed: {}, completionReset: '2026-10-25' })).toThrow('invalid completion reset');
  });
});
