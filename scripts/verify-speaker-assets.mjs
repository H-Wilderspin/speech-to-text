import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('speaker-assets.json', root), 'utf8'));
for (const [name, expected] of [
  ['embedding.onnx', config.sha256], ['speaker-runtime.wasm', config.wasmSha256], ['speaker-runtime.mjs', config.runtimeSha256],
]) {
  const bytes = await readFile(new URL(`public/speaker/v1/${name}`, root));
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) throw new Error(`Static speaker asset checksum mismatch: ${name}`);
}
const notices = await readFile(new URL('public/speaker/THIRD-PARTY-NOTICES.txt', root), 'utf8');
if (!notices.includes('ONNX Runtime') || !notices.includes('Mozilla Public License')) throw new Error('Speaker notices are incomplete.');
console.log('Static speaker assets match the pinned model/runtime checksums; notices present.');
const localFiles = JSON.parse((await readFile(new URL('local-assets.json', root), 'utf8')).replace(/^\uFEFF/, ''));
for (const file of localFiles) {
  const bytes = await readFile(new URL(`public/local/v1/${file.name}`, root));
  if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.hash) throw new Error(`Local speech asset checksum mismatch: ${file.name}`);
}
const localNotices = await readFile(new URL('public/local/THIRD-PARTY-NOTICES.txt', root), 'utf8');
if (!localNotices.includes('Silero') || !localNotices.includes('Zipformer')) throw new Error('Local speech model notices are incomplete.');
console.log('Optional local speech assets match pinned checksums; notices present.');
const asr = JSON.parse(await readFile(new URL('local-asr-assets.json', root), 'utf8'));
const encoderHash = createHash('sha256'); let encoderBytes = 0;
for (const file of [...asr.encoder.parts, ...asr.files]) {
  const bytes = await readFile(new URL(`public/local/v2/${file.name}`, root));
  if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.hash) throw new Error(`Upgraded ASR asset checksum mismatch: ${file.name}`);
  if (asr.encoder.parts.includes(file)) { encoderHash.update(bytes); encoderBytes += bytes.length; }
}
if (encoderBytes !== asr.encoder.bytes || encoderHash.digest('hex') !== asr.encoder.hash) throw new Error('Reassembled ASR encoder differs from the pinned upstream model.');
if (!localNotices.includes('9a65b6ea94c311ca770c2bf895b30f456a22d703')) throw new Error('Upgraded model provenance notice is missing.');
console.log('Upgraded ASR files and reassembled encoder match pinned upstream checksums.');
