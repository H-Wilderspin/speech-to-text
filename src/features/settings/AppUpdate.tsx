import { useState } from 'react';
import { updateApp } from '../../app/update-app';
import { Icon } from '../../shared/Icon';

export function AppUpdate({ active, plannerOpen, busy, onBusy }: {
  active: boolean; plannerOpen: boolean; busy: boolean; onBusy: (busy: boolean) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const update = async () => {
    setUpdating(true); onBusy(true); setError('');
    try { await updateApp(); }
    catch (error) {
      setError(error instanceof Error && /offline|too long|unavailable|could not be installed/.test(error.message)
        ? error.message : 'Could not download the update. Check your connection and try again.');
      setUpdating(false); onBusy(false);
    }
  };
  return <section aria-label="App updates">
    <button className="app-update" disabled={busy || active || plannerOpen} onClick={() => void update()} aria-describedby="update-help">
      <Icon name="refresh" />{updating ? 'Updating…' : 'Update app'}
    </button>
    <p id="update-help">{active ? 'Stop listening before updating.' : plannerOpen ? 'Close the planner before updating.'
      : 'Get the latest app and reload. Current captions will clear; saved settings and planner access stay.'}</p>
    {updating && <p role="status">Downloading the latest app…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </section>;
}
