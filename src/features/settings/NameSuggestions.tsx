import { useEffect, useSyncExternalStore } from 'react';
import type { LocalListeningEngine } from '../../transcription/local/types';

export function NameSuggestions({ engine, enabled, active, onEnabled }: {
  engine: LocalListeningEngine; enabled: boolean; active: boolean; onEnabled(enabled: boolean): void;
}) {
  const preparation = useSyncExternalStore(engine.subscribe, engine.getPreparationSnapshot);
  useEffect(() => () => { if (engine.getPreparationSnapshot().phase === 'preparing') engine.cancelPreparation(); }, [engine]);
  return <section aria-labelledby="name-suggestions-title">
    <h3 id="name-suggestions-title">Who said what</h3>
    <label className="toggle"><input type="checkbox" checked={enabled} disabled={active || (preparation.phase !== 'ready' && !enabled)}
      onChange={(event) => onEnabled(event.target.checked)} /><span>Show names (English)</span></label>
    <p role="status" className={['idle', 'ready'].includes(preparation.phase) ? 'sr-only' : undefined}>{preparation.message}</p>
    {preparation.phase === 'preparing'
      ? <button disabled={active} onClick={() => engine.cancelPreparation()}>Cancel model preparation</button>
      : preparation.phase !== 'ready' && <button disabled={active} onClick={() => {
        void engine.prepare().then(() => { if (engine.getPreparationSnapshot().phase === 'ready') onEnabled(true); });
      }}>Prepare name suggestions</button>}
  </section>;
}
