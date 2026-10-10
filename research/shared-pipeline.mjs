import { createSpeechDetector } from './speech-regions.mjs';
import { createExtractor } from './speaker-inference.mjs';
import { streamingConfig, inspectTiming } from './asr-streaming.mjs';
import { SampleWindow } from './sample-window.mjs';

/** Research composition: ASR and speech-region embeddings consume the same PCM.
 * Regions are NOT known single-speaker turns and never produce identity labels. */
export async function createSharedPipeline(module, createOnlineRecognizer, assets, inspectRegion = () => {}) {
  let recognizer; let stream; let vad; let extractor;
  let accepted = 0; let clockId; let finished = false;
  const history = new SampleWindow(); let nextWindowAt = 48000;
  const close = () => {
    history.close();
    if (stream) {
      if (stream.pointer) module.HEAPF32.fill(0, stream.pointer / 4, stream.pointer / 4 + stream.n);
      stream.free(); stream = undefined;
    }
    recognizer?.free(); recognizer = undefined;
    vad?.close(); vad = undefined; extractor?.close(); extractor = undefined;
  };
  try {
    module._CopyHeap = (source, length, target) => module.HEAPU8.copyWithin(target, source, source + length);
    const names = ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt'];
    try {
      for (const name of names) module.FS.writeFile(`/${name}`, assets[name]);
      recognizer = createOnlineRecognizer(module, streamingConfig());
    } finally { for (const name of names) { if (module.FS.analyzePath(`/${name}`).exists) module.FS.unlink(`/${name}`); } }
    if (!recognizer.handle) throw new Error('ASR could not initialize.');
    stream = recognizer.createStream(); if (!stream.handle) throw new Error('ASR stream could not initialize.');
    vad = createSpeechDetector(module, assets['silero_vad.onnx']);
    extractor = await createExtractor(module, assets['embedding.onnx']);
    if (extractor.dimension !== 192) throw new Error('Expected the English 192-dimensional speaker model.');
  } catch (error) { close(); throw error; }
  const describeRegions = (regions) => {
    try {
      return regions.map((region) => {
        inspectRegion(region);
        return { clockId, startSample: region.startSample, endSample: region.endSample, reason: region.reason,
          analysisWindowStartSample: region.analysisWindowStartSample,
          speaker: 'Unknown', singleSpeakerVerified: false };
      });
    } finally { regions.forEach((region) => region.samples.fill(0)); }
  };
  const describeWindow = () => {
    if (accepted < nextWindowAt) return [];
    nextWindowAt = accepted + 24000;
    // Detector state gates compute cost only. It does not prove the whole window
    // contains speech, one speaker, or a known identity.
    if (!vad.isDetected()) return [];
    const window = history.latest(); if (!window) return [];
    let embedding;
    try {
      inspectRegion(window); const started = performance.now(); embedding = extractor.compute(window.samples);
      if (!embedding.every(Number.isFinite) || Math.hypot(...embedding) === 0) throw new Error('Invalid window embedding.');
      return [{ clockId, startSample: window.startSample, endSample: window.endSample, embeddingDimension: embedding.length,
        embeddingMs: performance.now() - started, speaker: 'Unknown', singleSpeakerVerified: false }];
    } finally { window.samples.fill(0); embedding?.fill(0); }
  };
  const result = (finishing, regions, windows, started) => {
    while (recognizer.isReady(stream)) recognizer.decode(stream);
    const output = recognizer.getResult(stream); const timing = inspectTiming(output, accepted);
    const isFinal = finishing || recognizer.isEndpoint(stream);
    const response = { type: 'result', text: output.text, isFinal, timing, clockId, regions, windows,
      acceptedSamples: accepted, processingMs: performance.now() - started, wasmLinearMemoryBytes: module.HEAPU8.length };
    if (isFinal && !finishing) recognizer.reset(stream);
    return response;
  };
  return {
    accept(frame) {
      if (!stream || finished || frame.sampleRate !== 16000 || frame.startSample !== accepted || !frame.clockId
        || (clockId && frame.clockId !== clockId)) throw new Error('Pipeline input clock lost continuity.');
      if (!(frame.samples instanceof Float32Array) || !frame.samples.length || frame.samples.length > 1600 || !frame.samples.every(Number.isFinite)) throw new Error('Invalid pipeline audio.');
      clockId = frame.clockId; const started = performance.now();
      history.push(frame.samples, frame.startSample);
      stream.acceptWaveform(16000, frame.samples); accepted += frame.samples.length;
      const regions = describeRegions(vad.accept(frame.samples, frame.startSample));
      return result(false, regions, describeWindow(), started);
    },
    finish() {
      if (!stream || finished) throw new Error('Pipeline stream is closed.');
      finished = true; const started = performance.now(); stream.inputFinished();
      const tail = vad.finish();
      return { ...result(true, describeRegions(tail.regions), [], started), unclassifiedTailSamples: tail.acceptedSamples - tail.analyzedSamples };
    },
    close,
  };
}
