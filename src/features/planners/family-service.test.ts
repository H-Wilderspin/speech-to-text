import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); vi.stubEnv('VITE_SYNC_SERVICE_URL', 'https://family.example'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it('routes device credentials only to the family service and retains SHA conflicts', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ sha: 'revision', value: { version: 1, items: [] } }))
    .mockResolvedValueOnce(new Response('', { status: 409 }));
  vi.stubGlobal('fetch', fetch);
  const { readJsonFile, writeJsonFile } = await import('./github');
  expect(await readJsonFile('shopping/list.json', 'device_secret')).toEqual({ sha: 'revision', value: { version: 1, items: [] } });
  expect((await writeJsonFile('shopping/list.json', {}, 'revision', 'device_secret', 'Update')).status).toBe(409);
  expect(fetch.mock.calls[0]![0]).toBe('https://family.example/files?path=shopping%2Flist.json');
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ value: {}, sha: 'revision' });
  expect(fetch.mock.calls.every(call => String(call[0]).startsWith('https://family.example/'))).toBe(true);
});

it('backs off across documents and manual refresh until Retry-After, then recovers', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ error: 'Syncing is resting.' }, { status: 503, headers: { 'Retry-After': '3600' } }))
    .mockResolvedValue(Response.json({ connected: true }));
  vi.stubGlobal('fetch', fetch);
  const { serviceRequest, SyncPausedError } = await import('./family-service');
  await expect(serviceRequest('/session', 'device_secret')).rejects.toBeInstanceOf(SyncPausedError);
  await expect(serviceRequest('/files?path=defaults.json', 'device_secret')).rejects.toBeInstanceOf(SyncPausedError);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(3600001);
  expect((await serviceRequest('/session', 'device_secret')).ok).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('distinguishes revoked devices from owner/provider failure, including HTML quota errors', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ error: 'Pair again.' }, { status: 401 }))
    .mockResolvedValueOnce(new Response('<html>Quota exceeded</html>', { status: 503 }));
  vi.stubGlobal('fetch', fetch);
  const { serviceRequest, DeviceAccessError, SyncPausedError } = await import('./family-service');
  await expect(serviceRequest('/session', 'device_secret')).rejects.toBeInstanceOf(DeviceAccessError);
  await expect(serviceRequest('/session', 'device_secret')).rejects.toBeInstanceOf(SyncPausedError);
});

it('never sends a device credential to GitHub when service configuration is missing', async () => {
  vi.stubEnv('VITE_SYNC_SERVICE_URL', '');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const { readJsonFile } = await import('./github');
  await expect(readJsonFile('defaults.json', 'device_secret')).rejects.toThrow('not configured');
  expect(fetch).not.toHaveBeenCalled();
});
