import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CleaningConflict, readCleaningPlan, saveCleaningChange, syncCleaningWeek } from './github-cleaning';
import { cleaningDocument } from './completion-reset';
import { emptyCleaningPlan, type CleaningPlan } from './tasks';

const week = '2026-10-19';
const key = `${week}/vacuum`;
const file = (plan: CleaningPlan, sha = 'a') => new Response(JSON.stringify({ sha, encoding: 'base64', content: Buffer.from(JSON.stringify(cleaningDocument(plan))).toString('base64') }));
const mock = () => { const fetcher = vi.fn<typeof fetch>(); vi.stubGlobal('fetch', fetcher); return fetcher; };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 19, 12)); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('shared cleaning documents', () => {
  it('persists one Sunday reset and preserves a later tick from another device after a SHA race', async () => {
    vi.setSystemTime(new Date(2026, 9, 25));
    const initial = { tasks: { [key]: 'Shopping trip' }, completed: { [key]: true } };
    const fetcher = mock().mockResolvedValueOnce(file(initial)).mockResolvedValueOnce(new Response('{}'));
    const reset = await syncCleaningWeek(week, 'test-token');
    expect(reset).toEqual({ tasks: initial.tasks, completed: {}, completionReset: '2026-10-25' });
    const body = JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string);
    expect(JSON.parse(Buffer.from(body.content, 'base64').toString())).toEqual(cleaningDocument(reset));
    const checkedAgain = { ...reset, completed: { [key]: true } };
    fetcher.mockResolvedValueOnce(file(initial)).mockResolvedValueOnce(new Response('', { status: 409 }))
      .mockResolvedValueOnce(file(checkedAgain, 'b'));
    expect(await syncCleaningWeek(week, 'test-token')).toEqual(checkedAgain);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it('resets anonymous views without writes and reports reset failures for retry', async () => {
    vi.setSystemTime(new Date(2026, 9, 25));
    const initial = { tasks: { [key]: 'Shopping trip' }, completed: { [key]: true } };
    const fetcher = mock().mockResolvedValueOnce(new Response(JSON.stringify({ version: 1, ...initial })));
    expect((await syncCleaningWeek(week)).completed).toEqual({});
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce(file(initial)).mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(syncCleaningWeek(week, 'test-token')).rejects.toThrow('Sunday task reset');
    fetcher.mockResolvedValueOnce(file(initial)).mockResolvedValueOnce(new Response('{}'));
    expect((await syncCleaningWeek(week, 'test-token')).completed).toEqual({});
  });
  it('combines a newly checked task with a due reset, preserving its marker on later edits', async () => {
    vi.setSystemTime(new Date(2026, 9, 25));
    const initial = { tasks: {}, completed: { [`${week}/dust`]: true } };
    const fetcher = mock().mockResolvedValueOnce(file(initial)).mockResolvedValueOnce(new Response('{}'));
    const saved = await saveCleaningChange(week, { field: 'completed', key, previous: undefined, value: true }, 'test-token');
    expect(saved).toEqual({ tasks: {}, completed: { [key]: true }, completionReset: '2026-10-25' });
    fetcher.mockResolvedValueOnce(file(saved)).mockResolvedValueOnce(new Response('{}'));
    const edited = await saveCleaningChange(week, { field: 'tasks', key, previous: undefined, value: 'Shop' }, 'test-token');
    expect(edited.completionReset).toBe('2026-10-25');
    expect(edited.completed[key]).toBe(true);
  });
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
