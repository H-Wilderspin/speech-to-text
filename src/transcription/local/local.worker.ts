import { createSharedPipeline } from './shared-pipeline.mjs';
import { SuggestedTranscript, suggestWindow } from './suggestions';
import { consumeStopCommand } from '../stop-command';
import type { AudioFrame } from '../../audio/streaming';
import type { Pipeline, ReferenceVoice } from './types';
import type { TranscriptSegment } from '../types';

let module: unknown;
let createRecognizer: unknown;
let assets: Record<string, Uint8Array> = {};
let pipeline: Pipeline | undefined;
let references: ReferenceVoice[] = [];
let transcript: SuggestedTranscript | undefined;
let stopped: TranscriptSegment[] | null = null;
let busy = false;
let lastOutput = '';

const closeSession = () => {
  pipeline?.close(); pipeline = undefined; transcript = undefined;
  references.forEach((reference) => reference.embedding.fill(0)); references = [];
};

self.onmessage = async (event: MessageEvent<{ id: number; type: string; assets?: Record<string, Uint8Array<ArrayBuffer>>; references?: ReferenceVoice[]; frame?: AudioFrame }>) => {
  const data = event.data;
  if (busy) { data.frame?.samples.fill(0); data.references?.forEach((reference) => reference.embedding.fill(0)); self.postMessage({ id: data.id, error: 'Local speech processing is busy.' }); return; }
  busy = true;
  try {
    if (data.type === 'prepare' && data.assets) {
      assets = data.assets;
      const runtimeUrl = URL.createObjectURL(new Blob([data.assets['pipeline-runtime.mjs']!], { type: 'text/javascript' }));
      const apiUrl = URL.createObjectURL(new Blob([data.assets['asr-api.mjs']!], { type: 'text/javascript' }));
      try {
        const runtime = await import(/* @vite-ignore */ runtimeUrl) as { default(config: object): Promise<unknown> };
        const api = await import(/* @vite-ignore */ apiUrl) as { createOnlineRecognizer: unknown };
        module = await runtime.default({ wasmBinary: assets['pipeline-runtime.wasm'], locateFile: () => runtimeUrl, print: () => {}, printErr: () => {} });
        createRecognizer = api.createOnlineRecognizer;
      } finally { URL.revokeObjectURL(runtimeUrl); URL.revokeObjectURL(apiUrl); }
      // Eagerly initialize once so the first microphone frame does not pay model startup.
      pipeline = await createSharedPipeline(module, createRecognizer, assets, undefined, { windowGate: 'energy', inspectEmbedding: (window) => {
        transcript?.addWindow(suggestWindow(window, references));
      } });
      // Native models own their initialized weights. Reset only needs the small
      // VAD file; release JS copies of the large ASR and embedding files.
      for (const name of Object.keys(assets)) if (name !== 'silero_vad.onnx') delete assets[name];
      self.postMessage({ id: data.id });
    } else if (data.type === 'start') {
      references.forEach((reference) => reference.embedding.fill(0));
      references = data.references ?? [];
      if (!references.length || references.some((reference) => !reference.id || !reference.name || reference.embedding.length !== 192 || !reference.embedding.every(Number.isFinite))) throw new Error('No compatible saved voiceprints are available.');
      if (!pipeline) throw new Error('Prepare local listening before starting.');
      transcript = new SuggestedTranscript(references); stopped = null; lastOutput = '';
      self.postMessage({ id: data.id });
    } else if (pipeline && transcript && (data.type === 'frame' || data.type === 'finish')) {
      const result = data.type === 'finish' ? pipeline.finish() : pipeline.accept(data.frame!);
      const segments = stopped ?? transcript.update(result, data.type === 'finish');
      stopped ??= consumeStopCommand(segments);
      const output = stopped ?? segments;
      const serialized = JSON.stringify(output);
      if (data.type === 'finish') {
        references.forEach((reference) => reference.embedding.fill(0)); references = []; transcript = undefined;
        pipeline.reset();
      }
      self.postMessage({ id: data.id, commandStop: stopped !== null, ...(serialized !== lastOutput ? { segments: output } : {}) });
      lastOutput = serialized;
    } else throw new Error('Prepare local listening before starting.');
  } catch (error) {
    closeSession();
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Local listening failed. Switch to browser captions in Settings.' });
  } finally { data.frame?.samples.fill(0); busy = false; }
};
