import workletUrl from './enrolment-worklet.js?url&no-inline';
import { checkRecording } from './sample-quality';

export interface VoiceRecorder {
  unavailableReason?: string;
  record(signal: AbortSignal, progress: (seconds: number) => void): Promise<Float32Array>;
}

export function createVoiceRecorder(): VoiceRecorder {
  const unavailableReason = !globalThis.isSecureContext ? 'Voice recording needs HTTPS. Open the published site.'
    : !navigator.mediaDevices?.getUserMedia || !globalThis.AudioContext || !globalThis.AudioWorkletNode || !globalThis.OfflineAudioContext
      ? 'This browser does not support local voice recording. Live captions may still be available.' : undefined;
  return { unavailableReason, record: capture };
}

/** Called directly from the Record gesture so audio resume and permission retain activation. */
async function capture(signal: AbortSignal, progress: (seconds: number) => void): Promise<Float32Array> {
  signal.throwIfAborted();
  const context = new AudioContext();
  let stream: MediaStream | undefined;
  let node: AudioWorkletNode | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  let rejectRecording: (reason: unknown) => void = () => {};
  const cleanup = () => {
    if (timeout) clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
    context.onstatechange = null;
    if (node) { node.port.postMessage('cancel'); node.port.onmessage = null; node.port.close(); node.disconnect(); }
    source?.disconnect();
    stream?.getTracks().forEach((track) => { track.onended = null; track.onmute = null; track.stop(); });
    void context.close().catch(() => {});
  };
  const fail = (reason: unknown) => { if (!settled) { settled = true; cleanup(); rejectRecording(reason); } };
  const abort = () => fail(signal.reason);
  const recording = new Promise<Float32Array>((resolve, reject) => {
    rejectRecording = reject;
    signal.addEventListener('abort', abort, { once: true });
    timeout = setTimeout(() => fail(new Error('Recording timed out. Check microphone permission and try again.')), 30000);
    const resume = context.resume();
    const permission = navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
    // A dismissed permission prompt can resolve after cancellation: stop those late tracks.
    void permission.then((received) => {
      if (settled) received.getTracks().forEach((track) => track.stop());
      else stream = received;
    }, () => {});
    void Promise.all([resume, permission, context.audioWorklet.addModule(workletUrl)]).then(() => {
      if (settled || !stream) return;
      context.onstatechange = () => { if (context.state !== 'running') fail(new Error('Recording was interrupted. Keep the app open and try again.')); };
      const interrupted = () => fail(new Error('The microphone was interrupted. Try recording again.'));
      stream.getTracks().forEach((track) => { track.onended = interrupted; track.onmute = interrupted; });
      source = context.createMediaStreamSource(stream);
      node = new AudioWorkletNode(context, 'enrolment-recorder', { channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1] });
      node.onprocessorerror = () => fail(new Error('The audio recorder stopped unexpectedly. Try again.'));
      node.port.onmessage = (event: MessageEvent<{ samples?: Float32Array; seconds?: number }>) => {
        if (settled) { event.data.samples?.fill(0); return; }
        if (event.data.samples) { settled = true; cleanup(); resolve(event.data.samples); }
        else if (typeof event.data.seconds === 'number') progress(event.data.seconds);
      };
      // The processor outputs silence. Connecting it keeps processing alive without mic feedback.
      source.connect(node); node.connect(context.destination);
    }).catch((error: unknown) => {
      fail(error instanceof DOMException && error.name === 'NotAllowedError'
        ? new Error('Microphone access was denied. Allow it in site settings and try again.')
        : new Error('Could not start the microphone. Check it is available and try again.'));
    });
  });
  const samples = await recording;
  let resampled: Float32Array | undefined;
  try {
    signal.throwIfAborted();
    const offline = new OfflineAudioContext(1, Math.round(samples.length * 16000 / context.sampleRate), 16000);
    const buffer = offline.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(Float32Array.from(samples), 0);
    const input = offline.createBufferSource(); input.buffer = buffer; input.connect(offline.destination); input.start();
    try { const rendered = (await offline.startRendering()).getChannelData(0); resampled = rendered.slice(); rendered.fill(0); }
    finally { buffer.getChannelData(0).fill(0); input.disconnect(); }
    signal.throwIfAborted();
    checkRecording(resampled);
    return resampled;
  } catch (error) { resampled?.fill(0); throw error; }
  finally { samples.fill(0); }
}
