import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readMonoWav, streamingConfig, measureStream } from './asr-streaming.mjs';

const root = new URL('./private/asr-runtime/', import.meta.url);
const { default: createModule } = await import(new URL('asr-runtime.mjs', root));
const { createOnlineRecognizer } = await import(new URL('asr-api.cjs', root));
const wasm = await readFile(new URL('asr-runtime.wasm', root));
const initialized = performance.now();
const initializationErrors = [];
let initializing = true;
const diagnostic = (line) => { if (initializing && initializationErrors.length < 20) initializationErrors.push(line); };
const module = await createModule({ wasmBinary: wasm, print: diagnostic, printErr: diagnostic });
// Upstream's wrapper needs only this memcpy helper from its original main program.
module._CopyHeap = (source, length, target) => module.HEAPU8.copyWithin(target, source, source + length);
const runtimeMs = performance.now() - initialized;
for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt']) module.FS.writeFile(`/${name}`, await readFile(new URL(name, root)));
const loading = performance.now(); const recognizer = createOnlineRecognizer(module, streamingConfig());
if (!recognizer.handle) throw new Error(`Recognizer creation failed: ${initializationErrors.join('\n')}`);
initializing = false; initializationErrors.length = 0;
const modelLoadMs = performance.now() - loading;
for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt']) module.FS.unlink(`/${name}`);
// Our synthetic fixture contains only a fixed, non-personal test phrase.
const fixture = new URL('synthetic.wav', root);
const speech = readMonoWav(await readFile(process.argv[2] ?? fixture));
const sequence = new Float32Array(speech.length * 2 + 16000 * 6);
sequence.set(speech); sequence.set(speech, speech.length + 16000 * 3);
try {
  const runs = [measureStream(recognizer, sequence), measureStream(recognizer, sequence)];
  if (runs.some((run) => run.finals.length < 2 || !run.finals.some((result) => result.startSeconds > 0))) throw new Error('No evidence of timestamped utterances across reset.');
  console.log(JSON.stringify({ runtime: process.version, platform: process.platform,
    fixture: process.argv[2] ? 'explicit-local-fixture' : 'windows-synthetic-speech-repeated-with-three-second-gaps',
    wasmSha256: createHash('sha256').update(wasm).digest('hex'), runtimeMs: Math.round(runtimeMs), modelLoadMs: Math.round(modelLoadMs), runs,
    liveMicrophoneTested: false, speakerAttributionTested: false, acousticBoundaryAccuracyMeasured: false,
  }, null, 2));
} finally { speech.fill(0); sequence.fill(0); recognizer.free(); }
