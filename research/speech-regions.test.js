import { expect, it } from 'vitest';
import { createSpeechDetector } from './speech-regions.mjs';

function fixture() {
  const buffer = new ArrayBuffer(4 * 1024 * 1024); let pointer = 64; let accepted = 0; let head = 0;
  let pending = []; let segment;
  const module = {
    HEAPU32: new Uint32Array(buffer), HEAPF32: new Float32Array(buffer),
    FS: { writeFile() {}, unlink() {} },
    _malloc: (size) => { const result = pointer; pointer += Math.ceil(size / 4) * 4; return result; }, _free() {},
    lengthBytesUTF8: (text) => text.length, stringToUTF8() {},
    _SherpaOnnxCreateVoiceActivityDetector: () => 1, _SherpaOnnxDestroyVoiceActivityDetector() {},
    _SherpaOnnxVoiceActivityDetectorDetected: () => 1,
    _SherpaOnnxVoiceActivityDetectorAcceptWaveform: (_detector, audio, count) => {
      expect(count).toBe(512); pending.push(module.HEAPF32.slice(audio / 4, audio / 4 + count)); accepted += count;
    },
    _SherpaOnnxVoiceActivityDetectorFlush: () => {
      if (!pending.length) return;
      const audio = module._malloc((accepted - head) * 4); let offset = audio / 4;
      for (const samples of pending) { module.HEAPF32.set(samples, offset); offset += samples.length; }
      const handle = module._malloc(12); module.HEAPU32.set([head, audio, accepted - head], handle / 4);
      segment = handle; pending = []; head = accepted;
    },
    _SherpaOnnxVoiceActivityDetectorEmpty: () => segment ? 0 : 1,
    _SherpaOnnxVoiceActivityDetectorFront: () => segment,
    _SherpaOnnxDestroySpeechSegment() {}, _SherpaOnnxVoiceActivityDetectorPop: () => { segment = undefined; },
  };
  return createSpeechDetector(module, new Uint8Array(1));
}
it('feeds complete model windows and bounds continuous speech without resetting its clock', () => {
  const detector = fixture(); const samples = Float32Array.from({ length: 21 * 16000 + 79 }, (_, i) => (i % 100) / 100);
  const regions = [];
  for (let offset = 0; offset < samples.length; offset += 1234) regions.push(...detector.accept(samples.subarray(offset, offset + 1234), offset));
  const tail = detector.finish(); regions.push(...tail.regions);
  expect(regions.map((region) => [region.startSample, region.endSample, region.reason])).toEqual([
    [0, 163840, 'window-limit'], [163840, 327680, 'window-limit'], [327680, 335872, 'end-of-input'],
  ]);
  for (const region of regions) expect(region.samples).toEqual(samples.slice(region.startSample, region.endSample));
  expect(tail.acceptedSamples - tail.analyzedSamples).toBe(207);
  detector.close(); detector.close();
});
it('rejects gaps and input after finishing rather than restarting timestamps', () => {
  const detector = fixture(); detector.accept(new Float32Array(100), 0);
  expect(() => detector.accept(new Float32Array(10), 101)).toThrow('continuity');
  expect(() => detector.accept(new Float32Array([NaN]), 100)).toThrow('continuity');
  expect(detector.finish()).toEqual({ regions: [], acceptedSamples: 100, analyzedSamples: 0 });
  expect(() => detector.accept(new Float32Array(512), 100)).toThrow('continuity');
  expect(() => detector.finish()).toThrow('closed'); detector.close();
});
