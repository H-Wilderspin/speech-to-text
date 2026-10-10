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
