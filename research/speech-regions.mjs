// Native VAD spans are speech-region estimates, never verified single-speaker turns.
export function createSpeechDetector(module, model) {
  if (typeof module._SherpaOnnxVoiceActivityDetectorReset !== 'function') throw new Error('The research runtime is outdated. Run npm run spike:build-pipeline.');
  let detector = 0; let input = 0; let accepted = 0; let processed = 0; let used = 0; let lastEnd = 0; let finished = false;
  let windowStart = 0;
  const pending = new Float32Array(512);
  const pointers = [];
  const allocate = (size) => {
    const pointer = module._malloc(size); if (!pointer) throw new Error('VAD allocation failed.');
    pointers.push(pointer); return pointer;
  };
  const string = (text) => { const size = module.lengthBytesUTF8(text) + 1; const pointer = allocate(size); module.stringToUTF8(text, pointer, size); return pointer; };
  module.FS.writeFile('/vad.onnx', model);
  try {
    const path = string('/vad.onnx'); const provider = string('cpu'); const config = allocate(64);
    // Verified wasm32 SherpaOnnxVadModelConfig layout: Silero(24), common(16), Ten(24).
    module.HEAPU32.fill(0, config / 4, config / 4 + 16);
    module.HEAPU32[config / 4] = path;
    module.HEAPF32.set([.5, .5, .25], config / 4 + 1);
    module.HEAPU32[config / 4 + 4] = 512; module.HEAPF32[config / 4 + 5] = 30;
    module.HEAPU32.set([16000, 1, provider, 0], config / 4 + 6);
    detector = module._SherpaOnnxCreateVoiceActivityDetector(config, 30);
    if (!detector) throw new Error('VAD model could not initialize.');
    input = module._malloc(512 * 4); if (!input) throw new Error('VAD input allocation failed.');
  } catch (error) {
    if (detector) module._SherpaOnnxDestroyVoiceActivityDetector(detector);
    throw error;
  } finally { pointers.forEach((pointer) => module._free(pointer)); module.FS.unlink('/vad.onnx'); }
  const drain = (reason, regions) => {
    while (!module._SherpaOnnxVoiceActivityDetectorEmpty(detector)) {
      const segment = module._SherpaOnnxVoiceActivityDetectorFront(detector);
      if (!segment) throw new Error('VAD returned no speech segment.');
      const [localStart, pointer, count] = module.HEAPU32.subarray(segment / 4, segment / 4 + 3);
      const startSample = windowStart + localStart;
      try {
        const endSample = startSample + count;
        if (!count || startSample < lastEnd || endSample > processed || count > 16000 * 11) {
          throw new Error('VAD returned an incompatible speech span.', { cause: { startSample, endSample, count, lastEnd, processed } });
        }
        const samples = module.HEAPF32.slice(pointer / 4, pointer / 4 + count);
        lastEnd = endSample;
        regions.push({ startSample, endSample, reason, samples, analysisWindowStartSample: windowStart });
      } finally {
        module.HEAPF32.fill(0, pointer / 4, pointer / 4 + count);
        module._SherpaOnnxDestroySpeechSegment(segment);
        module._SherpaOnnxVoiceActivityDetectorPop(detector);
      }
    }
  };
  return {
    isDetected: () => Boolean(detector && module._SherpaOnnxVoiceActivityDetectorDetected(detector)),
    accept(samples, startSample) {
      if (!detector || finished || startSample !== accepted || !(samples instanceof Float32Array) || !samples.length || samples.length > 1600 || !samples.every(Number.isFinite)
        || accepted + samples.length > 2147483136) throw new Error('VAD input lost continuity.');
      accepted += samples.length; const regions = [];
      try {
        for (let offset = 0; offset < samples.length;) {
          const count = Math.min(512 - used, samples.length - offset);
          pending.set(samples.subarray(offset, offset + count), used); used += count; offset += count;
          if (used === 512) {
            module.HEAPF32.set(pending, input / 4);
            module._SherpaOnnxVoiceActivityDetectorAcceptWaveform(detector, input, 512);
            module.HEAPF32.fill(0, input / 4, input / 4 + 512); pending.fill(0); used = 0; processed += 512;
            drain('detector', regions);
            // The native maximum-duration setting only changes detection thresholds.
            // Flush is end-of-input, not a midstream cut. Reset native state for
            // each new analysis window and map its sample indices to the unchanged
            // capture clock. No samples are skipped and no speaker change is implied.
            if (processed % (512 * 320) === 0) {
              module._SherpaOnnxVoiceActivityDetectorFlush(detector); drain('window-limit', regions);
              module._SherpaOnnxVoiceActivityDetectorReset(detector); windowStart = processed;
            }
          }
        }
        return regions;
      } catch (error) { regions.forEach((region) => region.samples.fill(0)); throw error; }
    },
    finish() {
      if (!detector || finished) throw new Error('VAD stream is closed.');
      finished = true;
      const regions = [];
      // Do not add invented samples to finish a partial model window. At most
      // 511 actual samples remain unclassified at EOF.
      module._SherpaOnnxVoiceActivityDetectorFlush(detector);
      try { drain('end-of-input', regions); return { regions, acceptedSamples: accepted, analyzedSamples: processed }; }
      catch (error) { regions.forEach((region) => region.samples.fill(0)); throw error; }
      finally { pending.fill(0); used = 0; }
    },
    close() {
      pending.fill(0);
      if (input) { module.HEAPF32.fill(0, input / 4, input / 4 + 512); module._free(input); input = 0; }
      if (detector) { module._SherpaOnnxDestroyVoiceActivityDetector(detector); detector = 0; }
    },
  };
}
