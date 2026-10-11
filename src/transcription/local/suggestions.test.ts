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
});
