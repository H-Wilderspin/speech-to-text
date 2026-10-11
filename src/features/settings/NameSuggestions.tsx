import { useEffect, useSyncExternalStore } from 'react';
import type { LocalListeningEngine } from '../../transcription/local/types';

export function NameSuggestions({ engine, enabled, active, onEnabled }: {
  engine: LocalListeningEngine; enabled: boolean; active: boolean; onEnabled(enabled: boolean): void;
}) {
  const preparation = useSyncExternalStore(engine.subscribe, engine.getPreparationSnapshot);
  useEffect(() => () => { if (engine.getPreparationSnapshot().phase === 'preparing') engine.cancelPreparation(); }, [engine]);
  return <section aria-labelledby="name-suggestions-title">
    <h3 id="name-suggestions-title">Experimental name suggestions</h3>
    <p>Compare live English speech with saved voiceprints on this device. Names are marked “estimate” and may be wrong, especially when people speak together. Short or uncertain speech stays Unknown. Names can appear a few seconds after the words.</p>
    <p>This mode also changes speech recognition. If words are inaccurate, turn off experimental names below to use browser captions. Saved voiceprints are kept.</p>
    <p>The upgraded speech model needs about 190 MB of new files once, or up to 205 MB including its runtime, plus the 27 MB voice model if missing. Prepare downloads only missing files; saved voiceprints stay compatible. Local mode keeps microphone audio on this device; recordings and captions are not saved.</p>
    <label className="consent"><input type="checkbox" checked={enabled} disabled={active || (preparation.phase !== 'ready' && !enabled)}
      onChange={(event) => onEnabled(event.target.checked)} /><span>Use experimental names (English only)</span></label>
    <p>Changing caption mode clears the current text. Turn this off to return to browser captions.</p>
    <p role="status">{preparation.message}</p>
    {preparation.phase === 'preparing'
      ? <button disabled={active} onClick={() => engine.cancelPreparation()}>Cancel model preparation</button>
      : preparation.phase !== 'ready' && <button disabled={active} onClick={() => {
        void engine.prepare().then(() => { if (engine.getPreparationSnapshot().phase === 'ready') onEnabled(true); });
      }}>Prepare name suggestions</button>}
    <p><a href={`${import.meta.env.BASE_URL}local/THIRD-PARTY-NOTICES.txt`} target="_blank" rel="noreferrer">Local speech model licences</a></p>
  </section>;
}
