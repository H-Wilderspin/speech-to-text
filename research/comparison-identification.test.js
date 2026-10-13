import { it, expect } from 'vitest';
import { identifyEmbedding, identifyTurns } from './comparison-identification.mjs';
it('rejects unknown and ambiguous references without selecting the nearest name', () => {
  const references = { A: new Float32Array([1, 0]), B: new Float32Array([1, 0]) };
  expect(identifyEmbedding(new Float32Array([1, 0]), ['A', 'B'], references).speakerId).toBeUndefined();
  expect(identifyEmbedding(new Float32Array([0, 1]), ['A'], references).speakerId).toBeUndefined();
  expect(identifyEmbedding(new Float32Array([1, 0]), ['A'], references).speakerId).toBe('A');
});
it('excludes overlapping turns and requires enough clean audio for identity', () => {
  const extractor = { compute: () => { throw new Error('Must not extract mixed or short audio'); } };
  const result = identifyTurns(new Float32Array(64000), [
    { start: 0, end: 2, cluster: 'one' }, { start: 1, end: 3, cluster: 'two' },
    { start: 3, end: 3.6, cluster: 'one' },
  ], ['A'], extractor, {});
  expect(result.identities).toEqual({});
});
