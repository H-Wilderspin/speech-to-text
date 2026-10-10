import { describe, expect, it, vi } from 'vitest';
import { createDiarizer } from './offline-diarization.mjs';
import { summarizePlayback } from './diarization-fixtures.mjs';

function runtime() {
  const heap = new ArrayBuffer(2 ** 20); let next = 64;
  const module = {
    HEAPU8: new Uint8Array(heap), HEAPU32: new Uint32Array(heap), HEAPF32: new Float32Array(heap),
    _malloc: vi.fn((bytes) => { const pointer = next; next += Math.ceil(bytes / 4) * 4; return pointer; }),
    _free: vi.fn(), lengthBytesUTF8: (s) => s.length, stringToUTF8: vi.fn(),
    FS: { writeFile: vi.fn(), unlink: vi.fn() },
    _SherpaOnnxCreateOfflineSpeakerDiarization: vi.fn(() => 1),
    _SherpaOnnxDestroyOfflineSpeakerDiarization: vi.fn(),
    _SherpaOnnxOfflineSpeakerDiarizationGetSampleRate: () => 16000,
    _SherpaOnnxOfflineSpeakerDiarizationProcess: vi.fn(() => 2),
    _SherpaOnnxOfflineSpeakerDiarizationResultGetNumSpeakers: () => 2,
    _SherpaOnnxOfflineSpeakerDiarizationResultGetNumSegments: () => 2,
    _SherpaOnnxOfflineSpeakerDiarizationResultSortByStartTime: vi.fn(() => {
      const p = module._malloc(32); const i = p / 4;
      module.HEAPF32.set([0.1, 0.6, 0, -2, 0.4, 0.8, 0, -2], i);
      module.HEAPU32[i + 6] = 1;
      return p;
    }),
    _SherpaOnnxOfflineSpeakerDiarizationDestroySegment: vi.fn(),
    _SherpaOnnxOfflineSpeakerDiarizationDestroyResult: vi.fn(),
  };
  return module;
}

describe('offline diarization boundary', () => {
  it('keeps overlapping anonymous clusters, erases copied PCM and releases every result', () => {
    const module = runtime(); const diarizer = createDiarizer(module, new Uint8Array(1), new Uint8Array(1));
    const audio = new Float32Array(16000).fill(0.25); const result = diarizer.process(audio);
    expect(result.speakers).toBe(2); expect(result.segments.map((s) => s.cluster)).toEqual([0, 1]);
    expect(result.segments[0].end).toBeGreaterThan(result.segments[1].start);
    const [, pointer, length] = module._SherpaOnnxOfflineSpeakerDiarizationProcess.mock.calls[0];
    expect(module.HEAPF32.subarray(pointer / 4, pointer / 4 + length).every((v) => v === 0)).toBe(true);
    expect(audio.every((v) => v === 0.25)).toBe(true); // Caller owns its original.
    expect(module._SherpaOnnxOfflineSpeakerDiarizationDestroyResult).toHaveBeenCalledWith(2);
    expect(module._SherpaOnnxOfflineSpeakerDiarizationDestroySegment).toHaveBeenCalledOnce();
    diarizer.close(); diarizer.close();
    expect(module._SherpaOnnxDestroyOfflineSpeakerDiarization).toHaveBeenCalledOnce();
    expect(() => diarizer.process(audio)).toThrow('closed');
  });
  it('cleans up failed inference and rejects invalid input before native processing', () => {
    const module = runtime(); const diarizer = createDiarizer(module, new Uint8Array(1), new Uint8Array(1));
    expect(() => diarizer.process(new Float32Array([NaN]))).toThrow('finite');
    expect(() => diarizer.process(new Float32Array(480001))).toThrow('30 seconds');
    expect(module._SherpaOnnxOfflineSpeakerDiarizationProcess).not.toHaveBeenCalled();
    module._SherpaOnnxOfflineSpeakerDiarizationProcess.mockImplementation(() => { throw new Error('native failure'); });
    expect(() => diarizer.process(new Float32Array(16000).fill(1))).toThrow('native failure');
    const [, pointer, length] = module._SherpaOnnxOfflineSpeakerDiarizationProcess.mock.calls[0];
    expect(module.HEAPF32.subarray(pointer / 4, pointer / 4 + length).every((v) => v === 0)).toBe(true);
    expect(module._free).toHaveBeenCalledWith(pointer); diarizer.close();
  });
  it('rejects output outside the input clock and still frees native results', () => {
    const module = runtime(); const diarizer = createDiarizer(module, new Uint8Array(1), new Uint8Array(1));
    expect(() => diarizer.process(new Float32Array(1600))).toThrow('Invalid diarization segment');
    expect(module._SherpaOnnxOfflineSpeakerDiarizationDestroyResult).toHaveBeenCalledWith(2);
    expect(module._SherpaOnnxOfflineSpeakerDiarizationDestroySegment).toHaveBeenCalledOnce(); diarizer.close();
  });
  it('releases model files, configuration and a failed handle during initialization', () => {
    const module = runtime(); module._SherpaOnnxOfflineSpeakerDiarizationGetSampleRate = () => 8000;
    expect(() => createDiarizer(module, new Uint8Array(1), new Uint8Array(1))).toThrow('16 kHz');
    expect(module.FS.unlink).toHaveBeenCalledTimes(2);
    expect(module._free).toHaveBeenCalledTimes(module._malloc.mock.calls.length);
    expect(module._SherpaOnnxDestroyOfflineSpeakerDiarization).toHaveBeenCalledWith(1);
  });
  it('preserves sparse native cluster IDs without treating the speaker count as an ID limit', () => {
    const module = runtime(); module._SherpaOnnxOfflineSpeakerDiarizationResultGetNumSegments = () => 1;
    module._SherpaOnnxOfflineSpeakerDiarizationResultGetNumSpeakers = () => 1;
    module._SherpaOnnxOfflineSpeakerDiarizationResultSortByStartTime.mockImplementation(() => {
      const pointer = module._malloc(16); module.HEAPF32.set([0.1, 0.8, 0, -2], pointer / 4);
      module.HEAPU32[pointer / 4 + 2] = 2; return pointer;
    });
    const diarizer = createDiarizer(module, new Uint8Array(1), new Uint8Array(1));
    expect(diarizer.process(new Float32Array(16000)).segments[0].cluster).toBe(2); diarizer.close();
  });
  it('measures overlap as a union and does not count duplicate same-cluster intervals twice', () => {
    const result = summarizePlayback([{ start: 0, end: 3, cluster: 0 }, { start: 1, end: 4, cluster: 1 },
      { start: 2, end: 3, cluster: 1 }], [{ voice: 'A', start: 0, end: 1 }]);
    expect(result.detectedOverlapSeconds).toBe(2);
    expect(result.playbackCoverage[0].clusterSeconds).toEqual({ 0: 1 });
  });
});
