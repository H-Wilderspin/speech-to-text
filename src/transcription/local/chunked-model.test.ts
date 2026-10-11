import { expect, it, vi } from 'vitest';
import { assembleModel } from './chunked-model';

const parts = [{ name: 'first', bytes: 2, hash: 'verified by loader' }, { name: 'last', bytes: 1, hash: 'verified by loader' }];
it('joins independently verified parts in manifest order', async () => {
  const read = vi.fn(async (part: (typeof parts)[number]) => new Uint8Array(part.name === 'first' ? [10, 20] : [30]));
  const bytes = await assembleModel({ bytes: 3, parts }, read, new AbortController().signal);
  expect([...bytes]).toEqual([10, 20, 30]); expect(read.mock.calls.map(([part]) => part.name)).toEqual(['first', 'last']);
});
it('rejects incomplete or inconsistent parts instead of passing damaged weights to inference', async () => {
  const read = vi.fn(async () => new Uint8Array([10])); const signal = new AbortController().signal;
  await expect(assembleModel({ bytes: 3, parts }, read, signal)).rejects.toThrow('incomplete');
  read.mockClear();
  for (const manifest of [{ bytes: 4, parts }, { bytes: 0, parts: [] }, { bytes: 300 * 1024 * 1024, parts }]) {
    await expect(assembleModel(manifest, read, signal)).rejects.toThrow('manifest');
  }
  expect(read).not.toHaveBeenCalled();
});
it('cancels between parts without starting another download', async () => {
  const controller = new AbortController();
  const read = vi.fn(async () => { controller.abort(); return new Uint8Array([10, 20]); });
  await expect(assembleModel({ bytes: 3, parts }, read, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(read).toHaveBeenCalledOnce();
});
