/** Upgrade cleanup only. Never enumerate or remove another app's databases/data. */
export async function removeRetiredData(appUrl: URL): Promise<void> {
  try {
    localStorage.removeItem(`speech-to-text-name-suggestions:${appUrl.pathname}`);
    const key = `speech-to-text-display:${appUrl.pathname}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const value = JSON.parse(raw);
      if (value && typeof value === 'object' && ['colours', 'hiddenSpeakers', 'assignedCollapsed'].some((field) => field in value)) {
        localStorage.setItem(key, JSON.stringify({ textSize: value.textSize, language: value.language }));
      }
    }
  } catch { /* Restricted storage must not prevent live captions. */ }

  try {
    // Old connections close on versionchange. If blocked, deletion remains pending
    // until the old tab closes; a later load can safely retry. No database is opened.
    const request = globalThis.indexedDB?.deleteDatabase(`speech-to-text-speakers:${appUrl.pathname}`);
    if (request) request.onerror = (event) => event.preventDefault();
  } catch { /* Storage may be unavailable. */ }

  try {
    if (!globalThis.caches) return;
    const prefixes = [
      `speech-to-text-model:${new URL('speaker/', appUrl).href}`,
      `speech-to-text-local:${new URL('local/', appUrl).href}`,
      `speech-to-text-asr:${new URL('local/', appUrl).href}`,
    ];
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
      .map((key) => caches.delete(key)));
  } catch { /* Best effort; retry on the next load without blocking listening. */ }
}
