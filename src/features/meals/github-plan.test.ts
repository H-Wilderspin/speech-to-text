import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkEditor, PlanConflict, readDefaults, readPlan, saveDefault, saveMeal } from './github-plan';

const week = '2026-10-19';
const key = `${week}/breakfast`;
const file = (meals: Record<string, string | null>, sha = 'a', version = 1) => new Response(JSON.stringify({
  sha, encoding: 'base64', content: Buffer.from(JSON.stringify({ version, meals })).toString('base64'),
}));
const mock = () => { const fetcher = vi.fn<typeof fetch>(); vi.stubGlobal('fetch', fetcher); return fetcher; };
afterEach(() => vi.unstubAllGlobals());

describe('shared GitHub meals', () => {
  it('reads optional weekly defaults and rejects invalid recurrence keys or null defaults', async () => {
    const fetcher = mock().mockResolvedValueOnce(new Response('', { status: 404 }));
    expect(await readDefaults()).toEqual({});
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ version: 1, meals: { 'monday/breakfast': 'Porridge' } })));
    expect(await readDefaults()).toEqual({ 'monday/breakfast': 'Porridge' });
    expect(fetcher.mock.calls[1]?.[0]).toContain('/main/defaults.json?updated=');
    expect(fetcher.mock.calls[1]?.[1]?.headers).toBeUndefined();
    for (const meals of [{ 'nonday/breakfast': 'Toast' }, { 'monday/breakfast': null }]) {
      fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ version: 1, meals })));
      await expect(readDefaults()).rejects.toThrow('invalid meal');
    }
  });
  it('creates defaults separately and merges edits to other recurring slots', async () => {
    const recurring = 'monday/breakfast';
    const fetcher = mock().mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(new Response('{}', { status: 201 }));
    expect(await saveDefault(recurring, undefined, 'Porridge', 'test-token')).toEqual({ [recurring]: 'Porridge' });
    expect(fetcher.mock.calls[1]?.[0]).toMatch(/\/contents\/defaults.json$/);
    const body = JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string);
    expect(JSON.parse(Buffer.from(body.content, 'base64').toString())).toEqual({ version: 1, meals: { [recurring]: 'Porridge' } });
    fetcher.mockResolvedValueOnce(file({ [recurring]: 'Porridge' }))
      .mockResolvedValueOnce(new Response('', { status: 409 }))
      .mockResolvedValueOnce(file({ [recurring]: 'Porridge', 'tuesday/lunch': 'Soup' }, 'b'))
      .mockResolvedValueOnce(new Response('{}'));
    expect(await saveDefault(recurring, 'Porridge', 'Toast', 'test-token')).toEqual({ [recurring]: 'Toast', 'tuesday/lunch': 'Soup' });
  });
  it('blocks changed defaults and removes only the selected recurring slot', async () => {
    const recurring = 'monday/breakfast';
    const fetcher = mock().mockResolvedValueOnce(file({ [recurring]: 'Toast' }));
    await expect(saveDefault(recurring, 'Porridge', 'Eggs', 'test-token')).rejects.toMatchObject({ scope: 'defaults', latest: { [recurring]: 'Toast' } });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce(file({ [recurring]: 'Toast', 'tuesday/lunch': 'Soup' })).mockResolvedValueOnce(new Response('{}'));
    expect(await saveDefault(recurring, 'Toast', '', 'test-token')).toEqual({ 'tuesday/lunch': 'Soup' });
  });
  it('stores a skip explicitly and restores inheritance by deleting the dated entry', async () => {
    const lunch = `${week}/lunch`;
    const fetcher = mock().mockResolvedValueOnce(file({ [lunch]: 'Soup' })).mockResolvedValueOnce(new Response('{}'));
    expect(await saveMeal(week, key, undefined, null, 'test-token')).toEqual({ [key]: null, [lunch]: 'Soup' });
    fetcher.mockResolvedValueOnce(file({ [key]: null, [lunch]: 'Soup' }, 'b', 2)).mockResolvedValueOnce(new Response('{}'));
    expect(await saveMeal(week, key, null, '', 'test-token')).toEqual({ [lunch]: 'Soup' });
    fetcher.mockResolvedValueOnce(file({ [key]: null }, 'c', 2));
    await expect(saveMeal(week, key, undefined, 'Toast', 'test-token')).rejects.toBeInstanceOf(PlanConflict);
  });
  it('rejects malformed stored defaults before any write and supports version 2 skips', async () => {
    const fetcher = mock().mockResolvedValueOnce(file({ 'monday/breakfast': null }));
    await expect(saveDefault('monday/breakfast', undefined, 'Toast', 'test-token')).rejects.toThrow('invalid meal');
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ version: 2, meals: { [key]: null } })));
    expect(await readPlan(week)).toEqual({ [key]: null });
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ version: 1, meals: { [key]: null } })));
    await expect(readPlan(week)).rejects.toThrow('invalid meal');
  });
  it('reads public JSON without sending credentials, with no offline caching', async () => {
    const fetcher = mock().mockResolvedValue(new Response(JSON.stringify({ version: 1, meals: { [key]: 'Porridge' } })));
    expect(await readPlan(week)).toEqual({ [key]: 'Porridge' });
    expect(fetcher.mock.calls[0]?.[0]).toMatch(/^https:\/\/raw.githubusercontent.com\/H-Wilderspin\/speech-to-text-meals\/main\/weeks\/2026-10-19.json\?updated=/);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store', redirect: 'error' });
    expect(fetcher.mock.calls[0]?.[1]?.headers).toBeUndefined();
  });
  it('treats a missing week as empty but rejects malformed data and server failures', async () => {
    const fetcher = mock().mockResolvedValueOnce(new Response('', { status: 404 }));
    expect(await readPlan(week)).toEqual({});
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ version: 99, meals: {} })));
    await expect(readPlan(week)).rejects.toThrow('unsupported format');
    fetcher.mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(readPlan(week)).rejects.toThrow('Could not load');
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ version: 1, meals: { '2020-01-01/lunch': 'Stale' } })));
    await expect(readPlan(week)).rejects.toThrow('invalid meal');
  });
  it('creates a week and preserves Unicode', async () => {
    const fetcher = mock().mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(new Response('{}', { status: 201 }));
    expect(await saveMeal(week, key, '', 'Œufs & café', 'test-token')).toEqual({ [key]: 'Œufs & café' });
    const write = fetcher.mock.calls[1]?.[1];
    const body = JSON.parse(write?.body as string);
    expect(body.sha).toBeUndefined();
    expect(JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'))).toEqual({ version: 2, meals: { [key]: 'Œufs & café' } });
    expect(write?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
  });
  it('merges a concurrent change to another meal using the latest SHA', async () => {
    const lunch = `${week}/lunch`;
    const fetcher = mock().mockResolvedValueOnce(file({ [key]: 'Toast' }))
      .mockResolvedValueOnce(new Response('', { status: 409 }))
      .mockResolvedValueOnce(file({ [key]: 'Toast', [lunch]: 'Soup' }, 'b'))
      .mockResolvedValueOnce(new Response('{}'));
    expect(await saveMeal(week, key, 'Toast', 'Porridge', 'test-token')).toEqual({ [key]: 'Porridge', [lunch]: 'Soup' });
    expect(JSON.parse(fetcher.mock.calls[3]?.[1]?.body as string).sha).toBe('b');
  });
  it('never overwrites another person’s change to the selected meal', async () => {
    const fetcher = mock().mockResolvedValueOnce(file({ [key]: 'Eggs' }));
    await expect(saveMeal(week, key, 'Toast', 'Porridge', 'test-token')).rejects.toBeInstanceOf(PlanConflict);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('removes only the selected meal, retaining the rest', async () => {
    const lunch = `${week}/lunch`;
    const fetcher = mock().mockResolvedValueOnce(file({ [key]: 'Toast', [lunch]: 'Soup' })).mockResolvedValueOnce(new Response('{}'));
    expect(await saveMeal(week, key, 'Toast', '', 'test-token')).toEqual({ [lunch]: 'Soup' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('recognises a previously completed save without a duplicate commit', async () => {
    const fetcher = mock().mockResolvedValueOnce(file({ [key]: 'Toast' }));
    expect(await saveMeal(week, key, '', 'Toast', 'test-token')).toEqual({ [key]: 'Toast' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid or read-only access and reports offline failures', async () => {
    const fetcher = mock().mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(checkEditor('bad-token')).rejects.toThrow('invalid');
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ permissions: { push: false } })));
    await expect(checkEditor('read-only')).rejects.toThrow('write access');
    fetcher.mockRejectedValueOnce(new TypeError('offline'));
    await expect(readPlan(week)).rejects.toThrow('Check your connection');
  });
  it('bounds retries and does not claim that a rejected write saved', async () => {
    const fetcher = mock();
    for (let i = 0; i < 3; i++) fetcher.mockResolvedValueOnce(file({})).mockResolvedValueOnce(new Response('', { status: 409 }));
    await expect(saveMeal(week, key, '', 'Toast', 'test-token')).rejects.toThrow('busy');
    expect(fetcher).toHaveBeenCalledTimes(6);
    fetcher.mockResolvedValueOnce(file({})).mockResolvedValueOnce(new Response('', { status: 403 }));
    await expect(saveMeal(week, key, '', 'Toast', 'test-token')).rejects.toThrow('denied');
  });
});
