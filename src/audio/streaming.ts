import workletUrl from './stream-worklet.js?url&no-inline';
import { watchInterruptions } from './interruption';

export interface AudioFrame {
  clockId: string;
  sampleRate: 16000;
  startSample: number;
  samples: Float32Array;
}
export interface AudioCapture {
  /** Resolves after Stop drains all captured frames; cancellation/errors reject. */
  done: Promise<void>;
  stop(): void;
}

export function streamingUnavailableReason(): string | undefined {
  return !globalThis.isSecureContext ? 'Local listening needs HTTPS.'
    : !globalThis.AudioContext || !globalThis.AudioWorkletNode || !navigator.mediaDevices?.getUserMedia
      ? 'This browser cannot capture audio for local listening.' : undefined;
}

/** Call on a user gesture, after preparing inference. Consume frames in order;
 * resolve only when processing has finished. Samples may be transferred to a
 * worker; otherwise this adapter erases them after consumption. Abort also needs
 * to terminate any consumer worker. Audio timestamps never use wall-clock time. */
export function startAudioCapture(signal: AbortSignal, consume: (frame: AudioFrame) => Promise<void>, ready: () => void = () => {}): AudioCapture {
  let resolveDone!: () => void; let rejectDone!: (reason: unknown) => void;
  const done = new Promise<void>((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
  let context: AudioContext | undefined; let stream: MediaStream | undefined;
  let node: AudioWorkletNode | undefined; let source: MediaStreamAudioSourceNode | undefined;
  let settled = false; let stopping = false; let ended = false; let pumping = false;
  let receivedSamples = 0; let lastFrameAt = performance.now();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setInterval> | undefined;
  let unwatch = () => {};
  const clockId = crypto.randomUUID();
  const queue: AudioFrame[] = []; let active: AudioFrame | undefined;
  const erase = (frame: AudioFrame) => { if (frame.samples.byteLength) frame.samples.fill(0); };
  const stopTracks = () => {
    const tracks = stream?.getTracks(); stream = undefined;
    tracks?.forEach((track) => { track.onended = null; track.onmute = null; track.stop(); });
  };
  const cleanup = () => {
    clearTimeout(deadline); clearInterval(watchdog); unwatch();
    signal.removeEventListener('abort', abort);
    if (context) context.onstatechange = null;
    if (node) { node.port.postMessage({ type: 'cancel' }); node.port.onmessage = null; node.port.close(); node.disconnect(); }
    source?.disconnect(); stopTracks();
    void context?.close().catch(() => {});
    queue.splice(0).forEach(erase); if (active) erase(active);
  };
  const fail = (reason: unknown) => { if (!settled) { settled = true; cleanup(); rejectDone(reason); } };
  const abort = () => fail(signal.reason ?? new DOMException('Cancelled', 'AbortError'));
  const finish = () => { if (!settled && ended && !pumping && !queue.length) { settled = true; cleanup(); resolveDone(); } };
  const pump = async () => {
    if (pumping || settled) return;
    pumping = true;
    try {
      while (!settled && queue.length) {
        active = queue.shift()!;
        await consume(active);
        erase(active);
        if (!settled) node?.port.postMessage({ type: 'ack', startSample: active.startSample });
        active = undefined;
      }
    } catch (error) { fail(error); }
    finally { pumping = false; finish(); }
  };
  const stop = () => {
    if (settled || stopping) return;
    stopping = true;
    if (!node) { ended = true; finish(); return; }
    clearInterval(watchdog); clearTimeout(deadline);
    // Keep the context rendering until the worklet flushes its final partial frame.
    node.port.postMessage({ type: 'stop' });
    deadline = setTimeout(() => fail(new Error('Audio processing did not finish. Try again.')), 5000);
  };
  try {
    signal.throwIfAborted();
    const unavailable = streamingUnavailableReason(); if (unavailable) throw new Error(unavailable);
    context = new AudioContext({ sampleRate: 16000 });
    if (context.sampleRate !== 16000) throw new Error('This browser cannot capture at the required 16 kHz sample rate.');
    signal.addEventListener('abort', abort, { once: true });
    unwatch = watchInterruptions(() => fail(new Error('Local listening was interrupted. Keep this page open and start again.')));
    deadline = setTimeout(() => fail(new Error('Microphone permission timed out. Check site settings and try again.')), 30000);
    const resume = context.resume();
    const permission = navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
    void permission.then((received) => {
      if (settled) received.getTracks().forEach((track) => track.stop()); else stream = received;
    }, () => {});
    void Promise.all([resume, permission, context.audioWorklet.addModule(workletUrl)]).then(() => {
      if (settled || !context || !stream) return;
      if (context.state !== 'running' || document.hidden) throw new Error('Keep this page open while listening.');
      clearTimeout(deadline);
      context.onstatechange = () => { if (context?.state !== 'running') fail(new Error('The audio context was interrupted. Start again.')); };
      const interrupted = () => fail(new Error('The microphone was interrupted. Start again.'));
      stream.getTracks().forEach((track) => { track.onended = interrupted; track.onmute = interrupted; });
      source = context.createMediaStreamSource(stream);
      node = new AudioWorkletNode(context, 'stream-recorder', { channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1] });
      node.onprocessorerror = () => fail(new Error('The audio processor stopped unexpectedly. Start again.'));
      node.port.onmessage = (event: MessageEvent<{ type: string; startSample: number; samples?: Float32Array; totalSamples: number; message: string }>) => {
        const message = event.data;
        if (settled) { if (message.samples?.byteLength) message.samples.fill(0); return; }
        if (message.type === 'error') { fail(new Error(message.message)); return; }
        if (message.type === 'end') {
          if (message.totalSamples !== receivedSamples) { fail(new Error('Incomplete captured audio. Start again.')); return; }
          ended = true; stopTracks(); finish(); return;
        }
        const samples = message.samples;
        if (message.type !== 'frame' || !(samples instanceof Float32Array) || !samples.length || samples.length > 1600
          || message.startSample !== receivedSamples || ended || queue.length + Number(pumping) >= 8) {
          if (samples?.byteLength) samples.fill(0);
          fail(new Error('Audio capture lost continuity. Start again.')); return;
        }
        receivedSamples += samples.length; lastFrameAt = performance.now();
        queue.push({ clockId, sampleRate: 16000, startSample: message.startSample, samples });
        void pump();
      };
      lastFrameAt = performance.now();
      watchdog = setInterval(() => { if (performance.now() - lastFrameAt > 1500) fail(new Error('No audio arrived from the microphone. Start again.')); }, 250);
      source.connect(node); node.connect(context.destination); ready();
    }).catch((error: unknown) => fail(error instanceof DOMException && error.name === 'NotAllowedError'
      ? new Error('Microphone access was denied. Allow it in site settings and try again.') : error));
  } catch (error) { fail(error); }
  return { done, stop };
}
