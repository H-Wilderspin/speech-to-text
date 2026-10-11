import { wordErrors } from './word-errors.mjs';

/** Parse a bounded mono PCM16 WAV without persisting audio or logging transcript text. */
export function readMonoWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset, count) => String.fromCharCode(...bytes.subarray(offset, offset + count));
  if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE') throw new Error('Expected a RIFF WAV fixture.');
  let format; let data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = view.getUint32(offset + 4, true); const start = offset + 8;
    if (start + size > bytes.length) throw new Error('Truncated WAV fixture.');
    if (text(offset, 4) === 'fmt ' && size >= 16) format = {
      kind: view.getUint16(start, true), channels: view.getUint16(start + 2, true),
      rate: view.getUint32(start + 4, true), bits: view.getUint16(start + 14, true),
    };
    if (text(offset, 4) === 'data') data = { start, size };
    offset = start + size + size % 2;
  }
  if (!format || !data || format.kind !== 1 || format.channels !== 1 || format.bits !== 16
    || format.rate !== 16000 || data.size % 2 || data.size > 16000 * 2 * 60) throw new Error('Expected at most 60 seconds of mono 16 kHz PCM16.');
  return Float32Array.from({ length: data.size / 2 }, (_, i) => view.getInt16(data.start + 2 * i, true) / 32768);
}

export { streamingConfig, inspectTiming } from '../src/transcription/local/asr-config.mjs';
import { inspectTiming } from '../src/transcription/local/asr-config.mjs';

export function measureStream(recognizer, samples, reference) {
  const stream = recognizer.createStream();
  if (!stream.handle) throw new Error('ASR stream allocation failed.');
  const frames = []; const finals = []; let interimUpdates = 0; let lastText = ''; let accepted = 0;
  const started = performance.now(); let firstTextAtSamples; let finalText = '';
  const finalize = (result) => {
    if (reference) finalText += ` ${result.text}`;
    return inspectTiming(result, accepted);
  };
  try {
    for (let offset = 0; offset < samples.length; offset += 1600) {
      const before = performance.now();
      const chunk = samples.subarray(offset, Math.min(offset + 1600, samples.length));
      stream.acceptWaveform(16000, chunk); accepted += chunk.length;
      while (recognizer.isReady(stream)) recognizer.decode(stream);
      const result = recognizer.getResult(stream);
      inspectTiming(result, accepted);
      if (result.text.trim() && firstTextAtSamples === undefined) firstTextAtSamples = accepted;
      if (result.text !== lastText) { interimUpdates++; lastText = result.text; }
      if (recognizer.isEndpoint(stream)) {
        if (result.text.trim()) finals.push(finalize(result));
        recognizer.reset(stream); lastText = '';
      }
      frames.push(performance.now() - before);
    }
    stream.inputFinished(); while (recognizer.isReady(stream)) recognizer.decode(stream);
    const tail = recognizer.getResult(stream);
    if (tail.text.trim()) finals.push(finalize(tail));
    const elapsedMs = performance.now() - started;
    const sorted = [...frames].sort((a, b) => a - b);
    return {
      inputSeconds: samples.length / 16000, chunkSamples: 1600, chunks: frames.length,
      elapsedMs: Math.round(elapsedMs), realTimeFactor: elapsedMs / (samples.length / 16),
      chunkP50Ms: Math.round(sorted[Math.floor(sorted.length * .5)]), chunkP95Ms: Math.round(sorted[Math.floor(sorted.length * .95)]),
      firstTextAfterAcceptedSeconds: firstTextAtSamples === undefined ? null : firstTextAtSamples / 16000,
      interimUpdates, finals, wasmLinearMemoryBytes: recognizer.Module.HEAPU8.length,
      ...(reference ? { wordErrors: wordErrors(reference, finalText) } : {}),
    };
  } finally {
    finalText = '';
    if (stream.pointer) recognizer.Module.HEAPF32.fill(0, stream.pointer / 4, stream.pointer / 4 + stream.n);
    stream.free();
  }
}
