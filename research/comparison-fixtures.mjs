import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readMonoWav } from './asr-streaming.mjs';
import { normalize } from './comparison-metrics.mjs';
const root = new URL('./private/comparison/', import.meta.url);
const clips = JSON.parse((await readFile(new URL('clips.json', root), 'utf8')).replace(/^\uFEFF/, '')).clips;
for (const clip of clips) {
  clip.audio = readMonoWav(await readFile(new URL(`${clip.id}.wav`, root)));
  if (normalize(clip.text).join(' ') !== normalize(clip.words.map((w) => w.text).join(' ')).join(' ')) throw new Error('Synthetic word metadata differs from script');
}
const definitions = [
  { id: 'known-long', clips: ['Hazel-shopping', 'Hazel-ending'], gap: 1.5 },
  { id: 'known-unknown-known', clips: ['Hazel-breakfast', 'Zira-shopping', 'Hazel-ending'], gap: 0 },
  { id: 'two-enrolled', clips: ['Hazel-breakfast', 'Zira-shopping', 'Hazel-ending'], gap: 0, enrolled: ['Hazel', 'Zira'] },
  { id: 'short-and-pause', clips: ['Hazel-short', 'Hazel-breakfast'], gap: 5 },
  { id: 'intentional-repeat', clips: ['Hazel-breakfast', 'Hazel-breakfast'], gap: 1.5 },
  { id: 'unknown-only', clips: ['Zira-shopping', 'Zira-ending'], gap: 1 },
  { id: 'overlap', clips: ['Hazel-shopping', 'Zira-ending'], gap: -3, overlap: true },
  { id: 'silence', clips: [], gap: 0 },
];
function wav(samples) {
  const output = Buffer.alloc(44 + samples.length * 2);
  output.write('RIFF'); output.writeUInt32LE(output.length - 8, 4); output.write('WAVEfmt ', 8);
  output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(1, 22);
  output.writeUInt32LE(16000, 24); output.writeUInt32LE(32000, 28); output.writeUInt16LE(2, 32); output.writeUInt16LE(16, 34);
  output.write('data', 36); output.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, index) => output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(value * 32768))), 44 + index * 2));
  return output;
}
const fixtures = [];
for (const definition of definitions) {
  let offset = 16000; const playback = []; const words = [];
  const enrolled = definition.enrolled ?? ['Hazel'];
  for (const [index, id] of definition.clips.entries()) {
    const clip = clips.find((c) => c.id === id);
    playback.push({ clip: id, voice: clip.voice, start: offset / 16000, end: (offset + clip.audio.length) / 16000, cluster: index });
    words.push(...clip.words.map((word) => ({ text: word.text, start: offset / 16000 + word.start, utterance: index,
      ...(enrolled.includes(clip.voice) ? { speakerId: clip.voice } : {}) })));
    offset += clip.audio.length + Math.round(definition.gap * 16000);
  }
  const samples = new Float32Array(Math.max(10 * 16000, ...playback.map((p) => Math.round(p.end * 16000) + 48000)));
  for (const part of playback) {
    const audio = clips.find((c) => c.id === part.clip).audio;
    for (let i = 0; i < audio.length; i++) samples[Math.round(part.start * 16000) + i] += audio[i] * (definition.overlap ? .5 : 1);
  }
  if (samples.length > 30 * 16000) throw new Error('Fixture exceeds diarizer bound');
  const bytes = wav(samples); await writeFile(new URL(`${definition.id}.wav`, root), bytes);
  fixtures.push({ id: definition.id, duration: samples.length / 16000, enrolled, overlap: !!definition.overlap,
    sha256: createHash('sha256').update(bytes).digest('hex'), playback, words });
}
await writeFile(new URL('manifest.json', root), JSON.stringify({ synthetic: true, sampleRate: 16000,
  wordTiming: 'System.Speech AudioPosition onsets; playback bounds include padding, not hand-labelled speech boundaries', fixtures }, null, 2));
console.log(JSON.stringify({ fixtures: fixtures.length, audioSeconds: fixtures.reduce((sum, f) => sum + f.duration, 0) }));
