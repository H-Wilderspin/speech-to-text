import { afterEach, describe, expect, it, vi } from 'vitest';
import { readRegularItems } from './github-shopping';
import { regularItems } from './regular-items';

const mock = () => { const fetcher = vi.fn<typeof fetch>(); vi.stubGlobal('fetch', fetcher); return fetcher; };
afterEach(() => vi.unstubAllGlobals());

describe('shared regular-items catalogue', () => {
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
});
