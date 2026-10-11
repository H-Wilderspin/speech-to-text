import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Repack verified public weights only. No network, audio, profiles or private keys.
const source = pathToFileURL(`${resolve(process.argv[2] ?? '../sherpa-onnx/wasm/vad-asr/assets')}/`);
const output = new URL('../public/local/v2/', import.meta.url);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const expected = {
  'encoder.onnx': '32c98281c7bd8b63e3e142d007251b37f120572e8fdea9a4f5a79ce22b10ec4f',
  'decoder.onnx': '9da02b77cb08826756ec6a88635f35a40374e4164e7c6359121a9145958a6ceb',
  'joiner.onnx': '831477d390e59a61f1b6a6f763b9903e6c6366ff6034f1ddba613be82637122f',
};
const verified = {};
for (const [name, hash] of Object.entries(expected)) {
  const bytes = await readFile(new URL(name, source));
  if (sha256(bytes) !== hash) throw new Error(`Incorrect public model source: ${name}`);
  verified[name] = bytes;
}
await mkdir(output, { recursive: true });
const encoder = verified['encoder.onnx']; const parts = [];
const write = async (name, bytes) => {
  await writeFile(new URL(name, output), bytes);
  return { name, bytes: bytes.length, hash: sha256(bytes) };
};
for (let start = 0; start < encoder.length; start += 64 * 1024 * 1024) {
  parts.push(await write(`encoder.part${parts.length + 1}.bin`, encoder.subarray(start, start + 64 * 1024 * 1024)));
}
const files = [];
for (const name of ['decoder.onnx', 'joiner.onnx']) files.push(await write(name, verified[name]));
const manifest = {
  version: 'zipformer-libri-giga-v2',
  source: 'https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-21/tree/9a65b6ea94c311ca770c2bf895b30f456a22d703',
  encoder: { bytes: encoder.length, hash: expected['encoder.onnx'], parts }, files,
};
await writeFile(new URL('../local-asr-assets.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${encoder.length + files.reduce((total, file) => total + file.bytes, 0)} bytes of verified ASR weights in files below GitHub's 100 MB limit.`);
