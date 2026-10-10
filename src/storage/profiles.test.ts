import { describe, expect, it } from 'vitest';
import { CONSENT_VERSION, normalizeEmbedding, profileSummary, validateProfile, type SpeakerProfile } from './profiles';

const profile: SpeakerProfile = {
  schemaVersion: 1, id: 'synthetic', displayName: ' Test speaker ', createdAt: '2026-10-10T12:00:00Z',
  consentVersion: CONSENT_VERSION, consentedAt: '2026-10-10T12:00:00Z', modelVersion: 'test-model', sampleDurationMs: 8000, embedding: [3, 4],
};
describe('profile boundaries', () => {
  it('normalizes without mutating the caller and never retains extra audio fields', () => {
    const safe = validateProfile({ ...profile, audio: [1] } as SpeakerProfile);
    expect(safe).not.toHaveProperty('audio'); expect(safe.displayName).toBe('Test speaker');
    expect(Math.hypot(...safe.embedding)).toBeCloseTo(1);
    expect(profile.embedding).toEqual([3, 4]);
    expect(profileSummary(profile)).not.toHaveProperty('embedding');
  });
  it.each([[], [0, 0], [NaN], [Infinity], Array(4097).fill(1)])('rejects malformed or empty vectors %#', (values) => {
    expect(() => normalizeEmbedding(values)).toThrow();
  });
  it.each([
    { displayName: ' ' }, { displayName: 'x'.repeat(61) }, { consentVersion: '' }, { consentedAt: 'invalid' },
    { sampleDurationMs: 0 }, { modelVersion: '' }, { schemaVersion: 2 },
  ])('rejects invalid profile metadata %#', (change) => {
    expect(() => validateProfile({ ...profile, ...change } as SpeakerProfile)).toThrow();
  });
});
