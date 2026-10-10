const run = document.querySelector('#run');
const cancel = document.querySelector('#cancel');
const status = document.querySelector('#status');
const report = document.querySelector('#report');
let worker; let timer;
function finish(message) {
  worker?.terminate(); worker = undefined; clearTimeout(timer);
  status.textContent = message; run.disabled = false; cancel.disabled = true;
}
run.addEventListener('click', () => {
  report.textContent = ''; run.disabled = true; cancel.disabled = false;
  worker = new Worker(new URL('./asr-worker.js', import.meta.url), { type: 'module' });
  worker.onerror = () => finish('Worker failed. Check the prepared ASR files.');
  worker.onmessage = ({ data }) => {
    if (data.phase === 'complete') { report.textContent = JSON.stringify(data.report, null, 2); finish('Complete.'); }
    else if (data.phase === 'error') finish(data.message);
    else status.textContent = data.phase === 'loading' ? 'Loading local model files…' : 'Processing generated speech…';
  };
  timer = setTimeout(() => finish('Timed out. Cancelled the worker.'), 60000);
  worker.postMessage({ run: true });
});
cancel.addEventListener('click', () => finish('Cancelled.'));
window.addEventListener('pagehide', () => finish('Cancelled.'));
document.addEventListener('visibilitychange', () => { if (document.hidden) finish('Cancelled.'); });
