import { useSyncExternalStore } from 'react';
import type { LocalListeningEngine } from '../../transcription/local/types';

export function NameSuggestions({ engine }: { engine: LocalListeningEngine }) {
  const preparation = useSyncExternalStore(engine.subscribe, engine.getPreparationSnapshot);
  return <div className="name-preparation">
    <p role="status" className={['idle', 'ready'].includes(preparation.phase) ? 'sr-only' : undefined}>
      {preparation.phase === 'preparing' ? 'Preparing names…' : preparation.message}
    </p>
    {preparation.phase === 'error' && <button onClick={() => void engine.prepare()}>Retry names</button>}
  </div>;
}
