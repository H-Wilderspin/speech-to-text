import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Read-only, no microphone and no model execution/download. Pass the Emscripten .js file.
const gluePath = process.argv[2];
if (!gluePath?.endsWith('.js')) {
  console.error('Usage: npm run spike -- <path/to/sherpa-onnx-wasm-main-speaker-diarization.js>');
  process.exitCode = 1;
} else {
  const fullPath = resolve(gluePath);
  const stem = fullPath.slice(0, -3);
  const [glue, wasm, dataInfo] = await Promise.all([
    readFile(fullPath, 'utf8'), readFile(`${stem}.wasm`), stat(`${stem}.data`),
  ]);
  const names = ['SherpaOnnxCreateOfflineSpeakerDiarization', 'SherpaOnnxOfflineSpeakerDiarizationProcess',
    'SherpaOnnxCreateSpeakerEmbeddingExtractor', 'SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding'];
  const bindings = Object.fromEntries(names.map((name) => [name, glue.includes(`_${name}`)]));
  const module = await WebAssembly.compile(wasm);
  console.log(JSON.stringify({
    artifact: basename(fullPath), runtime: process.version, platform: process.platform,
    wasmSha256: createHash('sha256').update(wasm).digest('hex'),
    bytes: { glue: Buffer.byteLength(glue), wasm: wasm.length, packagedModels: dataInfo.size },
    wasmExportCount: WebAssembly.Module.exports(module).length,
    bindings,
    conclusion: bindings.SherpaOnnxCreateSpeakerEmbeddingExtractor
      ? 'Embedding binding exists; preprocessing, licence, memory, accuracy and device inference still need evaluation.'
      : 'This wrapper cannot create reusable voice embeddings. Diarization clusters are not enrolled identities.',
    inferenceMeasured: false,
  }, null, 2));
}
