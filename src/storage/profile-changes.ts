/** Only an invalidation signal leaves this tab; no names, IDs or voiceprints. */
export function notifyProfileChange(database: string) {
  globalThis.dispatchEvent?.(new Event(`profiles-changed:${database}`));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(`profiles-changed:${database}`);
    channel.postMessage('changed'); channel.close();
  }
}

export function watchProfileChanges(database: string, changed: () => void) {
  const event = `profiles-changed:${database}`;
  globalThis.addEventListener?.(event, changed);
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(event) : undefined;
  if (channel) channel.onmessage = changed;
  return () => { globalThis.removeEventListener?.(event, changed); channel?.close(); };
}
