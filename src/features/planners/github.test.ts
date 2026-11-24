import { afterEach, expect, it, vi } from 'vitest';
import { checkEditor, GitHubAccessError, readJsonFile, writeJsonFile } from './github';

afterEach(() => vi.unstubAllGlobals());

it('reads public data without credentials or caching and allows absent files', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{"version":1,"meals":{}}'))
    .mockResolvedValueOnce(new Response('', { status: 404 }));
  vi.stubGlobal('fetch', fetcher);
  expect(await readJsonFile('defaults.json')).toEqual({ value: { version: 1, meals: {} } });
  expect(fetcher.mock.calls[0]?.[0]).toMatch(/\/main\/defaults.json\?updated=/);
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store', redirect: 'error' });
  expect(fetcher.mock.calls[0]?.[1]?.headers).toBeUndefined();
  expect(await readJsonFile('weeks/2026-10-19.json')).toEqual({});
});

it('reads authenticated Unicode content and writes using the latest SHA', async () => {
  const value = { version: 1, items: [{ id: 'cafe', text: 'Café', checked: false }] };
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({
    sha: 'latest', encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64'),
  }))).mockResolvedValueOnce(new Response('{}'));
  vi.stubGlobal('fetch', fetcher);
  expect(await readJsonFile('shopping/list.json', 'test-token')).toEqual({ value, sha: 'latest' });
  expect(fetcher.mock.calls[0]?.[0]).toMatch(/\/contents\/shopping\/list.json\?ref=main$/);
  await writeJsonFile('shopping/list.json', value, 'latest', 'test-token', 'Update shopping list');
  const write = fetcher.mock.calls[1]?.[1];
  expect(write?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
  const body = JSON.parse(write?.body as string);
  expect(body).toMatchObject({ sha: 'latest', branch: 'main' });
  expect(JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'))).toEqual(value);
});

it('creates new files without a SHA and requires editing access', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 201 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(writeJsonFile('defaults.json', {}, undefined, '', 'Create defaults')).rejects.toThrow('Connect GitHub');
  expect(fetcher).not.toHaveBeenCalled();
  await writeJsonFile('defaults.json', {}, undefined, 'test-token', 'Create defaults');
  expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string).sha).toBeUndefined();
});

it('reports unreadable files, server failures, missing write access and offline reads', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{"encoding":"utf8"}'))
    .mockResolvedValueOnce(new Response('', { status: 500 }))
    .mockResolvedValueOnce(new Response('{"permissions":{"push":false}}'))
    .mockRejectedValueOnce(new TypeError('offline'));
  vi.stubGlobal('fetch', fetcher);
  await expect(readJsonFile('defaults.json', 'test-token')).rejects.toThrow('Could not read');
  await expect(readJsonFile('defaults.json')).rejects.toThrow('Could not load');
  await expect(checkEditor('read-only')).rejects.toThrow('write access');
  await expect(readJsonFile('defaults.json')).rejects.toThrow('Check your connection');
});

it.each([401, 403])('identifies rejected access (%s) for token replacement', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
  await expect(checkEditor('test-token')).rejects.toBeInstanceOf(GitHubAccessError);
});

it.each([
  new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
  new Response('{}', { status: 403, headers: { 'retry-after': '60' } }),
  new Response('{"message":"You have exceeded a secondary rate limit."}', { status: 403 }),
  new Response('{}', { status: 429 }),
])('does not request a new token for rate limits', async response => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  await expect(checkEditor('test-token')).rejects.not.toBeInstanceOf(GitHubAccessError);
});
