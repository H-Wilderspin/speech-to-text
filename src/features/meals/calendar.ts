export const mealSlots = ['Breakfast', 'Lunch', 'Dinner'] as const;
export type MealSlot = typeof mealSlots[number];
export type MealValue = string | null | undefined;
// A null override deliberately skips a recurring meal on this date.
export type MealPlan = Record<string, string | null>;
export const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// Calendar days use local noon: UTC conversion and 24-hour arithmetic can shift
// a date across timezone / daylight-saving boundaries.
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
}
export function monday(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}
export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}
export function mealKey(date: Date, slot: MealSlot): string {
  return `${dateKey(date)}/${slot.toLowerCase()}`;
}
export function defaultMealKey(date: Date, slot: MealSlot): string {
  return `${weekdayNames[date.getDay()]!.toLowerCase()}/${slot.toLowerCase()}`;
}
export function resolvedMeal(plan: MealPlan, defaults: MealPlan, date: Date, slot: MealSlot): { text: string; recurring: boolean } {
  const override = plan[mealKey(date, slot)];
  if (override !== undefined) return { text: override ?? '', recurring: false };
  const text = defaults[defaultMealKey(date, slot)] ?? '';
  return { text, recurring: Boolean(text) };
}
