import { readMonoWav, streamingConfig, measureStream } from './asr-streaming.mjs';

self.onmessage = async () => {
  let recognizer; let speech; let sequence;
  const started = performance.now();
  const bytes = async (name) => {
    const response = await fetch(new URL(`./private/asr-runtime/${name}`, import.meta.url));
    if (!response.ok) throw new Error(`Could not load ${name}. Run the ASR preparation steps.`);
    return new Uint8Array(await response.arrayBuffer());
  };
  try {
    self.postMessage({ phase: 'loading' });
    const [{ default: createModule }, { createOnlineRecognizer }, wasm] = await Promise.all([
      import('./private/asr-runtime/asr-runtime.mjs'), import('./private/asr-runtime/asr-api.mjs'), bytes('asr-runtime.wasm'),
    ]);
    const initializing = performance.now();
    const module = await createModule({ wasmBinary: wasm, print: () => {}, printErr: () => {} });
    const runtimeMs = performance.now() - initializing;
    module._CopyHeap = (source, length, target) => module.HEAPU8.copyWithin(target, source, source + length);
    for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt']) module.FS.writeFile(`/${name}`, await bytes(name));
    const loading = performance.now(); recognizer = createOnlineRecognizer(module, streamingConfig());
    if (!recognizer.handle) throw new Error('Could not initialize streaming ASR.');
    const modelLoadMs = performance.now() - loading;
    for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt']) module.FS.unlink(`/${name}`);
    speech = readMonoWav(await bytes('synthetic.wav'));
    sequence = new Float32Array(speech.length * 2 + 16000 * 6);
    sequence.set(speech); sequence.set(speech, speech.length + 16000 * 3);
    self.postMessage({ phase: 'processing' });
    const runs = [measureStream(recognizer, sequence), measureStream(recognizer, sequence)];
    if (runs.some((run) => run.finals.length < 2 || !run.finals.some((result) => result.startSeconds > 0))) throw new Error('No timed utterances across reset.');
    self.postMessage({ phase: 'complete', report: { runtimeMs: Math.round(runtimeMs), modelLoadMs: Math.round(modelLoadMs),
      totalMs: Math.round(performance.now() - started), runs, liveMicrophoneTested: false, speakerAttributionTested: false } });
  } catch (error) { self.postMessage({ phase: 'error', message: error instanceof Error ? error.message : 'ASR experiment failed.' }); }
  finally { speech?.fill(0); sequence?.fill(0); recognizer?.free(); }
};
