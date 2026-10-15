import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { watchInterruptions } from '../audio/interruption';
import { Transcript } from '../features/listening/Transcript';
import { SettingsDialog } from '../features/settings/SettingsDialog';
import { type SpeakerServices } from '../features/speakers/SpeakerSettings';
import type { TranscriptionEngine } from '../transcription/types';
import type { LocalListeningEngine } from '../transcription/local/types';
import { readPreferences, savePreferences } from '../features/settings/preferences';
import { assignedSegments } from '../features/listening/streams';
import { createSpeakerTrace } from '../transcription/diagnostics';

const trace = createSpeakerTrace('display');

export function App({ engine: browserEngine, createSpeakers, localEngine }: {
  engine: TranscriptionEngine; createSpeakers: () => SpeakerServices; localEngine?: LocalListeningEngine;
}) {
  const engine = localEngine ?? browserEngine;
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [preferences, setPreferences] = useState(readPreferences);
  const { textSize, language, colours, hiddenSpeakers } = preferences;
  const changePreferences = (changes: Partial<typeof preferences>) => {
    setPreferences((current) => { const next = { ...current, ...changes }; savePreferences(next); return next; });
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [installFailed, setInstallFailed] = useState(false);
  const active = ['requesting-permission', 'listening', 'restarting', 'stopping'].includes(snapshot.phase);
  const visible = assignedSegments(snapshot.segments, hiddenSpeakers);
  const visibleCharacters = visible.reduce((sum, segment) => sum + segment.text.length, 0);
  const assignedCount = snapshot.segments.filter((segment) => segment.speakerId).length;
  useEffect(() => {
    trace('upper-pane', { visibleSegments: visible.length, visibleCharacters, assignedSegments: assignedCount,
      hiddenProfiles: hiddenSpeakers.length });
  }, [visible.length, visibleCharacters, assignedCount, hiddenSpeakers.length]);

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
      <p className={snapshot.phase === 'error' ? 'notice error' : snapshot.notice || snapshot.phase === 'restarting' ? 'notice' : 'sr-only'} role="status" aria-live="polite" aria-atomic="true">{snapshot.phase === 'restarting' ? 'Restarting…' : snapshot.message}</p>
      {engine.unavailableReason && <p className="notice" role="alert">{engine.unavailableReason}</p>}
      {offline && <p className="notice">You’re offline. Your browser’s speech service may need a connection.</p>}
      <div className={preferences.assignedCollapsed ? 'caption-panes assigned-collapsed' : 'caption-panes'}>
        <Transcript segments={snapshot.segments} textSize={textSize} />
        <Transcript segments={snapshot.segments} textSize={textSize} assigned colours={colours} hiddenSpeakers={hiddenSpeakers}
          collapsed={preferences.assignedCollapsed} onToggle={() => changePreferences({ assignedCollapsed: !preferences.assignedCollapsed })} />
      </div>
    </main>
    <footer className="toolbar" aria-label="Caption controls">
      <button className={active ? 'listen is-active' : 'listen'} disabled={Boolean(engine.unavailableReason) || snapshot.phase === 'stopping'}
        aria-describedby="processing-note" onClick={() => active ? engine.stop() : engine.start(language)}>
        {snapshot.phase === 'stopping' ? 'Stopping…' : active ? 'Stop' : 'Listen'}
      </button>
      <button disabled={snapshot.segments.length === 0} onClick={() => engine.clear()}>Clear</button>
      <button ref={settingsButton} onClick={() => setSettingsOpen(true)}>Settings</button>
    </footer>
    <p className="sr-only" id="processing-note">Listen uses your browser’s speech service, which may send audio to its provider. Delayed name estimates use saved voiceprints on this device. Captions are kept only until you clear or reload. Details are in Settings.</p>
    {settingsOpen && <SettingsDialog active={active} textSize={textSize} onTextSize={(textSize) => changePreferences({ textSize })}
      localEngine={localEngine} createSpeakers={createSpeakers} colours={colours} onColours={(colours) => changePreferences({ colours })}
      hiddenSpeakers={hiddenSpeakers} onHiddenSpeakers={(hiddenSpeakers) => changePreferences({ hiddenSpeakers })}
      language={language} onLanguage={(language) => changePreferences({ language })} installFailed={installFailed}
      onStop={() => engine.stop()} onClose={() => { setSettingsOpen(false); settingsButton.current?.focus(); }} />}
  </div>;
}
