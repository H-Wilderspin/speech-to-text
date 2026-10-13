import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { watchInterruptions } from '../../audio/interruption';
import { watchProfileChanges } from '../../storage/profile-changes';
import { Transcript } from '../listening/Transcript';
import { SettingsDialog } from '../settings/SettingsDialog';
import { readPreferences, savePreferences } from '../settings/preferences';
import { createSpeakerServices } from '../../app/speaker-services';
import type { TranscriptionEngine } from '../../transcription/types';
import type { RemoteNames } from '../../transcription/remote/engine';
import type { Connection } from '../../transcription/remote/client';

const processing = 'Live captions use your browser’s speech provider. Delayed names send audio and voiceprints through Cloudflare to your PC. The service does not save recordings or transcripts.';
function initialConnection(): Connection {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const connection = { url: fragment.get('service') ?? '', key: fragment.get('key') ?? '' };
  if (connection.url || connection.key) history.replaceState(null, '', location.pathname + location.search);
  try {
    if (connection.url && connection.key) sessionStorage.setItem('comparison-connection', JSON.stringify(connection));
    else {
      const saved = JSON.parse(sessionStorage.getItem('comparison-connection') ?? '{}');
      return { url: typeof saved?.url === 'string' ? saved.url : '', key: typeof saved?.key === 'string' ? saved.key : '' };
    }
  } catch { /* Connection can still be entered when session storage is unavailable. */ }
  return connection;
}

export function ComparisonApp({ browser, remote, database }: { browser: TranscriptionEngine; remote: RemoteNames; database: string }) {
  const live = useSyncExternalStore(browser.subscribe, browser.getSnapshot);
  const delayed = useSyncExternalStore(remote.subscribe, remote.getSnapshot);
  const [connection, setConnection] = useState(initialConnection);
  const [preferences, setPreferences] = useState(readPreferences);
  const [settings, setSettings] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const active = ['requesting-permission', 'listening', 'stopping'].includes(live.phase);
  const change = (changes: Partial<typeof preferences>) => setPreferences((current) => {
    const next = { ...current, ...changes }; savePreferences(next); return next;
  });
  const connect = (changes: Partial<Connection>) => setConnection((current) => {
    const next = { ...current, ...changes };
    try { sessionStorage.setItem('comparison-connection', JSON.stringify(next)); } catch { /* In-memory use still works. */ }
    return next;
  });
  const stop = () => { browser.stop(); remote.stop(); };
  useEffect(() => {
    const unsubscribe = browser.subscribe(() => {
      const phase = browser.getSnapshot().phase;
      // Includes spoken "command stop", permission failure and interruption.
      if (phase === 'stopping' || phase === 'idle' || phase === 'error') remote.stop();
    });
    const unwatch = watchInterruptions(() => { browser.interrupt(); remote.cancel(); });
    const unwatchProfiles = watchProfileChanges(database, () => remote.profilesChanged());
    const updateConnection = () => {
      if (new URLSearchParams(location.hash.slice(1)).has('service')) {
        browser.stop(); remote.cancel(); setConnection(initialConnection());
      }
    };
    window.addEventListener('hashchange', updateConnection);
    return () => { window.removeEventListener('hashchange', updateConnection); unsubscribe(); unwatch(); unwatchProfiles(); browser.dispose(); remote.dispose(); };
  }, [browser, remote, database]);

  return <div className="app-shell">
    <a className="skip-link" href="#captions">Skip to captions</a>
    <h1 className="sr-only">Speech to Text — PC comparison</h1>
    <main id="captions">
      <p className="notice" role="status">{delayed.status}</p>
      {(live.phase === 'error' || browser.unavailableReason) && <p className="notice error" role="alert">{browser.unavailableReason ?? live.message}</p>}
      <div className="caption-panes">
        <Transcript segments={delayed.segments} textSize={preferences.textSize} assigned colours={preferences.colours} hiddenSpeakers={preferences.hiddenSpeakers} />
        <Transcript segments={live.segments} textSize={preferences.textSize} />
      </div>
    </main>
    <footer className="toolbar" aria-label="Caption controls">
      <button className={active ? 'listen is-active' : 'listen'} disabled={Boolean(browser.unavailableReason) || live.phase === 'stopping'}
        aria-describedby="processing-note" onClick={() => {
          if (active) stop(); else { remote.start(connection, preferences.language); browser.start(preferences.language); }
        }}>{live.phase === 'stopping' ? 'Stopping…' : active ? 'Stop' : 'Listen'}</button>
      <button disabled={active} onClick={() => { browser.clear(); remote.clear(); }}>Clear</button>
      <button ref={settingsButton} onClick={() => setSettings(true)}>Settings</button>
    </footer>
    <p id="processing-note" className="sr-only">{processing}</p>
    {settings && <SettingsDialog active={active || delayed.pending} textSize={preferences.textSize} onTextSize={(textSize) => change({ textSize })}
      language={preferences.language} onLanguage={(language) => change({ language })} installFailed={false} onStop={stop}
      onClose={() => { setSettings(false); settingsButton.current?.focus(); }} createSpeakers={createSpeakerServices}
      colours={preferences.colours} onColours={(colours) => change({ colours })} hiddenSpeakers={preferences.hiddenSpeakers}
      onHiddenSpeakers={(hiddenSpeakers) => change({ hiddenSpeakers })} processingDescription={processing}
      extraSettings={<section aria-label="PC comparison connection"><h3>PC comparison</h3>
        <p><a href="./">Open original app</a></p>
        <label className="speaker-name">Service address<input type="url" value={connection.url} disabled={active || delayed.pending}
          onChange={(event) => connect({ url: event.target.value })} placeholder="https://…trycloudflare.com" autoComplete="off" /></label>
        <label className="speaker-name">Access code<input type="password" value={connection.key} disabled={active || delayed.pending}
          onChange={(event) => connect({ key: event.target.value })} autoComplete="off" /></label>
        <p>{processing}</p>
      </section>} />}
  </div>;
}
