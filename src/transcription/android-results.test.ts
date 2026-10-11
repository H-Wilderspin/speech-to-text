import { describe, expect, it } from 'vitest';
import { reconcileAndroidResults, usesAndroidRecognition } from './android-results';

const snapshots = (texts: string[], confidence = 0) => texts.map((transcript) => ({
  0: { transcript, confidence }, length: 1, isFinal: true,
}));

describe('Android cumulative native results', () => {
  it('replaces repeated, extended and corrected false finals with one current hypothesis', () => {
    const texts = ['We', 'We', 'We are', 'We are hear', 'We are here.', 'We are here.'];
    for (let count = 1; count <= texts.length; count++) {
      expect(reconcileAndroidResults(snapshots(texts.slice(0, count)), 3)).toEqual([
        { id: '3:0', text: texts[count - 1], isFinal: false },
      ]);
    }
  });
  it('preserves deliberate repeated words inside the current hypothesis', () => {
    expect(reconcileAndroidResults(snapshots(['Yes', 'Yes yes.', 'Yes yes. Very very good.']), 2)[0]?.text)
      .toBe('Yes yes. Very very good.');
  });
  it('keeps both high-confidence and missing-confidence results provisional until native end', () => {
    for (const confidence of [0, -1, .95]) {
      expect(reconcileAndroidResults(snapshots(['command stop'], confidence), 1)[0]?.isFinal).toBe(false);
    }
  });
  it('does not resurrect an earlier revision if the latest hypothesis is empty', () => {
    expect(reconcileAndroidResults(snapshots(['discarded', ' ']), 1)).toEqual([]);
    expect(reconcileAndroidResults([], 1)).toEqual([]);
  });
  it('limits the compatibility adapter to Android Chromium browsers', () => {
    expect(usesAndroidRecognition('Mozilla/5.0 (Linux; Android 10; K) Chrome/156.0.0.0 Mobile Safari/537.36')).toBe(true);
    expect(usesAndroidRecognition('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130.0.0.0 SamsungBrowser/28.0')).toBe(true);
    expect(usesAndroidRecognition('Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0')).toBe(false);
    expect(usesAndroidRecognition('Mozilla/5.0 (Windows NT 10.0) Chrome/156.0.0.0')).toBe(false);
    expect(usesAndroidRecognition('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/156.0.0.0 Mobile Safari/604.1')).toBe(false);
  });
});
