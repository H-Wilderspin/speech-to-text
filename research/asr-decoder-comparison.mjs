import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import createModule from '../public/local/v1/pipeline-runtime.mjs';
import { readMonoWav, measureStream, streamingConfig } from './asr-streaming.mjs';

// Uses public model weights and generated fixtures; prints aggregate errors only.
// Optional argument: upstream test_wavs directory containing 0.wav/1.wav/trans.txt.
const modelRoot = new URL('../public/local/v1/', import.meta.url);
// The distributed API contains a Node-only CommonJS branch. Evaluate its trusted
// pinned code in a browser-like scope, removing only the appended ES export.
const api = await readFile(new URL('asr-api.mjs', modelRoot), 'utf8');
const createOnlineRecognizer = runInNewContext(api.replace(/export \{ createOnlineRecognizer \};\s*$/, '') + '\ncreateOnlineRecognizer;');
const module = await createModule({ wasmBinary: await readFile(new URL('pipeline-runtime.wasm', modelRoot)), print() {}, printErr() {} });
module._CopyHeap = (source, length, target) => module.HEAPU8.copyWithin(target, source, source + length);
const asr = JSON.parse(await readFile(new URL('../local-asr-assets.json', import.meta.url), 'utf8'));
const phrase = 'The morning is bright and the room is quiet. Please bring a glass of water to the table.';
const fixtureRoot = new URL('../tests/fixtures/', import.meta.url);
const fixtures = [
  { name: 'generated-a-profile', url: new URL('voice-a-profile.wav', fixtureRoot), reference: 'We walked through the garden beside the old station. There were flowers along the path and a small wooden bench under a tree.' },
  { name: 'generated-a-speech', url: new URL('voice-a-speech.wav', fixtureRoot), reference: phrase },
  { name: 'generated-b-speech', url: new URL('voice-b-speech.wav', fixtureRoot), reference: phrase },
];
if (process.argv[2]) {
  const root = pathToFileURL(`${resolve(process.argv[2])}/`);
  const references = (await readFile(new URL('trans.txt', root), 'utf8')).trim().split(/\r?\n/);
  for (const name of ['0.wav', '1.wav']) {
    const reference = references.find((line) => line.startsWith(`${name} `))?.slice(name.length + 1);
    if (!reference) throw new Error(`Missing public reference for ${name}.`);
    fixtures.push({ name: `upstream-${name}`, url: new URL(name, root), reference });
  }
}
const reports = [];
for (const model of ['small-20m', 'libri-giga-v2']) {
  for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt']) {
    let bytes;
    if (model === 'small-20m' || name === 'tokens.txt') bytes = await readFile(new URL(name, modelRoot));
    else if (name === 'encoder.onnx') {
      bytes = new Uint8Array(asr.encoder.bytes); let offset = 0;
      for (const part of asr.encoder.parts) {
        const data = await readFile(new URL(`../public/local/v2/${part.name}`, import.meta.url)); bytes.set(data, offset); offset += data.length;
      }
    } else bytes = await readFile(new URL(`../public/local/v2/${name}`, import.meta.url));
    module.FS.writeFile(`/${name}`, bytes);
  }
  for (const decodingMethod of ['greedy_search', 'modified_beam_search']) {
    const recognizer = createOnlineRecognizer(module, { ...streamingConfig(), decodingMethod, maxActivePaths: 4 });
    if (!recognizer.handle) throw new Error('Decoder comparison could not initialize.');
    const runs = [];
    try {
      for (const fixture of fixtures) {
        const speech = readMonoWav(await readFile(fixture.url));
        try {
          for (const precedingSilenceSeconds of (fixture.name.startsWith('generated-') ? [0, 1] : [0])) {
            const samples = new Float32Array(speech.length + (precedingSilenceSeconds + 3) * 16000);
            samples.set(speech, precedingSilenceSeconds * 16000);
            try {
              const report = measureStream(recognizer, samples, fixture.reference);
              runs.push({ fixture: fixture.name, precedingSilenceSeconds, ...report.wordErrors, elapsedMs: report.elapsedMs,
                realTimeFactor: report.realTimeFactor, firstTextAfterAcceptedSeconds: report.firstTextAfterAcceptedSeconds });
            } finally { samples.fill(0); }
          }
        } finally { speech.fill(0); }
      }
    } finally { recognizer.free(); }
    reports.push({ model, decodingMethod, maxActivePaths: 4, wasmLinearMemoryBytes: module.HEAPU8.length, runs });
  }
}
console.log(JSON.stringify({ fixtureScope: 'generated/public clips, not phone or conversational accuracy', reports }, null, 2));
