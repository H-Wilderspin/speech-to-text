const run = document.querySelector('#run');
const cancel = document.querySelector('#cancel');
const status = document.querySelector('#status');
const report = document.querySelector('#report');
let worker;
let timeout;

function stop() {
  worker?.terminate(); worker = undefined;
  clearTimeout(timeout); timeout = undefined;
  run.disabled = false; cancel.disabled = true;
}

run.addEventListener('click', () => {
  stop(); report.textContent = ''; report.dataset.status = 'running';
  run.disabled = true; cancel.disabled = false;
  status.textContent = 'Starting worker…';
  worker = new Worker(new URL('./speaker-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') status.textContent = data.message;
    if (data.type === 'complete') {
      report.textContent = JSON.stringify(data.report, null, 2);
      report.dataset.status = 'complete'; status.textContent = 'Benchmark complete. Accuracy remains unmeasured.'; stop();
    }
    if (data.type === 'error') { report.dataset.status = 'error'; status.textContent = data.message; stop(); }
  };
  worker.onerror = () => { report.dataset.status = 'error'; status.textContent = 'Worker could not run. Check that the research assets exist and WebAssembly is supported.'; stop(); };
  timeout = setTimeout(() => { report.dataset.status = 'error'; status.textContent = 'Benchmark timed out after 60 seconds. Worker stopped.'; stop(); }, 60_000);
  worker.postMessage({ type: 'run' });
});
cancel.addEventListener('click', () => { stop(); report.dataset.status = 'cancelled'; status.textContent = 'Cancelled. Worker stopped.'; });
window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => { if (document.hidden && worker) { stop(); report.dataset.status = 'cancelled'; status.textContent = 'Stopped because you left the page.'; } });
