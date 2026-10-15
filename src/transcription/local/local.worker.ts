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
let voiceCommands = true;

const closeSession = () => {
  pipeline?.close(); pipeline = undefined; transcript = undefined;
  references.forEach((reference) => reference.embedding.fill(0)); references = [];
};

self.onmessage = async (event: MessageEvent<{ id: number; sessionId?: number; type: string; assets?: Record<string, Uint8Array<ArrayBuffer>>; references?: ReferenceVoice[]; frame?: AudioFrame; voiceCommands?: boolean; debugSpeakers?: boolean }>) => {
  const data = event.data;
  const reply = (payload: object = {}) => self.postMessage({ id: data.id, sessionId: data.sessionId, ...payload });
  if (busy) { data.frame?.samples.fill(0); data.references?.forEach((reference) => reference.embedding.fill(0)); reply({ error: 'Local speech processing is busy.' }); return; }
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
      reply();
    } else if (data.type === 'reset') {
      pipeline?.reset(); transcript = undefined; stopped = null; lastOutput = '';
      references.forEach((reference) => reference.embedding.fill(0)); references = [];
      reply();
    } else if (data.type === 'start') {
      voiceCommands = data.voiceCommands !== false;
      references.forEach((reference) => reference.embedding.fill(0));
      references = data.references ?? [];
      if (!references.length || references.some((reference) => !reference.id || !reference.name || reference.embedding.length !== 192 || !reference.embedding.every(Number.isFinite))) throw new Error('No compatible saved voiceprints are available.');
      if (!pipeline) throw new Error('Prepare local listening before starting.');
      transcript = new SuggestedTranscript(references); stopped = null; lastOutput = '';
      reply();
    } else if (pipeline && transcript && (data.type === 'frame' || data.type === 'finish')) {
      const started = performance.now();
      const result = data.type === 'finish' ? pipeline.finish() : pipeline.accept(data.frame!);
      const pipelineMs = performance.now() - started;
      const segments = stopped ?? transcript.update(result, data.type === 'finish');
      if (voiceCommands) stopped ??= consumeStopCommand(segments);
      const output = stopped ?? segments;
      const speakerStatus = transcript.getStatus();
      const serialized = JSON.stringify({ output, speakerStatus });
      const diagnostics = data.debugSpeakers ? { ...transcript.getDiagnostics(result.acceptedSamples),
        acceptedSamples: result.acceptedSamples, segment: result.timing.segment, endpoint: result.isFinal,
        localCharacters: result.text.length, tokens: result.tokenPoints.length,
        pipelineMs: Math.round(pipelineMs), attributionMs: Math.round(performance.now() - started - pipelineMs),
        outputChanged: serialized !== lastOutput, assignedSegments: output.filter((segment) => segment.speakerId).length } : undefined;
      if (data.type === 'finish') {
        references.forEach((reference) => reference.embedding.fill(0)); references = []; transcript = undefined;
        pipeline.reset();
      }
      reply({ commandStop: stopped !== null, ...(diagnostics ? { diagnostics } : {}), ...(serialized !== lastOutput ? { segments: output.map((segment) => ({ ...segment, sessionId: data.sessionId })), speakerStatus } : {}) });
      lastOutput = serialized;
    } else throw new Error('Prepare local listening before starting.');
  } catch (error) {
    closeSession();
    reply({ error: error instanceof Error ? error.message : 'Local listening failed. Switch to browser captions in Settings.' });
  } finally { data.frame?.samples.fill(0); busy = false; }
};
