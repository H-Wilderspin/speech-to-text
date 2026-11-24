import { useState } from 'react';
import { updateApp } from '../../app/update-app';
import { Icon } from '../../shared/Icon';

export function AppUpdate({ active, beforeUpdate, busy, onBusy }: {
  active: boolean; beforeUpdate: () => Promise<boolean>; busy: boolean; onBusy: (busy: boolean) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const update = async () => {
    setUpdating(true); onBusy(true); setError('');
    try {
      if (!await beforeUpdate()) {
        setError('Your planner changes could not be saved on this device or shared with your family. Keep the app open and try again when connected.');
        setUpdating(false); onBusy(false);
        return;
      }
      await updateApp();
    }
    catch (error) {
      setError(error instanceof Error && /offline|too long|unavailable|could not be installed/.test(error.message)
        ? error.message : 'Could not download the update. Check your connection and try again.');
      setUpdating(false); onBusy(false);
    }
  };
  return <section aria-label="App updates">
    <button className="app-update" disabled={busy || active} onClick={() => void update()} aria-describedby="update-help update-keeps">
      <Icon name="refresh" />{updating ? 'Updating…' : 'Update app'}
    </button>
    <p id="update-help">{active ? 'Stop listening before updating.'
      : 'If the app looks out of date, tap Update app. It will reopen with the latest version.'}</p>
    <p id="update-keeps">Your saved settings and connection stay. Current captions and text you have not saved will clear.</p>
    {updating && <p role="status">Downloading the latest app…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </section>;
}
