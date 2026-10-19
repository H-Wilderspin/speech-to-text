import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeMealAccess, editorTokenKey, readMealAccess } from './editor-token';

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('document', { baseURI: 'https://example.test/speech-to-text/' });
  vi.stubEnv('BASE_URL', './');
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('remembered meal access', () => {
  it('saves only when requested and restores the connection', () => {
    expect(changeMealAccess('test-token')).toMatchObject({ token: 'test-token', remembered: false });
    expect(readMealAccess().token).toBe('');
    expect(changeMealAccess('test-token', true).remembered).toBe(true);
    expect(readMealAccess()).toEqual({ token: 'test-token', remembered: true, notice: '' });
  });
  it('disconnects only this app and keeps reading preferences and sibling tokens', () => {
    values.set('speech-to-text-meal-editor:/other/', 'other-token');
    values.set('speech-to-text-display:/speech-to-text/', 'preferences');
    changeMealAccess('test-token', true);
    expect(editorTokenKey()).toBe('speech-to-text-meal-editor:/speech-to-text/');
    expect(changeMealAccess('')).toEqual({ token: '', remembered: false, notice: '' });
    expect(values.has(editorTokenKey())).toBe(false);
    expect(values.size).toBe(2);
  });
  it('does not reuse another app path and removes saved access when choosing session only', () => {
    changeMealAccess('test-token', true);
    vi.stubGlobal('document', { baseURI: 'https://example.test/other/' });
    expect(readMealAccess().token).toBe('');
    vi.stubGlobal('document', { baseURI: 'https://example.test/speech-to-text/' });
    changeMealAccess('session-token', false);
    expect(readMealAccess().token).toBe('');
  });
  it('continues for this session and explains when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(readMealAccess()).toEqual({ token: '', remembered: false, notice: '' });
    const connected = changeMealAccess('test-token', true);
    expect(connected).toMatchObject({ token: 'test-token', remembered: false });
    expect(connected.notice).toContain('could not remember');
    const disconnected = changeMealAccess('');
    expect(disconnected.token).toBe('');
    expect(disconnected.notice).toContain('could not be removed');
    expect(disconnected.notice).not.toContain('test-token');
  });
});
