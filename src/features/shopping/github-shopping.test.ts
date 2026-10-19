import { afterEach, describe, expect, it, vi } from 'vitest';
import { readRegularItems, readShoppingList, saveShoppingList } from './github-shopping';
import { ShoppingConflict, type ShoppingList } from './items';
import { regularItems } from './regular-items';

const list: ShoppingList = [{ id: 'milk', text: 'Milk', checked: false }];
const file = (items = list, sha = 'a') => new Response(JSON.stringify({ sha, encoding: 'base64', content: Buffer.from(JSON.stringify({ version: 1, items })).toString('base64') }));
const mock = () => { const fetcher = vi.fn<typeof fetch>(); vi.stubGlobal('fetch', fetcher); return fetcher; };
const written = (fetcher: ReturnType<typeof mock>, index: number) => JSON.parse(Buffer.from(JSON.parse(fetcher.mock.calls[index]?.[1]?.body as string).content, 'base64').toString('utf8'));
afterEach(() => vi.unstubAllGlobals());

describe('shared shopping document', () => {
  it('loads a configured regular-items catalogue, trims labels and removes duplicates', async () => {
    const fetcher = mock().mockResolvedValueOnce(new Response(JSON.stringify({ version: 1, items: [' Milk ', 'Bread', 'milk'] })));
    expect(await readRegularItems()).toEqual(['Milk', 'Bread']);
    expect(fetcher.mock.calls[0]?.[0]).toContain('/shopping/regular-items.json?updated=');
  });
  it('allows a missing catalogue and rejects malformed regular items', async () => {
    const fetcher = mock().mockResolvedValueOnce(new Response('', { status: 404 }));
    expect(await readRegularItems()).toEqual(regularItems);
    for (const value of [null, { version: 2, items: [] }, { version: 1, items: [''] }, { version: 1, items: [42] }]) {
      fetcher.mockResolvedValueOnce(new Response(JSON.stringify(value)));
      await expect(readRegularItems()).rejects.toThrow('unsupported');
    }
  });
  it('reads public missing lists without credentials or caching', async () => {
    const fetcher = mock().mockResolvedValueOnce(new Response('', { status: 404 }));
    expect(await readShoppingList()).toEqual([]);
    expect(fetcher.mock.calls[0]?.[0]).toContain('/shopping/list.json?updated=');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
    expect(fetcher.mock.calls[0]?.[1]?.headers).toBeUndefined();
  });
  it('creates the file on first add with Unicode text', async () => {
    const fetcher = mock().mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(new Response('{}', { status: 201 }));
    await saveShoppingList([], [{ id: 'cafe', text: 'Café', checked: false }], 'test-token');
    expect(fetcher.mock.calls[1]?.[0]).toMatch(/\/contents\/shopping\/list.json$/);
    expect(written(fetcher, 1)).toEqual({ version: 1, items: [{ id: 'cafe', text: 'Café', checked: false }] });
  });
  it('retries a conflicting SHA and merges independent edits while ticking', async () => {
    const fetcher = mock().mockResolvedValueOnce(file()).mockResolvedValueOnce(new Response('', { status: 409 }))
      .mockResolvedValueOnce(file([{ ...list[0]!, text: 'Oat milk' }, { id: 'bread', text: 'Bread', checked: false }], 'b'))
      .mockResolvedValueOnce(new Response('{}'));
    const result = await saveShoppingList(list, [{ ...list[0]!, checked: true }], 'test-token');
    expect(result).toEqual([{ id: 'milk', text: 'Oat milk', checked: true }, { id: 'bread', text: 'Bread', checked: false }]);
    expect(JSON.parse(fetcher.mock.calls[3]?.[1]?.body as string).sha).toBe('b');
  });
  it('returns latest data on stale text/order conflicts without writing', async () => {
    const fetcher = mock().mockResolvedValueOnce(file());
    await expect(saveShoppingList([{ ...list[0]!, text: 'Old' }], [{ ...list[0]!, text: 'New' }], 'test-token')).rejects.toBeInstanceOf(ShoppingConflict);
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce(file());
    const bread = { id: 'bread', text: 'Bread', checked: false };
    await expect(saveShoppingList([...list, bread], [bread, ...list], 'test-token')).rejects.toBeInstanceOf(ShoppingConflict);
  });
  it('avoids duplicate writes for a repeated add', async () => {
    const fetcher = mock().mockResolvedValueOnce(file());
    expect(await saveShoppingList([], [{ id: 'another-milk', text: 'Milk', checked: false }], 'test-token')).toEqual(list);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed data and failed writes; limits conflicts and requires access', async () => {
    const fetcher = mock().mockResolvedValueOnce(new Response(JSON.stringify({ version: 9, items: [] })));
    await expect(readShoppingList()).rejects.toThrow('unsupported');
    const local = [...list, { id: 'a', text: 'Tea', checked: false }];
    await expect(saveShoppingList(list, local, '')).rejects.toThrow('Connect GitHub');
    fetcher.mockResolvedValueOnce(file()).mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(saveShoppingList(list, local, 'test-token')).rejects.toThrow('did not save');
    for (let i = 0; i < 3; i++) fetcher.mockResolvedValueOnce(file()).mockResolvedValueOnce(new Response('', { status: 422 }));
    await expect(saveShoppingList(list, local, 'test-token')).rejects.toThrow('busy');
  });
  it('saves several local changes in one write and tolerates an already-saved batch', async () => {
    const local = [{ id: 'eggs', text: 'Eggs', checked: false }, { ...list[0]!, text: 'Whole milk', checked: true }];
    const fetcher = mock().mockResolvedValueOnce(file()).mockResolvedValueOnce(new Response('{}'));
    expect(await saveShoppingList(list, local, 'test-token')).toEqual(local);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(written(fetcher, 1).items).toEqual(local);
    fetcher.mockResolvedValueOnce(file(local));
    expect(await saveShoppingList(list, local, 'test-token')).toEqual(local);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
