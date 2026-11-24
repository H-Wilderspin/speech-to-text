import { mealKey, mealSlots, weekdayNames, weekDays, type MealPlan, type MealValue } from './calendar';
import { EditConflict, type DocumentAdapter } from '../planners/sync-document';

export type MealDocument = { version: 1 | 2; meals: MealPlan };
export type MealEdit = { key: string; previous: MealValue; value: MealValue };
export function mealDocument(week?: string): DocumentAdapter<MealDocument, MealEdit> {
  const version = week ? 2 : 1;
  const keys = new Set(week ? weekDays(new Date(`${week}T12:00:00`)).flatMap(date => mealSlots.map(slot => mealKey(date, slot)))
    : weekdayNames.flatMap(day => mealSlots.map(slot => `${day.toLowerCase()}/${slot.toLowerCase()}`)));
  const validate = (key: string, value: unknown) => {
    if (!keys.has(key) || !(value === undefined || (week && value === null) || (typeof value === 'string' && value.length <= 300))) {
      throw new Error('The saved plan contains an invalid meal. No changes were made.');
    }
  };
  return {
    empty: { version, meals: {} },
    parse(value) {
      const data = value as MealDocument;
      if (!data || !(data.version === 1 || (week && data.version === 2)) || !data.meals || typeof data.meals !== 'object' || Array.isArray(data.meals)) {
        throw new Error('The saved plan has an unsupported format. No changes were made.');
      }
      for (const [key, meal] of Object.entries(data.meals)) validate(key, meal);
      return { version, meals: data.meals };
    },
    key: edit => edit.key,
    message: week ? `Update meals: ${week}` : 'Update weekly meal defaults',
    apply(document, edit, force) {
      validate(edit.key, edit.value);
      if (!force && document.meals[edit.key] !== edit.previous && document.meals[edit.key] !== edit.value) throw new EditConflict();
      const meals = { ...document.meals };
      if (edit.value === undefined) delete meals[edit.key]; else meals[edit.key] = edit.value;
      return { version, meals };
    },
    resolve: (remote, local, key) => [{ key, previous: remote.meals[key], value: local.meals[key] }],
  };
}
