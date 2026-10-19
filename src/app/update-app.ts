const timeoutMessage = 'The update took too long. Check your connection and try again.';

function bounded<T>(operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), 20000);
    operation.then(resolve, reject).finally(() => window.clearTimeout(timer));
  });
}

function waitForWorker(worker: ServiceWorker, ready: ServiceWorkerState[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', changed);
      if (error) reject(error); else resolve();
    };
    const changed = () => {
      if (ready.includes(worker.state)) finish();
      else if (worker.state === 'redundant') finish(new Error('The update could not be installed. Try again.'));
    };
    const timer = window.setTimeout(() => finish(new Error(timeoutMessage)), 20000);
    worker.addEventListener('statechange', changed);
    changed();
  });
}

/** Activate a complete offline shell before reloading; never clear user storage. */
export async function updateApp(): Promise<void> {
  if (!navigator.onLine) throw new Error('You’re offline. Connect to the internet and try again.');
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    throw new Error('App updates are unavailable in this browser. Close and reopen the app to try again.');
  }
  const appUrl = new URL(import.meta.env.BASE_URL, document.baseURI);
  const registration = await bounded(navigator.serviceWorker.register(new URL('sw.js', appUrl), {
    scope: appUrl.href, updateViaCache: 'none',
  }));
  await bounded(registration.update());
  if (registration.installing) await waitForWorker(registration.installing, ['installed', 'activating', 'activated']);
  const next = registration.waiting ?? registration.active;
  if (!next) throw new Error('The update could not be installed. Try again.');
  if (next.state === 'installed') next.postMessage({ type: 'ACTIVATE_UPDATE' });
  await waitForWorker(next, ['activated']);
  window.location.reload();
}
