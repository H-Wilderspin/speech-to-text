import { describe, expect, it } from 'vitest';
import { suggestWindow, suggestedCaptions, SuggestedTranscript } from './suggestions';
import type { PipelineResult, ReferenceVoice, VoiceWindow } from './types';

const voices: ReferenceVoice[] = [{ id: 'a', name: 'Test voice', embedding: [1, 0] }];
const windows: VoiceWindow[] = [
  { clockId: 'c', startSample: 0, endSample: 48000, speakerId: 'a' },
  { clockId: 'c', startSample: 24000, endSample: 72000, speakerId: 'a' },
];
const result = (patch: Partial<PipelineResult> = {}): PipelineResult => ({ text: 'HELLO WORLD', isFinal: true,
  clockId: 'c', timing: { segment: 0 }, acceptedSamples: 72000,
  tokenPoints: [{ text: '▁HEL', sample: 28000 }, { text: 'LO', sample: 30000 }, { text: '▁WORLD', sample: 32000 }], ...patch });

describe('experimental name suggestions', () => {
  it('reports near-cutoff rejection separately from ambiguity with one saved reference', () => {
    for (const score of [.59, .61]) {
      const transcript = new SuggestedTranscript(voices);
      transcript.addWindow(suggestWindow({ ...windows[0]!, embedding: new Float32Array([score, Math.sqrt(1 - score * score)]) }, voices));
      expect(transcript.getDiagnostics(48000)).toMatchObject({ voiceChecks: 1, voiceAmbiguous: 0,
        voiceMatched: score > .6 ? 1 : 0, voiceRejected: score < .6 ? 1 : 0, minimumSimilarity: .6 });
      expect(transcript.getDiagnostics(48000).bestSimilarity).toBeCloseTo(score, 5);
    }
  });
  it('commits successive sentences in one session and reports pending evidence without private content', () => {
    const transcript = new SuggestedTranscript(voices);
    windows.forEach((window) => transcript.addWindow(window));
    transcript.update(result());
    expect(transcript.getDiagnostics(72000)).toMatchObject({ pendingFinal: 1, evidenceWaitMs: 500, committedThrough: -1 });
    expect(transcript.update(result({ text: '', tokenPoints: [], isFinal: false, timing: { segment: 1 }, acceptedSamples: 90000 }))[0]?.speakerId).toBe('a');
    windows.forEach((window) => transcript.addWindow({ ...window, startSample: window.startSample + 96000, endSample: window.endSample + 96000 }));
    transcript.update(result({ timing: { segment: 1 }, acceptedSamples: 168000,
      tokenPoints: result().tokenPoints.map((point) => ({ ...point, sample: point.sample + 96000 })) }));
    const output = transcript.update(result({ text: '', tokenPoints: [], isFinal: false, timing: { segment: 2 }, acceptedSamples: 180000 }));
    expect(output).toHaveLength(2);
    expect(output.every((segment) => segment.speakerId === 'a')).toBe(true);
    const diagnostic = transcript.getDiagnostics(180000);
    expect(diagnostic).toMatchObject({ pendingFinal: 0, committedThrough: 1, committedSegments: 2 });
    expect(Object.values(diagnostic).every((value) => value === null || typeof value === 'number' || typeof value === 'boolean')).toBe(true);
  });
  it('requires one candidate above the baseline; one saved profile is not an automatic identity', () => {
    const span = { clockId: 'c', startSample: 0, endSample: 48000 };
    expect(suggestWindow({ ...span, embedding: new Float32Array([0, 1]) }, voices).speakerId).toBeUndefined();
    expect(suggestWindow({ ...span, embedding: new Float32Array([1, 0]) }, voices).speakerId).toBe('a');
    expect(suggestWindow({ ...span, embedding: new Float32Array([1, 0]) }, [...voices, { id: 'b', name: 'Other', embedding: [1, 0] }]).speakerId).toBeUndefined();
  });
  it('requires two distinct agreeing windows on the same clock', () => {
    for (const evidence of [windows.slice(0, 1), [windows[0]!, windows[0]!], windows.map((window) => ({ ...window, clockId: 'wrong' })), [windows[0]!, { ...windows[1]!, speakerId: 'b' }]]) {
      expect(suggestedCaptions(result(), evidence, voices).every((segment) => !segment.speakerId)).toBe(true);
    }
    expect(suggestedCaptions(result(), windows, voices)).toEqual([
      { id: 'local:0:0', text: 'HELLO WORLD', isFinal: true, speakerId: 'a', speakerName: 'Test voice', speakerEstimated: true },
    ]);
  });
  it('keeps a whole word Unknown if its subword tokens disagree', () => {
    const crossing = result({ tokenPoints: [{ text: '▁HEL', sample: 12000 }, { text: 'LO', sample: 30000 }, { text: '▁WORLD', sample: 32000 }] });
    const segments = suggestedCaptions(crossing, windows, voices);
    expect(segments.map((segment) => [segment.text, segment.speakerId])).toEqual([['HELLO', undefined], ['WORLD', 'a']]);
  });
  it('accepts the literal spaces returned by the shipped sherpa tokenizer', () => {
    const input = result({ tokenPoints: [{ text: ' HEL', sample: 28000 }, { text: 'LO', sample: 30000 }, { text: ' ', sample: 31000 }, { text: 'WORLD', sample: 32000 }] });
    expect(suggestedCaptions(input, windows, voices)).toEqual(suggestedCaptions(result(), windows, voices));
  });
  it('preserves exact ASR text when tokenization is incompatible or output is interim', () => {
    for (const patch of [{ text: 'Unexpected formatting.' }, { isFinal: false }, { tokenPoints: [{ text: '▁INVALID', sample: -1 }] }]) {
      const input = result(patch);
      expect(suggestedCaptions(input, windows, voices)).toEqual([{ id: 'local:0:0', text: input.text, isFinal: input.isFinal }]);
    }
  });
  it('waits for future evidence, then commits labels without duplicating stable text', () => {
    const transcript = new SuggestedTranscript(voices);
    transcript.addWindow(windows[0]!); transcript.addWindow(windows[1]!);
    expect(transcript.update(result())[0]?.speakerId).toBeUndefined();
    const after = result({ text: '', isFinal: false, tokenPoints: [], timing: { segment: 1 }, acceptedSamples: 90000 });
    expect(transcript.update(after)[0]?.speakerId).toBe('a');
    expect(transcript.update(after)).toHaveLength(1);
    expect(transcript.update(result(), true)).toHaveLength(1);
  });
  it('leaves insufficient evidence Unknown when stopping', () => {
    const transcript = new SuggestedTranscript(voices); transcript.addWindow(windows[0]!);
    expect(transcript.update(result(), true)[0]?.speakerId).toBeUndefined();
  });
  it('retains voice evidence while the recognizer has not emitted its delayed first words', () => {
    const transcript = new SuggestedTranscript(voices);
    transcript.addWindow(windows[0]!);
    transcript.update(result({ text: '', isFinal: false, tokenPoints: [], acceptedSamples: 48000 }));
    transcript.addWindow(windows[1]!);
    transcript.update(result({ text: '', isFinal: false, tokenPoints: [], acceptedSamples: 72000 }));
    expect(transcript.update(result({ acceptedSamples: 90000 }), true)[0]?.speakerId).toBe('a');
  });
  it('keeps earlier evidence when provisional token times move backwards, and expires unused decisions', () => {
    const transcript = new SuggestedTranscript(voices);
    windows.forEach((window) => transcript.addWindow(window));
    transcript.update(result({ isFinal: false, text: 'WORLD', tokenPoints: [{ text: ' WORLD', sample: 60000 }] }));
    expect(transcript.update(result({ acceptedSamples: 90000 }), true)[0]?.speakerId).toBe('a');
    const expired = new SuggestedTranscript(voices);
    windows.forEach((window) => expired.addWindow(window));
    expired.update(result({ text: '', isFinal: false, tokenPoints: [], acceptedSamples: 600000 }));
    expect(expired.update(result({ acceptedSamples: 600000 }), true)[0]?.speakerId).toBeUndefined();
  });
  it('distinguishes weak, ambiguous and accepted matches without reporting speech or identities', () => {
    for (const [embedding, references, expected] of [
      [[0, 1], voices, '0/1 matched; 0 ambiguous. Best similarity 0.00'],
      [[1, 0], [...voices, { ...voices[0]!, id: 'b' }], '0/1 matched; 1 ambiguous. Best similarity 1.00'],
      [[1, 0], voices, '1/1 matched; 0 ambiguous. Best similarity 1.00'],
    ] as const) {
      const transcript = new SuggestedTranscript(references);
      expect(transcript.getStatus()).toBe('No voice samples checked yet.');
      transcript.addWindow(suggestWindow({ ...windows[0]!, embedding: new Float32Array(embedding) }, references));
      expect(transcript.getStatus()).toContain(expected);
      const diagnostic = transcript.getDiagnostics(48000);
      expect(diagnostic.voiceMatched + diagnostic.voiceAmbiguous + diagnostic.voiceRejected).toBe(1);
      expect(diagnostic.minimumSimilarity).toBe(.6);
      expect(diagnostic.bestSimilarity).toBe(diagnostic.lastSimilarity);
      transcript.update(result(), true);
      expect(transcript.getStatus()).toContain('Not enough agreeing voice evidence at word times.');
      expect(transcript.getStatus()).not.toContain(voices[0]!.name);
      expect(transcript.getStatus()).not.toContain('HELLO');
    }
  });
  it('distinguishes tokenizer rejection from lack of a voice match', () => {
    const transcript = new SuggestedTranscript(voices);
    windows.forEach((window) => transcript.addWindow(window));
    transcript.update(result({ text: 'Different formatting.' }), true);
    expect(transcript.getStatus()).toContain('2/2 matched');
    expect(transcript.getStatus()).toContain('Local words and tokens do not align.');
  });
});
