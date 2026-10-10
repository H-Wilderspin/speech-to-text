import { startAudioCapture, streamingUnavailableReason } from '../src/audio/streaming.ts';

const prepare = document.querySelector('#prepare'); const listen = document.querySelector('#listen');
const stop = document.querySelector('#stop'); const cancel = document.querySelector('#cancel');
const status = document.querySelector('#status'); const transcript = document.querySelector('#transcript'); const report = document.querySelector('#report');
let worker; let controller; let capture; let generation = 0; let nextId = 0;
const pending = new Map(); let finals = []; let interim = ''; let chunks = 0; let maxProcessingMs = 0; let firstTextSeconds = null;
const release = () => {
  controller?.abort(); capture = undefined;
  worker?.terminate(); worker = undefined;
  for (const request of pending.values()) { clearTimeout(request.timeout); request.reject(new DOMException('Cancelled', 'AbortError')); }
  pending.clear();
};
const controls = (state) => {
  prepare.disabled = state !== 'idle'; listen.disabled = state !== 'ready'; stop.disabled = state !== 'listening'; cancel.disabled = state === 'idle';
};
const reset = (message) => { generation++; release(); controls('idle'); status.textContent = message; };
const request = (type, value = {}, transfer = []) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Local processing timed out.')); }, type === 'prepare' ? 60000 : 5000);
  pending.set(id, { resolve, reject, timeout });
  try { worker.postMessage({ id, type, ...value }, transfer); }
  catch (error) { pending.delete(id); clearTimeout(timeout); reject(error); }
});
const showResult = (result) => {
  if (result.text.trim() && firstTextSeconds === null) firstTextSeconds = result.acceptedSamples / 16000;
  if (result.isFinal) { if (result.text.trim()) finals.push(result.text); finals = finals.slice(-100); interim = ''; }
  else interim = result.text;
  transcript.textContent = [...finals, interim].filter(Boolean).join('\n');
  maxProcessingMs = Math.max(maxProcessingMs, result.processingMs);
  report.textContent = JSON.stringify({ chunks, acceptedSamples: result.acceptedSamples, sampleRate: 16000,
    firstTextAfterAcceptedSeconds: firstTextSeconds, maxProcessingMs: Math.round(maxProcessingMs),
    wasmLinearMemoryBytes: result.wasmLinearMemoryBytes, hasText: firstTextSeconds !== null }, null, 2);
};
prepare.onclick = async () => {
  release(); const job = ++generation; controls('preparing'); status.textContent = 'Preparing local ASR…';
  finals = []; interim = ''; chunks = 0; maxProcessingMs = 0; firstTextSeconds = null; transcript.textContent = ''; report.textContent = '';
  worker = new Worker(new URL('./live-asr-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const waiting = pending.get(data.id); if (!waiting) return;
    clearTimeout(waiting.timeout); pending.delete(data.id);
    if (data.type === 'error') waiting.reject(new Error(data.message)); else waiting.resolve(data);
  };
  worker.onerror = () => { if (job === generation) reset('Local ASR worker failed. Prepare again.'); };
  try { await request('prepare'); if (job === generation) { controls('ready'); status.textContent = 'Ready. Tap Listen locally.'; } }
  catch (error) { if (job === generation) reset(error.message); }
};
listen.onclick = async () => {
  const job = generation; controller = new AbortController(); controls('listening'); status.textContent = 'Requesting microphone…';
  capture = startAudioCapture(controller.signal, async (frame) => {
    const result = await request('frame', { frame }, [frame.samples.buffer]);
    if (job === generation) { chunks++; showResult(result); }
  }, () => { status.textContent = 'Listening locally.'; });
  try {
    await capture.done;
    if (job !== generation) return;
    showResult(await request('finish'));
    if (job === generation) reset('Complete. Microphone stopped.');
  } catch (error) { if (job === generation) reset(error.message); }
};
stop.onclick = () => { stop.disabled = true; status.textContent = 'Finishing…'; capture?.stop(); };
cancel.onclick = () => { reset('Cancelled. Microphone stopped.'); transcript.textContent = ''; report.textContent = ''; };
const interrupted = () => { if (worker) reset('Interrupted. Microphone stopped.'); };
document.addEventListener('visibilitychange', () => { if (document.hidden) interrupted(); });
window.addEventListener('pagehide', interrupted);
const unavailable = streamingUnavailableReason();
if (unavailable) { prepare.disabled = true; status.textContent = unavailable; }
