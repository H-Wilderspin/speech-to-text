import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { watchInterruptions } from '../audio/interruption';
import { Transcript } from '../features/listening/Transcript';
import { SpeakersDialog, type SpeakerServices } from '../features/speakers/SpeakersDialog';
import type { TranscriptionEngine } from '../transcription/types';

export function App({ engine, createSpeakers }: { engine: TranscriptionEngine; createSpeakers: () => SpeakerServices }) {
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [textSize, setTextSize] = useState(32);
  const [language, setLanguage] = useState('en-GB');
  const [speakersOpen, setSpeakersOpen] = useState(false);
  const speakersButton = useRef<HTMLButtonElement>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [installFailed, setInstallFailed] = useState(false);
  const active = ['requesting-permission', 'listening', 'stopping'].includes(snapshot.phase);

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
    <header>
      <div className="brand"><img src={`${import.meta.env.BASE_URL}icon.svg`} width="36" height="36" alt="" /><h1>Speech to Text</h1><span className="badge">LIVE CAPTIONS</span></div>
      <button ref={speakersButton} className="quiet" onClick={() => { engine.stop(); setSpeakersOpen(true); }}>Speakers</button>
    </header>
    <main id="captions">
      <div className="session-bar">
        <p className={`session-status ${snapshot.phase}`} role="status" aria-live="polite" aria-atomic="true">
          <span className="status-dot" aria-hidden="true" />{snapshot.message}
        </p>
        <div className="text-controls" role="group" aria-label="Text size">
          <button className="quiet" aria-label="Smaller text" disabled={textSize <= 28} onClick={() => setTextSize((size) => size - 4)}>A−</button>
          <span aria-live="polite" aria-label={`Text size ${textSize} pixels`}>{textSize}</span>
          <button className="quiet" aria-label="Larger text" disabled={textSize >= 56} onClick={() => setTextSize((size) => size + 4)}>A+</button>
        </div>
      </div>
      {engine.unavailableReason && <p className="notice" role="alert">{engine.unavailableReason}</p>}
      {offline && <p className="notice">You’re offline. The app can open, but your browser’s speech service may need a connection.</p>}
      <Transcript segments={snapshot.segments} textSize={textSize} />
      <footer>
        <div className="controls">
          <button className={`listen ${active ? 'is-active' : ''}`} disabled={Boolean(engine.unavailableReason) || snapshot.phase === 'stopping'}
            aria-describedby="processing-note" onClick={() => active ? engine.stop() : engine.start(language)}>
            <span aria-hidden="true">{active ? '■' : '●'}</span> {snapshot.phase === 'stopping' ? 'Stopping…' : active ? 'Stop' : 'Listen'}
          </button>
          <label className="language">Speech language
            <select value={language} disabled={active} onChange={(event) => setLanguage(event.target.value)}>
              <option value="en-GB">English (UK)</option><option value="en-US">English (US)</option>
              <option value="fr-FR">Français</option><option value="de-DE">Deutsch</option><option value="es-ES">Español</option>
            </select>
          </label>
          <button className="quiet clear" disabled={active || snapshot.segments.length === 0} onClick={() => engine.clear()}>Clear text</button>
        </div>
        <p className="privacy" id="processing-note">By tapping Listen, you allow your browser to process microphone audio using its speech service, which may send audio to its provider. This app keeps captions only until you clear or reload the page.</p>
        <details><summary>Privacy &amp; installing the app</summary>
          <p>No account, analytics, saved audio, or saved transcripts. Optional consented voice profiles stay in this browser and can be deleted in Speakers. The browser provider’s processing and retention rules apply to its speech service. Only app files are cached for offline opening; offline transcription is not guaranteed.</p>
          <p>On iPhone, use Safari’s Share menu → Add to Home Screen. On Android, use Chrome’s menu → Install app or Add to Home screen. Keep the app open while listening; returning from another app requires tapping Listen again.</p>
          {installFailed && <p>Offline installation was unavailable. Check your browser’s storage settings. You can still use live captions while online.</p>}
        </details>
      </footer>
    </main>
    {speakersOpen && <SpeakersDialog createServices={createSpeakers} canRecord={!active} onClose={() => {
      setSpeakersOpen(false);
      speakersButton.current?.focus();
    }} />}
  </div>;
}
