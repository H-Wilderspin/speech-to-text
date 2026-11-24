import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncDocument } from './sync-document';
import { mealDocument, type MealDocument } from '../meals/meal-document';
import { shoppingDocument, type ShoppingDocument, type ShoppingEdit } from '../shopping/shopping-document';
import { readJsonFile, writeJsonFile } from './github';
import { writeLocal } from './local-store';
import { SyncPausedError } from './family-service';

vi.mock('./github', () => ({ GitHubAccessError: class extends Error {}, readJsonFile: vi.fn(), writeJsonFile: vi.fn() }));
vi.mock('./local-store', () => ({ writeLocal: vi.fn(async () => undefined) }));
const key = '2026-10-19/breakfast';
const documents: { dispose: () => void }[] = [];
function meal(remote: MealDocument) {
  vi.mocked(readJsonFile).mockImplementation(async () => ({ value: structuredClone(remote), sha: 'revision' }));
  vi.mocked(writeJsonFile).mockImplementation(async (_path, next) => { Object.assign(remote, structuredClone(next)); return new Response('', { status: 200 }); });
  const store = new SyncDocument('weeks/2026-10-19.json', mealDocument('2026-10-19'), () => undefined, () => undefined);
  store.configure('test-token'); store.restore(remote, []); documents.push(store);
  return store;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', { hidden: false });
});
afterEach(() => { for (const store of documents.splice(0)) store.dispose(); vi.unstubAllGlobals(); });

describe('local document queue', () => {
  it('acknowledges only the submitted edits while another edit is made during the write', async () => {
    const remote: MealDocument = { version: 2, meals: { [key]: 'Toast' } };
    const store = meal(remote);
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let started!: () => void;
    const writing = new Promise<void>(resolve => { started = resolve; });
    vi.mocked(writeJsonFile).mockImplementationOnce(async (_path, next) => {
      started(); await held; Object.assign(remote, structuredClone(next)); return new Response('', { status: 200 });
    });
    store.change({ key, previous: 'Toast', value: 'Eggs' });
    const first = store.flush(); await writing;
    store.change({ key, previous: 'Eggs', value: 'Porridge' });
    expect(store.getSnapshot().value.meals[key]).toBe('Porridge');
    release(); await first;
    expect(remote.meals[key]).toBe('Eggs');
    expect(store.getSnapshot().value.meals[key]).toBe('Porridge');
    expect(store.getSnapshot().pending).toBe(1);
    await store.flush();
    expect(remote.meals[key]).toBe('Porridge');
    expect(store.getSnapshot().pending).toBe(0);
  });

  it('keeps a conflicting meal local but saves unrelated meals, then resolves only that cell', async () => {
    const lunch = '2026-10-19/lunch';
    const remote: MealDocument = { version: 2, meals: { [key]: 'Toast' } };
    const store = meal(remote);
    store.change({ key, previous: 'Toast', value: 'Eggs' });
    store.change({ key: lunch, previous: undefined, value: 'Soup' });
    remote.meals[key] = 'Porridge';
    await store.flush();
    expect(remote.meals).toEqual({ [key]: 'Porridge', [lunch]: 'Soup' });
    expect(store.getSnapshot().value.meals[key]).toBe('Eggs');
    expect(store.getSnapshot().conflicts.map(value => value.key)).toEqual([key]);
    store.resolve(key, true);
    await store.flush();
    expect(remote.meals).toEqual({ [key]: 'Eggs', [lunch]: 'Soup' });
  });

  it('refresh merges untouched family cells without replacing a local edit', async () => {
    const remote: MealDocument = { version: 2, meals: { [key]: 'Toast' } };
    const store = meal(remote);
    store.change({ key, previous: 'Toast', value: 'Eggs' });
    remote.meals['2026-10-19/dinner'] = 'Pasta';
    await store.refresh();
    expect(store.getSnapshot().value.meals).toEqual({ [key]: 'Eggs', '2026-10-19/dinner': 'Pasta' });
  });

  it('persists before allowing navigation and keeps unsaved changes when storage and network both fail', async () => {
    const store = meal({ version: 2, meals: {} });
    vi.mocked(writeLocal).mockRejectedValueOnce(new Error('Quota'));
    vi.mocked(readJsonFile).mockRejectedValueOnce(new Error('Offline'));
    store.change({ key, previous: undefined, value: 'Toast' });
    expect(await store.safeToLeave()).toBe(false);
    expect(store.getSnapshot().durable).toBe(false);
    expect(store.getSnapshot().value.meals[key]).toBe('Toast');
  });

  it('does not resurrect an acknowledged edit from a stale tab snapshot', async () => {
    const remote: MealDocument = { version: 2, meals: { [key]: 'Toast' } };
    const store = meal(remote);
    const old = { id: 'old-edit', document: store.path, time: 1, change: { key, previous: 'Toast', value: 'Eggs' } };
    store.restore(remote, [old]);
    await store.flush();
    store.restore({ version: 2, meals: { [key]: 'Toast' } }, [old], true);
    expect(store.getSnapshot().pending).toBe(0);
    expect(store.getSnapshot().value.meals[key]).toBe('Eggs');
  });

  it('retains a move of an item added in the same unsaved batch', async () => {
    let remote: ShoppingDocument = { version: 1, items: [] };
    vi.mocked(readJsonFile).mockImplementation(async () => ({ value: remote, sha: 'revision' }));
    vi.mocked(writeJsonFile).mockImplementation(async (_path, next) => {
      remote = next as ShoppingDocument; return new Response('', { status: 200 });
    });
    const store = new SyncDocument('shopping/list.json', shoppingDocument, () => undefined, () => undefined);
    store.configure('test-token'); store.restore(remote, []); documents.push(store);
    for (const id of ['milk', 'bread', 'eggs']) store.change({ type: 'put', id, item: { id, text: id, checked: false } });
    store.change({ type: 'move', id: 'eggs', previousOrder: ['milk', 'bread', 'eggs'], order: ['eggs', 'milk', 'bread'] });
    expect(store.getSnapshot().value.items.map(item => item.id)).toEqual(['eggs', 'milk', 'bread']);
    await store.flush();
    expect(remote.items.map(item => item.id)).toEqual(['eggs', 'milk', 'bread']);
  });

  it('rereads and merges after a conditional-write race', async () => {
    const remote: MealDocument = { version: 2, meals: { [key]: 'Toast' } };
    const store = meal(remote);
    vi.mocked(writeJsonFile).mockImplementationOnce(async () => {
      remote.meals['2026-10-19/lunch'] = 'Soup';
      return new Response('', { status: 409 });
    });
    store.change({ key, previous: 'Toast', value: 'Eggs' });
    expect(await store.flush()).toBe(true);
    expect(remote.meals).toEqual({ [key]: 'Eggs', '2026-10-19/lunch': 'Soup' });
    expect(writeJsonFile).toHaveBeenCalledTimes(2);
  });

  it('recognises an already committed sequence after losing the response', async () => {
    const remote: MealDocument = { version: 2, meals: { [key]: 'Toast' } };
    const store = meal(remote);
    store.change({ key, previous: 'Toast', value: 'Eggs' });
    store.change({ key, previous: 'Eggs', value: 'Porridge' });
    remote.meals[key] = 'Porridge';
    await store.flush();
    expect(writeJsonFile).not.toHaveBeenCalled();
    expect(store.getSnapshot().pending).toBe(0);
    expect(store.getSnapshot().conflicts).toHaveLength(0);
  });

  it('publishes completed save status after a drag ends', async () => {
    const store = meal({ version: 2, meals: {} });
    let release!: () => void;
    let start!: () => void;
    const started = new Promise<void>(resolve => { start = resolve; });
    vi.mocked(writeJsonFile).mockImplementationOnce(async () => {
      start(); await new Promise<void>(resolve => { release = resolve; });
      return new Response('', { status: 200 });
    });
    store.change({ key, previous: undefined, value: 'Toast' });
    const saving = store.flush(); await started;
    store.hold(true); release(); await saving;
    store.hold(false);
    expect(store.getSnapshot().saving).toBe(false);
    expect(store.getSnapshot().pending).toBe(0);
  });

  it('replays a persisted edit after reopening and avoids repeating a commit whose response was lost', async () => {
    const remote: MealDocument = { version: 2, meals: { [key]: 'Toast' } };
    const store = meal(remote);
    store.restore({ version: 2, meals: {} }, [{ id: 'pending', time: 1, document: store.path, change: { key, value: 'Toast' } }]);
    await store.flush();
    expect(writeJsonFile).not.toHaveBeenCalled();
    expect(store.getSnapshot().pending).toBe(0);
  });
});

it('retains local edits through a service pause and saves them after the retry window', async () => {
  vi.useFakeTimers();
  try {
    const remote: MealDocument = { version: 2, meals: {} };
    const store = meal(remote);
    store.change({ key, previous: undefined, value: 'Soup' });
    vi.mocked(readJsonFile).mockRejectedValueOnce(new SyncPausedError('Family syncing is resting.', Date.now() + 3600000));
    expect(await store.flush()).toBe(false);
    expect(store.getSnapshot()).toMatchObject({ pending: 1, durable: true, value: { meals: { [key]: 'Soup' } } });
    await store.navigate();
    store.wake(); // Focus/online must not shorten a server-requested pause.
    expect(readJsonFile).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3599000);
    expect(writeJsonFile).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.getSnapshot().pending).toBe(0);
    expect(remote.meals[key]).toBe('Soup');
  } finally { vi.useRealTimers(); }
});

it('reschedules a pending save when a refresh discovers a service pause first', async () => {
  vi.useFakeTimers();
  try {
    const remote: MealDocument = { version: 2, meals: {} };
    const store = meal(remote);
    store.change({ key, previous: undefined, value: 'Toast' });
    vi.mocked(readJsonFile).mockRejectedValueOnce(new SyncPausedError('Resting', Date.now() + 3600000));
    await store.refresh();
    await vi.advanceTimersByTimeAsync(3000);
    expect(readJsonFile).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3600000);
    expect(store.getSnapshot().pending).toBe(0);
    expect(remote.meals[key]).toBe('Toast');
  } finally { vi.useRealTimers(); }
});

describe('shopping operation merging', () => {
  const milk = { id: 'milk', text: 'Milk', checked: false };
  const bread = { id: 'bread', text: 'Bread', checked: false };
  it('restores the position and bought state without replacing newer family rows or duplicating names', () => {
    const restore: ShoppingEdit = { type: 'restore', id: 'milk', item: { ...milk, checked: true }, order: ['milk', 'bread'] };
    expect(shoppingDocument.apply({ version: 1, items: [bread] }, restore, false).items).toEqual([{ ...milk, checked: true }, bread]);
    for (const current of [{ ...milk, text: 'Family milk' }, { ...milk, id: 'family-milk' }]) {
      expect(shoppingDocument.apply({ version: 1, items: [current, bread] }, restore, false).items).toEqual([current, bread]);
    }
  });
  it('undoes a queued deletion without a GitHub write, even when the family has edited that row', async () => {
    const store = new SyncDocument('shopping/list.json', shoppingDocument, () => undefined, () => undefined);
    store.configure('test-token'); store.restore({ version: 1, items: [milk, bread] }, []); documents.push(store);
    const remove: ShoppingEdit = { type: 'remove', id: milk.id, previous: milk };
    store.change(remove);
    vi.mocked(readJsonFile).mockResolvedValue({ value: { version: 1, items: [{ ...milk, text: 'Family milk' }, bread] } });
    await store.refresh();
    expect(store.getSnapshot().conflicts).toHaveLength(1);
    expect(store.undoChange(remove, { type: 'restore', id: milk.id, item: milk, order: ['milk', 'bread'] })).toBe(true);
    await store.safeToLeave();
    expect(store.getSnapshot().value.items[0]?.text).toBe('Family milk');
    expect(store.getSnapshot().conflicts).toHaveLength(0);
    expect(writeJsonFile).not.toHaveBeenCalled();
  });
  it('undoes while a deletion is being written without losing a newer family edit', async () => {
    let remote: ShoppingDocument = { version: 1, items: [milk, bread] };
    vi.mocked(readJsonFile).mockImplementation(async () => ({ value: structuredClone(remote), sha: 'revision' }));
    let started!: () => void, release!: () => void;
    const writing = new Promise<void>(resolve => { started = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(writeJsonFile).mockImplementation(async (_path, next) => {
      started(); await held; remote = structuredClone(next) as ShoppingDocument; return new Response('', { status: 200 });
    });
    const store = new SyncDocument('shopping/list.json', shoppingDocument, () => undefined, () => undefined);
    store.configure('test-token'); store.restore(remote, []); documents.push(store);
    const remove: ShoppingEdit = { type: 'remove', id: milk.id, previous: milk };
    store.change(remove); const saving = store.flush(); await writing;
    store.undoChange(remove, { type: 'restore', id: milk.id, item: milk, order: ['milk', 'bread'] });
    expect(store.getSnapshot().value.items).toEqual([milk, bread]);
    release(); await saving;
    expect(store.getSnapshot().value.items).toEqual([milk, bread]);
    remote.items.unshift({ ...milk, text: 'Family milk', checked: true });
    await store.flush();
    expect(remote.items).toEqual([{ ...milk, text: 'Family milk', checked: true }, bread]);
    expect(store.getSnapshot().pending).toBe(0);
  });
  it('merges a rename with another person ticking the same item', () => {
    const remote: ShoppingDocument = { version: 1, items: [{ ...milk, checked: true }] };
    expect(shoppingDocument.apply(remote, { type: 'put', id: milk.id, previous: milk, item: { ...milk, text: 'Milk 2 bottles' } }, false).items)
      .toEqual([{ ...milk, text: 'Milk 2 bottles', checked: true }]);
  });
  it('detects different names and deletion-versus-edit without overwriting', () => {
    const remote: ShoppingDocument = { version: 1, items: [{ ...milk, text: 'Milk 3 bottles' }] };
    expect(() => shoppingDocument.apply(remote, { type: 'put', id: milk.id, previous: milk, item: { ...milk, text: 'Milk 2 bottles' } }, false)).toThrow();
    expect(() => shoppingDocument.apply(remote, { type: 'remove', id: milk.id, previous: milk }, false)).toThrow();
  });
  it('keeps a concurrent addition when moving an existing row', () => {
    const eggs = { id: 'eggs', text: 'Eggs', checked: false };
    const result = shoppingDocument.apply({ version: 1, items: [milk, eggs, bread] },
      { type: 'move', id: 'bread', previousOrder: ['milk', 'bread'], order: ['bread', 'milk'] }, false);
    expect(result.items.map(item => item.id)).toEqual(['bread', 'milk', 'eggs']);
  });
});
