import { describe, expect, it } from 'vitest';
import { emptyCleaningPlan, parseCleaningPlan, tasksForDay } from './tasks';

const monday = new Date(2026, 9, 19, 12);
const defaults = { tasks: { 'monday/vacuum': 'Vacuum', 'monday/dust': 'Dust' }, completed: {} };
describe('cleaning recurrence and completion', () => {
  it('repeats multiple tasks while completion is specific to a date', () => {
    const plan = { tasks: {}, completed: { '2026-10-19/vacuum': true } };
    expect(tasksForDay(plan, defaults, monday).map(t => [t.text, t.done, t.recurring])).toEqual([['Vacuum', true, true], ['Dust', false, true]]);
    expect(tasksForDay(emptyCleaningPlan(), defaults, new Date(2026, 9, 26, 12)).every(t => !t.done)).toBe(true);
    expect(tasksForDay(plan, defaults, new Date(2026, 9, 20, 12))).toEqual([]);
  });
  it('keeps dated overrides, one-off additions and explicit skips distinct', () => {
    const plan = { tasks: { '2026-10-19/vacuum': 'Vacuum upstairs', '2026-10-19/dust': null, '2026-10-19/windows': 'Windows' }, completed: {} };
    const tasks = tasksForDay(plan, defaults, monday);
    expect(tasks.map(t => [t.text, t.skipped, t.recurring])).toEqual([['Vacuum upstairs', false, false], ['Dust', true, false], ['Windows', false, false]]);
    expect(tasksForDay(plan, emptyCleaningPlan(), monday).map(t => t.text)).toEqual(['Vacuum upstairs', 'Windows']);
    delete (plan.tasks as Record<string, unknown>)['2026-10-19/vacuum'];
    expect(tasksForDay(plan, defaults, monday)[0]?.text).toBe('Vacuum');
  });
  it('validates dates across New Year and rejects malformed task/completion data', () => {
    expect(parseCleaningPlan({ version: 1, tasks: { '2027-01-03/a': 'Clean' }, completed: {} }, '2026-12-28').tasks).toEqual({ '2027-01-03/a': 'Clean' });
    for (const value of [null, { version: 2, tasks: {} }, { version: 1, tasks: [] },
      { version: 1, tasks: { '2026-10-26/a': 'Outside week' } }, { version: 1, tasks: { '2026-10-19/a': '' } },
      { version: 1, tasks: { '2026-10-19/a': 'x'.repeat(301) } }, { version: 1, tasks: {}, completed: { '2026-10-19/a': 'yes' } },
      { version: 1, tasks: { '__proto__': 'invalid', '2026-10-19/a/b': 'invalid' } }]) {
      expect(() => parseCleaningPlan(value, '2026-10-19')).toThrow();
    }
    expect(() => parseCleaningPlan({ version: 1, tasks: { 'monday/a': null } })).toThrow('invalid task');
    expect(() => parseCleaningPlan({ version: 1, tasks: {}, completed: { 'monday/a': true } })).toThrow('invalid completion');
  });
});
