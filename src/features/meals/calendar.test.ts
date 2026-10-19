import { describe, expect, it } from 'vitest';
import { dateKey, defaultMealKey, mealKey, monday, resolvedMeal, weekDays } from './calendar';

describe('meal calendar', () => {
  it('uses Monday for every day including Sunday', () => {
    for (let day = 19; day <= 25; day++) expect(dateKey(monday(new Date(2026, 9, day)))).toBe('2026-10-19');
    expect(dateKey(monday(new Date(2026, 9, 26)))).toBe('2026-10-26');
  });
  it('keeps local dates across year and daylight-saving boundaries', () => {
    expect(weekDays(monday(new Date(2027, 0, 1))).map(dateKey)).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
    ]);
    expect(weekDays(new Date(2026, 9, 19, 12)).map(date => date.getDate())).toEqual([19, 20, 21, 22, 23, 24, 25]);
    expect(mealKey(new Date(2026, 9, 25, 23, 59), 'Dinner')).toBe('2026-10-25/dinner');
  });
  it('uses recurring defaults only when the date has no override, including skips', () => {
    const date = new Date(2026, 9, 19);
    const key = mealKey(date, 'Breakfast');
    const defaults = { 'monday/breakfast': 'Porridge' };
    expect(defaultMealKey(date, 'Breakfast')).toBe('monday/breakfast');
    expect(resolvedMeal({}, defaults, date, 'Breakfast')).toEqual({ text: 'Porridge', recurring: true });
    expect(resolvedMeal({ [key]: 'Eggs' }, defaults, date, 'Breakfast')).toEqual({ text: 'Eggs', recurring: false });
    expect(resolvedMeal({ [key]: null }, defaults, date, 'Breakfast')).toEqual({ text: '', recurring: false });
    expect(resolvedMeal({}, defaults, new Date(2026, 9, 26), 'Breakfast').text).toBe('Porridge');
    expect(resolvedMeal({}, defaults, date, 'Lunch').text).toBe('');
    expect(defaultMealKey(new Date(2026, 9, 25), 'Dinner')).toBe('sunday/dinner');
  });
});
