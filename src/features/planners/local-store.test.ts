import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const callback = () => undefined as (() => void) | undefined;
function storage() {
  const transactions: ReturnType<typeof transaction>[] = [];
  const transaction = () => ({
    oncomplete: callback(), onabort: callback(), onerror: callback(), abort: vi.fn(),
    objectStore: vi.fn(() => ({ getAll: () => ({ result: [] }), put: vi.fn(), delete: vi.fn() })),
  });
  const db = { close: vi.fn(), onclose: callback(), onversionchange: callback(),
    transaction: vi.fn(() => { const next = transaction(); transactions.push(next); return next; }) };
  const requests: { result: typeof db; onsuccess: ReturnType<typeof callback>; onerror: ReturnType<typeof callback> }[] = [];
  vi.stubGlobal('indexedDB', { open: vi.fn(() => {
    const request = { result: db, onsuccess: callback(), onerror: callback() }; requests.push(request); return request;
  }) });
  return { db, requests, transactions };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.resetModules();
  vi.stubGlobal('document', { baseURI: 'https://example.test/' });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('times out a stalled open, closes its late result and permits another attempt', async () => {
  const fake = storage(); const { readLocal } = await import('./local-store');
  const failed = readLocal().catch(error => error);
  await vi.advanceTimersByTimeAsync(3000);
  expect(await failed).toMatchObject({ message: 'Planner storage did not respond.' });
  fake.requests[0]!.onsuccess?.();
  expect(fake.db.close).toHaveBeenCalledOnce();
  const recovered = readLocal(); fake.requests[1]!.onsuccess?.();
  await vi.advanceTimersByTimeAsync(0);
  fake.transactions[0]!.oncomplete?.();
  expect(await recovered).toEqual({ documents: [], edits: [] });
  expect(vi.getTimerCount()).toBe(0);
});

it('aborts a stalled write before retrying and never accepts its late completion', async () => {
  const fake = storage(); const { writeLocal } = await import('./local-store');
  const failed = writeLocal({ document: { id: 'shopping/list.json', value: {} } }).catch(error => error);
  fake.requests[0]!.onsuccess?.(); await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(3000);
  expect(await failed).toBeInstanceOf(Error);
  expect(fake.transactions[0]!.abort).toHaveBeenCalledOnce();
  expect(fake.db.close).toHaveBeenCalledOnce();
  fake.transactions[0]!.oncomplete?.();
  const next = writeLocal({ remove: ['saved-edit'] });
  fake.requests[1]!.onsuccess?.(); await vi.advanceTimersByTimeAsync(0);
  fake.transactions[1]!.oncomplete?.();
  await expect(next).resolves.toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});

it('does not acknowledge a write until the transaction commits', async () => {
  const fake = storage(); const { writeLocal } = await import('./local-store');
  let completed = false;
  const write = writeLocal({ remove: ['edit'] }).then(() => { completed = true; });
  fake.requests[0]!.onsuccess?.(); await vi.advanceTimersByTimeAsync(0);
  expect(completed).toBe(false);
  fake.transactions[0]!.oncomplete?.(); await write;
  expect(completed).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
