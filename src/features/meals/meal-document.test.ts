import { describe, expect, it } from 'vitest';
import { mealDocument } from './meal-document';
import { EditConflict } from '../planners/sync-document';

const week = '2026-10-19';
const key = `${week}/breakfast`;

describe('meal document used by planner sync', () => {
  it('reads older weeks and supports dated skips while keeping defaults separate', () => {
    expect(mealDocument(week).parse({ version: 1, meals: { [key]: 'Toast' } }))
      .toEqual({ version: 2, meals: { [key]: 'Toast' } });
    expect(mealDocument(week).parse({ version: 2, meals: { [key]: null } }).meals[key]).toBeNull();
    expect(mealDocument().parse({ version: 1, meals: { 'monday/breakfast': 'Porridge' } }).meals)
      .toEqual({ 'monday/breakfast': 'Porridge' });
  });

  it('rejects unsupported files and meal keys or values outside the selected document', () => {
    const adapter = mealDocument(week);
    for (const value of [null, { version: 99, meals: {} }, { version: 1, meals: [] },
      { version: 2, meals: { '2020-01-01/lunch': 'Soup' } },
      { version: 2, meals: { [key]: 42 } }, { version: 2, meals: { [key]: 'x'.repeat(301) } }]) {
      expect(() => adapter.parse(value)).toThrow();
    }
    for (const value of [{ version: 2, meals: {} }, { version: 1, meals: { 'nonday/breakfast': 'Toast' } },
      { version: 1, meals: { 'monday/breakfast': null } }]) {
      expect(() => mealDocument().parse(value)).toThrow();
    }
  });

  it('applies and removes one cell without replacing independent family edits', () => {
    const adapter = mealDocument(week);
    const document = adapter.parse({ version: 2, meals: { [key]: 'Toast', [`${week}/lunch`]: 'Soup' } });
    expect(adapter.apply(document, { key, previous: 'Toast', value: undefined }, false).meals)
      .toEqual({ [`${week}/lunch`]: 'Soup' });
    expect(adapter.apply(document, { key, previous: 'Toast', value: null }, false).meals[key]).toBeNull();
    expect(document.meals[key]).toBe('Toast');
  });

  it('rejects same-cell conflicts, accepts an already applied change and supports explicit resolution', () => {
    const adapter = mealDocument();
    const key = 'monday/breakfast';
    const remote = adapter.parse({ version: 1, meals: { [key]: 'Eggs' } });
    const edit = { key, previous: 'Toast', value: 'Porridge' };
    expect(() => adapter.apply(remote, edit, false)).toThrow(EditConflict);
    expect(adapter.apply(remote, { ...edit, value: 'Eggs' }, false)).toEqual(remote);
    expect(adapter.apply(remote, edit, true).meals[key]).toBe('Porridge');
  });
});
