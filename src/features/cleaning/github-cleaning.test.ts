import { afterEach, describe, expect, it, vi } from 'vitest';
import { CleaningConflict, readCleaningPlan, saveCleaningChange } from './github-cleaning';
import { emptyCleaningPlan, type CleaningPlan } from './tasks';

const week = '2026-10-19';
const key = `${week}/vacuum`;
const file = (plan: CleaningPlan, sha = 'a') => new Response(JSON.stringify({ sha, encoding: 'base64', content: Buffer.from(JSON.stringify({ version: 1, ...plan })).toString('base64') }));
const mock = () => { const fetcher = vi.fn<typeof fetch>(); vi.stubGlobal('fetch', fetcher); return fetcher; };
afterEach(() => vi.unstubAllGlobals());

describe('shared cleaning documents', () => {
  it('reads missing documents as empty and never sends tokens to public raw URLs', async () => {
    const fetcher = mock().mockResolvedValueOnce(new Response('', { status: 404 }));
    expect(await readCleaningPlan(week)).toEqual(emptyCleaningPlan());
    expect(fetcher.mock.calls[0]?.[0]).toContain(`/cleaning/weeks/${week}.json?updated=`);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store', redirect: 'error' });
    expect(fetcher.mock.calls[0]?.[1]?.headers).toBeUndefined();
    fetcher.mockResolvedValueOnce(file(emptyCleaningPlan()));
    await readCleaningPlan(undefined, 'test-token');
    expect(fetcher.mock.calls[1]?.[0]).toContain('/contents/cleaning/defaults.json?ref=main');
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
  });
  it('creates Unicode recurring tasks separately from weekly meals', async () => {
    const fetcher = mock().mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(new Response('{}', { status: 201 }));
    await saveCleaningChange(undefined, { field: 'tasks', key: 'monday/kitchen', previous: undefined, value: ' Nettoyer la fenêtre ' }, 'test-token');
    expect(fetcher.mock.calls[1]?.[0]).toMatch(/\/contents\/cleaning\/defaults.json$/);
    const body = JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string);
    expect(body.sha).toBeUndefined();
    expect(JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'))).toEqual({ version: 1, tasks: { 'monday/kitchen': 'Nettoyer la fenêtre' }, completed: {} });
  });
  it('merges a concurrent task edit while saving a separate completion tick', async () => {
    const initial = { tasks: { [key]: 'Vacuum' }, completed: {} };
    const fetcher = mock().mockResolvedValueOnce(file(initial)).mockResolvedValueOnce(new Response('', { status: 409 }))
      .mockResolvedValueOnce(file({ tasks: { [key]: 'Vacuum upstairs', [`${week}/dust`]: 'Dust' }, completed: {} }, 'b')).mockResolvedValueOnce(new Response('{}'));
    const result = await saveCleaningChange(week, { field: 'completed', key, previous: undefined, value: true }, 'test-token');
    expect(result).toEqual({ tasks: { [key]: 'Vacuum upstairs', [`${week}/dust`]: 'Dust' }, completed: { [key]: true } });
    expect(JSON.parse(fetcher.mock.calls[3]?.[1]?.body as string).sha).toBe('b');
  });
  it('rejects conflicting task edits without overwriting and treats lost responses idempotently', async () => {
    const fetcher = mock().mockResolvedValueOnce(file({ tasks: { [key]: 'Vacuum upstairs' }, completed: {} }));
    await expect(saveCleaningChange(week, { field: 'tasks', key, previous: 'Vacuum', value: 'Vacuum downstairs' }, 'test-token')).rejects.toBeInstanceOf(CleaningConflict);
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce(file({ tasks: {}, completed: { [key]: true } }));
    await saveCleaningChange(week, { field: 'completed', key, previous: undefined, value: true }, 'test-token');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('skips and restores one date, and removes a recurrence without touching a week', async () => {
    const fetcher = mock().mockResolvedValueOnce(file(emptyCleaningPlan())).mockResolvedValueOnce(new Response('{}'));
    expect((await saveCleaningChange(week, { field: 'tasks', key, previous: undefined, value: null }, 'test-token')).tasks[key]).toBeNull();
    fetcher.mockResolvedValueOnce(file({ tasks: { [key]: null }, completed: { [key]: true } })).mockResolvedValueOnce(new Response('{}'));
    expect(await saveCleaningChange(week, { field: 'tasks', key, previous: null, value: undefined }, 'test-token')).toEqual({ tasks: {}, completed: { [key]: true } });
    fetcher.mockResolvedValueOnce(file({ tasks: { 'monday/vacuum': 'Vacuum', 'monday/dust': 'Dust' }, completed: {} })).mockResolvedValueOnce(new Response('{}'));
    expect((await saveCleaningChange(undefined, { field: 'tasks', key: 'monday/vacuum', previous: 'Vacuum', value: undefined }, 'test-token')).tasks).toEqual({ 'monday/dust': 'Dust' });
    expect(fetcher.mock.calls[5]?.[0]).toContain('/cleaning/defaults.json');
  });
  it('rejects malformed documents and invalid changes before writing', async () => {
    const fetcher = mock().mockResolvedValueOnce(file({ tasks: { wrong: 'Bad' }, completed: {} }));
    await expect(saveCleaningChange(week, { field: 'completed', key, previous: undefined, value: true }, 'test-token')).rejects.toThrow('invalid task');
    await expect(saveCleaningChange(undefined, { field: 'completed', key: 'monday/vacuum', previous: undefined, value: true }, 'test-token')).rejects.toThrow('invalid completion');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('bounds retries and reports failed writes and unavailable access', async () => {
    const fetcher = mock();
    const change = { field: 'tasks', key, previous: undefined, value: 'Vacuum' } as const;
    for (let i = 0; i < 3; i++) fetcher.mockResolvedValueOnce(file(emptyCleaningPlan())).mockResolvedValueOnce(new Response('', { status: 409 }));
    await expect(saveCleaningChange(week, change, 'test-token')).rejects.toThrow('busy');
    expect(fetcher).toHaveBeenCalledTimes(6);
    fetcher.mockResolvedValueOnce(file(emptyCleaningPlan())).mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(saveCleaningChange(week, change, 'test-token')).rejects.toThrow('did not save');
    await expect(saveCleaningChange(week, change, '')).rejects.toThrow('Connect GitHub');
    fetcher.mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(readCleaningPlan(week, 'expired')).rejects.toThrow('expired');
  });
});
