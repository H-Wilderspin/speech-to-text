import { streamingConfig, inspectTiming } from './asr-streaming.mjs';

let recognizer; let stream; let accepted = 0; let clockId;
const bytes = async (name) => {
  const response = await fetch(new URL(`./private/asr-runtime/${name}`, import.meta.url));
  if (!response.ok) throw new Error('ASR assets could not load. Run the research preparation steps.');
  return new Uint8Array(await response.arrayBuffer());
};
self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'prepare') {
      if (recognizer) throw new Error('ASR is already prepared.');
      const [{ default: createModule }, { createOnlineRecognizer }, wasm] = await Promise.all([
        import('./private/asr-runtime/asr-runtime.mjs'), import('./private/asr-runtime/asr-api.mjs'), bytes('asr-runtime.wasm'),
      ]);
      const module = await createModule({ wasmBinary: wasm, print: () => {}, printErr: () => {} });
      module._CopyHeap = (source, length, target) => module.HEAPU8.copyWithin(target, source, source + length);
      for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt']) module.FS.writeFile(`/${name}`, await bytes(name));
      recognizer = createOnlineRecognizer(module, streamingConfig());
      if (!recognizer.handle) throw new Error('ASR could not initialize.');
      for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt']) module.FS.unlink(`/${name}`);
      stream = recognizer.createStream();
      if (!stream.handle) throw new Error('ASR stream could not initialize.');
      self.postMessage({ id, type: 'ready' }); return;
    }
    if (!stream) throw new Error('Prepare ASR first.');
    const started = performance.now();
    if (type === 'frame') {
      const frame = data.frame;
      if (frame.sampleRate !== 16000 || frame.startSample !== accepted || !frame.samples?.length
        || (clockId && frame.clockId !== clockId)) throw new Error('ASR input clock lost continuity.');
      clockId = frame.clockId;
      stream.acceptWaveform(16000, frame.samples); accepted += frame.samples.length;
    } else if (type === 'finish') stream.inputFinished();
    else throw new Error('Unknown ASR request.');
    while (recognizer.isReady(stream)) recognizer.decode(stream);
    const result = recognizer.getResult(stream);
    const timing = inspectTiming(result, accepted);
    const isFinal = type === 'finish' || recognizer.isEndpoint(stream);
    self.postMessage({ id, type: 'result', text: result.text, isFinal, timing, clockId,
      acceptedSamples: accepted, processingMs: performance.now() - started,
      wasmLinearMemoryBytes: recognizer.Module.HEAPU8.length });
    if (isFinal && type !== 'finish') recognizer.reset(stream);
    if (type === 'finish') {
      if (stream.pointer) recognizer.Module.HEAPF32.fill(0, stream.pointer / 4, stream.pointer / 4 + stream.n);
      stream.free(); recognizer.free(); stream = undefined; recognizer = undefined;
    }
  } catch (error) { self.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : 'Local ASR failed.' }); }
  finally { data.frame?.samples?.fill(0); }
};
