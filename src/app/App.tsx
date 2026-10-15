import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { watchInterruptions } from '../audio/interruption';
import { Transcript } from '../features/listening/Transcript';
import { ListeningIndicator } from '../features/listening/ListeningIndicator';
import { SettingsDialog } from '../features/settings/SettingsDialog';
import type { TranscriptionEngine } from '../transcription/types';
import { readPreferences, savePreferences } from '../features/settings/preferences';
import { useListeningWakeLock } from './use-listening-wake-lock';

export function App({ engine }: { engine: TranscriptionEngine }) {
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const wakeStatus = useListeningWakeLock(engine);
  const [preferences, setPreferences] = useState(readPreferences);
  const { textSize, language } = preferences;
  const changePreferences = (changes: Partial<typeof preferences>) => {
    setPreferences((current) => { const next = { ...current, ...changes }; savePreferences(next); return next; });
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [installFailed, setInstallFailed] = useState(false);
  const active = ['requesting-permission', 'listening', 'restarting', 'stopping'].includes(snapshot.phase);

  useEffect(() => {
    const unwatch = watchInterruptions(() => engine.interrupt());
    const updateNetwork = () => setOffline(!navigator.onLine);
    const installationError = () => setInstallFailed(true);
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    window.addEventListener('offline-install-failed', installationError);
    return () => {
      unwatch();
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      window.removeEventListener('offline-install-failed', installationError);
      engine.dispose();
    };
  }, [engine]);

  return <div className="app-shell">
    <a className="skip-link" href="#captions">Skip to captions</a>
    <h1 className="sr-only">Speech to Text</h1>
    <main id="captions">
      <p className={snapshot.phase === 'error' ? 'notice error' : 'sr-only'} role="status" aria-live="polite" aria-atomic="true">{active ? '' : snapshot.message}</p>
      {engine.unavailableReason && <p className="notice" role="alert">{engine.unavailableReason}</p>}
      {offline && <p className="notice">You’re offline. Your browser’s speech service may need a connection.</p>}
      <Transcript segments={snapshot.segments} textSize={textSize} language={language} />
    </main>
    <footer className="toolbar" aria-label="Caption controls">
      <ListeningIndicator phase={snapshot.phase} />
      <button className={active ? 'listen is-active' : 'listen'} disabled={Boolean(engine.unavailableReason) || snapshot.phase === 'stopping'}
        aria-describedby="processing-note" onClick={() => active ? engine.stop() : engine.start(language)}>
        {snapshot.phase === 'stopping' ? 'Stopping…' : active ? 'Stop' : 'Listen'}
      </button>
      <button disabled={snapshot.segments.length === 0} onClick={() => engine.clear()}>Clear</button>
      <button ref={settingsButton} onClick={() => setSettingsOpen(true)}>Settings</button>
    </footer>
    <p className="sr-only" id="processing-note">Listen uses your browser’s speech service, which may send audio to its provider. Captions are kept only until you clear or reload. Details are in Settings.</p>
    {settingsOpen && <SettingsDialog active={active} textSize={textSize} onTextSize={(textSize) => changePreferences({ textSize })}
      language={language} onLanguage={(language) => changePreferences({ language })} installFailed={installFailed} wakeStatus={wakeStatus}
      onClose={() => { setSettingsOpen(false); settingsButton.current?.focus(); }} />}
  </div>;
}
