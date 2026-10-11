import { useEffect, useSyncExternalStore } from 'react';
import type { LocalListeningEngine } from '../../transcription/local/types';

export function NameSuggestions({ engine, enabled, active, onEnabled }: {
  engine: LocalListeningEngine; enabled: boolean; active: boolean; onEnabled(enabled: boolean): void;
}) {
  const preparation = useSyncExternalStore(engine.subscribe, engine.getPreparationSnapshot);
  useEffect(() => () => { if (engine.getPreparationSnapshot().phase === 'preparing') engine.cancelPreparation(); }, [engine]);
  return <section aria-labelledby="name-suggestions-title">
    <h3 id="name-suggestions-title">Delayed speaker estimates</h3>
    <p>Browser captions appear first. Names and colours can arrive later, after a pause or Stop, without changing the words. Short, repeated, mismatched or uncertain phrases stay Unknown. Names are estimates and may be wrong, especially when people speak together.</p>
    <p>Your browser’s speech service may send microphone audio to its provider. Speaker matching and saved voiceprints stay on this device. No audio or captions are saved by this app.</p>
    <p>Existing prepared models and voiceprints are reused. A fresh setup needs up to 205 MB of speech files plus the 27 MB voice model if missing. Prepare downloads only missing files. Speaker-processing problems leave browser captions running.</p>
    <label className="consent"><input type="checkbox" checked={enabled} disabled={active || (preparation.phase !== 'ready' && !enabled)}
      onChange={(event) => onEnabled(event.target.checked)} /><span>Use experimental names (delayed, English only)</span></label>
    <p>Changing this option clears the current text. Turn it off for browser captions without names.</p>
    <p role="status">{preparation.message}</p>
    {preparation.phase === 'preparing'
      ? <button disabled={active} onClick={() => engine.cancelPreparation()}>Cancel model preparation</button>
      : preparation.phase !== 'ready' && <button disabled={active} onClick={() => {
        void engine.prepare().then(() => { if (engine.getPreparationSnapshot().phase === 'ready') onEnabled(true); });
      }}>Prepare name suggestions</button>}
    <p><a href={`${import.meta.env.BASE_URL}local/THIRD-PARTY-NOTICES.txt`} target="_blank" rel="noreferrer">Local speech model licences</a></p>
  </section>;
}
