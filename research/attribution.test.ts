import { describe, expect, it } from 'vitest';
import { alignUtterance, cosine, identify, type Calibration } from './attribution';

const query = { modelVersion: 'synthetic-v1', values: [1, 0] };
const candidates = [{ speakerId: 'a', embedding: query }, { speakerId: 'b', embedding: { ...query, values: [0, 1] } }];
// Synthetic boundary values ONLY. This is not a measured production calibration.
const calibration: Calibration = { modelVersion: 'synthetic-v1', minimumCosine: .8, minimumMargin: .1, evidenceId: 'synthetic-test' };

describe('speaker identification safety spike', () => {
  it('requires explicit versioned calibration evidence', () => {
    expect(identify(query, candidates)).toBeUndefined();
    expect(identify(query, candidates, { ...calibration, evidenceId: '' })).toBeUndefined();
    expect(identify(query, candidates, { ...calibration, modelVersion: 'different' })).toBeUndefined();
  });
  it('rejects incompatible vectors, silence, and invalid numbers', () => {
    expect(cosine([0, 0], [1, 0])).toBeNull();
    expect(cosine([1], [1, 0])).toBeNull();
    expect(cosine([NaN], [1])).toBeNull();
    expect(cosine([Infinity], [1])).toBeNull();
    expect(identify(query, [{ speakerId: 'old', embedding: { ...query, modelVersion: 'old' } }], calibration)).toBeUndefined();
  });
  it('uses similarity and runner-up margin; ties stay Unknown', () => {
    expect(identify(query, candidates, calibration)).toBe('a');
    expect(identify(query, [...candidates, { speakerId: 'c', embedding: query }], calibration)).toBeUndefined();
    expect(identify({ ...query, values: [-1, 0] }, candidates, calibration)).toBeUndefined();
  });
  it('handles the threshold boundary without labelling a score a probability', () => {
    expect(identify(query, [{ speakerId: 'a', embedding: { ...query, values: [.8, .6] } }], calibration)).toBe('a');
    expect(identify(query, [{ speakerId: 'a', embedding: { ...query, values: [.79, .6131] } }], calibration)).toBeUndefined();
  });
});

describe('shared audio clock spike', () => {
  const span = { startMs: 100, endMs: 900, clockId: 'capture-1' };
  const turn = { startMs: 0, endMs: 1000, clockId: 'capture-1', clusterId: 'speaker-1' };
  it('refuses browser recognition with absent audio timing', () => expect(alignUtterance(undefined, [turn])).toBeUndefined());
  it('does not join unrelated clocks', () => expect(alignUtterance({ ...span, clockId: 'wall-clock' }, [turn])).toBeUndefined());
  it('returns a cluster, never an enrolled identity', () => expect(alignUtterance(span, [turn])).toBe('speaker-1'));
  it('rejects overlapping voices and utterances across a turn change', () => {
    expect(alignUtterance(span, [turn, { ...turn, startMs: 500, clusterId: 'speaker-2' }])).toBeUndefined();
    expect(alignUtterance({ ...span, endMs: 1100 }, [turn])).toBeUndefined();
  });
  it('rejects invalid timing', () => {
    expect(alignUtterance({ ...span, startMs: NaN }, [turn])).toBeUndefined();
    expect(alignUtterance({ ...span, endMs: 0 }, [turn])).toBeUndefined();
  });
});
