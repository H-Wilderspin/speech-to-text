/** Explicit, session-only console diagnostics. Never pass text, identities or audio. */
export const speakerDiagnosticsEnabled = () =>
  new URLSearchParams(globalThis.location?.search ?? '').get('debugSpeakers') === '1';

export type DiagnosticCounts = Record<string, number | boolean | null>;
let sequence = 0;

export function createSpeakerTrace(scope: string, enabled = speakerDiagnosticsEnabled()) {
  const trace = ++sequence;
  const emitted = new Map<string, number>();
  return (stage: string, values: DiagnosticCounts = {}, intervalMs = 0) => {
    if (!enabled) return;
    const now = performance.now();
    if (now - (emitted.get(stage) ?? -Infinity) < intervalMs) return;
    emitted.set(stage, now);
    // Defensive primitive-only copy: no object references, string values or buffers.
    const counts = Object.fromEntries(Object.entries(values).filter(([, value]) =>
      value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))));
    // Log a complete string: copying a collapsed DevTools object otherwise loses
    // the later score/rejection fields behind an ellipsis.
    console.info(`[who-said-what] ${scope}.${stage} ${JSON.stringify({ trace, atMs: Math.round(now), ...counts })}`);
  };
}

/** Fixed categories only; arbitrary exception messages can contain private data. */
export function speakerFailureStage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
  if (message.includes('audio clock')) return 'clock-interrupted';
  if (message.includes('lost continuity')) return 'queue-or-continuity-failure';
  if (message.includes('No audio arrived')) return 'input-stalled';
  if (message.includes('timed out') || message.includes('did not finish')) return 'timeout';
  if (message.includes('interrupted')) return 'interrupted';
  return 'failed';
}
