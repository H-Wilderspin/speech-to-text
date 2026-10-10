import { readFile } from 'node:fs/promises';
import { readMonoWav, streamingConfig, measureStream } from './asr-streaming.mjs';
import { syntheticPhrase } from './word-errors.mjs';
const root = new URL('./private/asr-runtime/', import.meta.url);
const { default: createModule } = await import(new URL('asr-runtime.mjs', root));
const { createOnlineRecognizer } = await import(new URL('asr-api.cjs', root));
const module = await createModule({ wasmBinary: await readFile(new URL('asr-runtime.wasm', root)), print: () => {}, printErr: () => {} });
module._CopyHeap = (source, length, target) => module.HEAPU8.copyWithin(target, source, source + length);
for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt']) module.FS.writeFile(`/${name}`, await readFile(new URL(name, root)));
const recognizer = createOnlineRecognizer(module, streamingConfig());
if (!recognizer.handle) throw new Error('Could not create startup experiment recognizer.');
for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt']) module.FS.unlink(`/${name}`);
const speech = readMonoWav(await readFile(new URL('synthetic.wav', root)));
try {
  const runs = [];
  for (const leadingSilenceSeconds of [0, .5, 1, 2, 3]) {
    const sequence = new Float32Array(speech.length + (leadingSilenceSeconds + 3) * 16000);
    sequence.set(speech, leadingSilenceSeconds * 16000);
    try {
      const report = measureStream(recognizer, sequence, syntheticPhrase);
      runs.push({ leadingSilenceSeconds, ...report,
        firstTextAfterFixtureStartSeconds: report.firstTextAfterAcceptedSeconds === null ? null : report.firstTextAfterAcceptedSeconds - leadingSilenceSeconds });
    } finally { sequence.fill(0); }
  }
  console.log(JSON.stringify({ fixture: 'generated-speech-one-phrase-not-human-accuracy', runs }, null, 2));
} finally { speech.fill(0); recognizer.free(); }
