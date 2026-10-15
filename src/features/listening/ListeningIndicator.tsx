import type { SessionPhase } from '../../transcription/types';

const labels: Partial<Record<SessionPhase, string>> = {
  'requesting-permission': 'Starting…',
  listening: 'Listening…',
  restarting: 'Reconnecting…',
  stopping: 'Stopping…',
};

export function ListeningIndicator({ phase }: { phase: SessionPhase }) {
  const label = labels[phase];
  // Keep the row's height and live region stable, even while stopped.
  return <p className="listening-indicator" data-phase={phase} role="status" aria-live="polite" aria-atomic="true">
    {label && <><span className="listening-dot" aria-hidden="true" />{label}</>}
  </p>;
}
