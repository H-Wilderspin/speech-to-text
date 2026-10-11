import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { watchInterruptions } from '../audio/interruption';
import { Transcript } from '../features/listening/Transcript';
import { SettingsDialog } from '../features/settings/SettingsDialog';
import { SpeakersDialog, type SpeakerServices } from '../features/speakers/SpeakersDialog';
import type { TranscriptionEngine } from '../transcription/types';
import type { LocalListeningEngine } from '../transcription/local/types';

export function App({ engine: browserEngine, createSpeakers, localEngine }: {
  engine: TranscriptionEngine; createSpeakers: () => SpeakerServices; localEngine?: LocalListeningEngine;
}) {
  const preferenceKey = `speech-to-text-name-suggestions:${new URL(import.meta.env.BASE_URL, document.baseURI).pathname}`;
  const [localEnabled, setLocalEnabled] = useState(() => {
    try { return Boolean(localEngine) && localStorage.getItem(preferenceKey) === 'enabled'; } catch { return false; }
  });
  const engine = localEnabled && localEngine ? localEngine : browserEngine;
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [textSize, setTextSize] = useState(32);
  const [language, setLanguage] = useState('en-GB');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speakersOpen, setSpeakersOpen] = useState(false);
  const [focusSpeakers, setFocusSpeakers] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [installFailed, setInstallFailed] = useState(false);
  const active = ['requesting-permission', 'listening', 'stopping'].includes(snapshot.phase);

  useEffect(() => { if (localEnabled) void localEngine?.prepare(true); }, [localEngine, localEnabled]);

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
    <header className="toolbar" aria-label="Caption controls">
      <button className={active ? 'listen is-active' : 'listen'} disabled={Boolean(engine.unavailableReason) || snapshot.phase === 'stopping'}
        aria-describedby="processing-note" onClick={() => active ? engine.stop() : engine.start(language)}>
        {snapshot.phase === 'stopping' ? 'Stopping…' : active ? 'Stop' : 'Listen'}
      </button>
      <button disabled={active || snapshot.segments.length === 0} onClick={() => engine.clear()}>Clear</button>
      <button ref={settingsButton} onClick={() => { setFocusSpeakers(false); setSettingsOpen(true); }}>Settings</button>
    </header>
    <main id="captions">
      <p className={snapshot.phase === 'error' ? 'notice error' : 'sr-only'} role="status" aria-live="polite" aria-atomic="true">{snapshot.message}</p>
      {engine.unavailableReason && <p className="notice" role="alert">{engine.unavailableReason}</p>}
      {offline && <p className="notice">{localEnabled ? 'You’re offline. Local listening uses the saved models.' : 'You’re offline. Your browser’s speech service may need a connection.'}</p>}
      <Transcript segments={snapshot.segments} textSize={textSize} />
    </main>
    <p className="sr-only" id="processing-note">{localEnabled ? 'Local listening processes speech on this device. Names are estimates.' : 'Listen uses your browser’s speech service, which may send audio to its provider.'} Captions are kept only until you clear or reload. Details are in Settings.</p>
    {settingsOpen && !speakersOpen && <SettingsDialog active={active} textSize={textSize} onTextSize={setTextSize}
      localEngine={localEngine} localEnabled={localEnabled} onLocalEnabled={(enabled) => {
        if (active) return;
        engine.clear(); setLocalEnabled(enabled);
        try { if (enabled) localStorage.setItem(preferenceKey, 'enabled'); else localStorage.removeItem(preferenceKey); } catch { /* Session-only preference if storage is blocked. */ }
      }}
      language={language} onLanguage={setLanguage} installFailed={installFailed} focusSpeakers={focusSpeakers}
      onSpeakers={() => { engine.stop(); setSpeakersOpen(true); }} onClose={() => {
        setSettingsOpen(false); settingsButton.current?.focus();
      }} />}
    {speakersOpen && <SpeakersDialog createServices={createSpeakers} canRecord={!active} onClose={() => {
      setFocusSpeakers(true); setSpeakersOpen(false);
    }} />}
  </div>;
}
