import { parseShoppingList, type ShoppingItem } from '../shopping/items';
import { dateKey, monday, type MealValue } from '../meals/calendar';

export type ShoppingDraft = { edit: { id: string; previous?: ShoppingItem }; text: string };
export type MealDraft = { edit: { key: string; defaultKey: string; label: string; repeatLabel: string;
  previous: MealValue; defaultPrevious: MealValue; text: string }; scope: 'date' | 'default'; text: string };
type Draft = ShoppingDraft | MealDraft;
type Source = { storageKey: string; revision: string };
type Record = { version: 1; key: string; value: Draft; revision: string; updated: number; sources?: Source[] };
const text = (value: unknown) => typeof value === 'string' && value.length <= 300;
const mealValue = (value: unknown) => value === undefined || value === null || text(value);

function valid(key: string, value: Draft): boolean {
  if (!value || !text(value.text) || !value.edit) return false;
  if (key === 'shopping') {
    const { edit } = value as ShoppingDraft;
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(edit.id)) return false;
    try {
      if (edit.previous) parseShoppingList({ version: 1, items: [edit.previous] });
      return !edit.previous || edit.previous.id === edit.id;
    } catch { return false; }
  }
  const draft = value as MealDraft;
  const match = /^(\d{4}-\d{2}-\d{2})\/(breakfast|lunch|dinner)$/.exec(draft.edit.key);
  const day = match && new Date(`${match[1]}T12:00:00`);
  return !!day && Number.isFinite(day.getTime()) && dateKey(monday(day)) === key
    && /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\/(breakfast|lunch|dinner)$/.test(draft.edit.defaultKey)
    && ['date', 'default'].includes(draft.scope) && text(draft.edit.label) && text(draft.edit.repeatLabel)
    && text(draft.edit.text) && mealValue(draft.edit.previous) && mealValue(draft.edit.defaultPrevious);
}

// Separate tab slots prevent two open editors from replacing each other's drafts.
// A new tab can recover the most recent draft; Save/Cancel only clears the exact
// recovered revision, never a newer draft written by another tab.
export class PlannerDrafts {
  private prefix = `speech-to-text-draft:${new URL(import.meta.env.BASE_URL, document.baseURI).pathname}:`;
  private tab: string | undefined;
  private values = new Map<string, Draft>();
  private recovered = new Map<string, Source[]>();
  private read = new Set<string>();
  private failed = new Set<string>();
  private tabId() {
    if (!this.tab) {
      this.tab = crypto.randomUUID();
      try {
        const key = `${this.prefix}tab`;
        this.tab = sessionStorage.getItem(key) || this.tab;
        sessionStorage.setItem(key, this.tab);
      } catch { /* A random slot still allows recovery when session storage is unavailable. */ }
    }
    return this.tab;
  }
  get durable() { return this.failed.size === 0; }
  get count() { return this.values.size; }
  private records(): { storageKey: string; record: Record }[] {
    const records: { storageKey: string; record: Record }[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i)!;
        if (!storageKey.startsWith(this.prefix)) continue;
        try {
          const record = JSON.parse(localStorage.getItem(storageKey)!) as Record;
          if (record.version === 1 && typeof record.revision === 'string' && Number.isFinite(record.updated)
            && valid(record.key, record.value)) records.push({ storageKey, record });
        } catch { /* Ignore malformed or older drafts. */ }
      }
    } catch { /* Keep editing in memory if storage is blocked. */ }
    return records.sort((a, b) => b.record.updated - a.record.updated);
  }
  latestMealWeek(): string | undefined {
    return this.records().find(({ record }) => record.key !== 'shopping')?.record.key;
  }
  get<T>(key: string): T | null {
    if (!this.read.has(key)) {
      this.read.add(key);
      const records = this.records().filter(value => value.record.key === key);
      const found = records.find(value => value.storageKey === this.storageKey(key)) ?? records[0];
      if (found) {
        this.values.set(key, found.record.value);
        const sources = Array.isArray(found.record.sources) ? found.record.sources.filter(source =>
          typeof source?.storageKey === 'string' && source.storageKey.startsWith(this.prefix) && typeof source.revision === 'string') : [];
        this.recovered.set(key, [...sources, { storageKey: found.storageKey, revision: found.record.revision }]
          .filter(source => source.storageKey !== this.storageKey(key)));
      }
    }
    return this.values.get(key) as T ?? null;
  }
  private storageKey(key: string) { return `${this.prefix}${this.tabId()}:${key}`; }
  set(key: string, value: unknown) {
    if (value !== null && !valid(key, value as Draft)) return;
    if (value === null && !this.values.has(key) && !this.recovered.has(key) && !this.failed.has(key)) return;
    this.read.add(key);
    if (value === null) this.values.delete(key); else this.values.set(key, value as Draft);
    try {
      if (value === null) {
        localStorage.removeItem(this.storageKey(key));
        for (const recovered of this.recovered.get(key) ?? []) {
          const current = JSON.parse(localStorage.getItem(recovered.storageKey) ?? 'null');
          if (current?.revision === recovered.revision) localStorage.removeItem(recovered.storageKey);
        }
        this.recovered.delete(key);
      } else {
        localStorage.setItem(this.storageKey(key), JSON.stringify({ version: 1, key, value: value as Draft, sources: this.recovered.get(key),
          revision: crypto.randomUUID(), updated: Date.now() } satisfies Record));
      }
      this.failed.delete(key);
    } catch { this.failed.add(key); }
  }
}
