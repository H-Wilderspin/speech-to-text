import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlannerDrafts, type ShoppingDraft } from './drafts';

function storage() {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
}
const draft: ShoppingDraft = { edit: { id: 'milk', previous: { id: 'milk', text: 'Milk', checked: true } }, text: 'Milk 2 bottles' };
beforeEach(() => {
  vi.stubEnv('BASE_URL', './');
  vi.stubGlobal('document', { baseURI: 'https://example.test/speech-to-text/' });
  vi.stubGlobal('localStorage', storage()); vi.stubGlobal('sessionStorage', storage());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('recovers a draft and its original edit base after reload, then clears it on Save or Cancel', () => {
  new PlannerDrafts().set('shopping', draft);
  const reloaded = new PlannerDrafts();
  expect(reloaded.get('shopping')).toEqual(draft);
  reloaded.set('shopping', null);
  expect(new PlannerDrafts().get('shopping')).toBeNull();
});

it('recovers in a newly opened tab without deleting a newer draft from another tab', () => {
  const first = new PlannerDrafts(); first.set('shopping', draft);
  vi.stubGlobal('sessionStorage', storage());
  const second = new PlannerDrafts();
  expect(second.get('shopping')).toEqual(draft);
  second.set('shopping', { ...draft, text: 'Milk and cream' });
  first.set('shopping', { ...draft, text: 'Newer first-tab wording' });
  second.set('shopping', null);
  vi.stubGlobal('sessionStorage', storage());
  expect(new PlannerDrafts().get<ShoppingDraft>('shopping')?.text).toBe('Newer first-tab wording');
});

it('clears the unchanged recovered copy when finishing a draft in a new tab', () => {
  new PlannerDrafts().set('shopping', draft);
  vi.stubGlobal('sessionStorage', storage());
  const second = new PlannerDrafts(); second.get('shopping');
  second.set('shopping', { ...draft, text: 'Updated' });
  const reloaded = new PlannerDrafts(); reloaded.get('shopping'); reloaded.set('shopping', null);
  expect(new PlannerDrafts().get('shopping')).toBeNull();
});

it('does not read sibling app drafts or accept malformed records', () => {
  new PlannerDrafts().set('shopping', draft);
  vi.stubGlobal('document', { baseURI: 'https://example.test/other/' });
  const other = new PlannerDrafts();
  expect(other.get('shopping')).toBeNull();
  other.set('shopping', { text: 'invalid', edit: { id: 'bad/id' } });
  expect(other.count).toBe(0);
});

it('keeps drafts in memory and reports failed storage without warning for an empty editor', () => {
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  const drafts = new PlannerDrafts();
  drafts.set('shopping', null); expect(drafts.durable).toBe(true);
  drafts.set('shopping', draft);
  expect(drafts.get('shopping')).toEqual(draft); expect(drafts.durable).toBe(false);
  drafts.set('shopping', null); expect(drafts.durable).toBe(true);
});

it('remembers the week and scope of a meal draft without submitting it', () => {
  const value = { edit: { key: '2026-10-26/breakfast', defaultKey: 'monday/breakfast', label: 'Monday breakfast',
    repeatLabel: 'Every Monday breakfast', previous: undefined, defaultPrevious: 'Toast', text: 'Toast' }, scope: 'default', text: 'Porridge' };
  new PlannerDrafts().set('2026-10-26', value);
  const reloaded = new PlannerDrafts();
  expect(reloaded.latestMealWeek()).toBe('2026-10-26');
  expect(reloaded.get('2026-10-26')).toEqual(value);
});
