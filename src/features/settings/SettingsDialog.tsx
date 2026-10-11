import { useEffect, useRef } from 'react';
import { NameSuggestions } from './NameSuggestions';
import type { LocalListeningEngine } from '../../transcription/local/types';

export function SettingsDialog({ active, textSize, onTextSize, language, onLanguage, installFailed, focusSpeakers, onSpeakers, onClose, localEngine, localEnabled = false, onLocalEnabled }: {
  active: boolean; textSize: number; onTextSize: (size: number) => void;
  language: string; onLanguage: (language: string) => void; installFailed: boolean;
  focusSpeakers: boolean; onSpeakers: () => void; onClose: () => void;
  localEngine?: LocalListeningEngine; localEnabled?: boolean; onLocalEnabled?: (enabled: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const speakersButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    if (focusSpeakers) speakersButton.current?.focus();
  }, [focusSpeakers]);

  return <dialog className="settings-dialog" ref={dialog} aria-labelledby="settings-title" onClose={onClose}>
    <h2 id="settings-title">Settings</h2>
    <form method="dialog"><button autoFocus>Back to captions</button></form>
    <section aria-label="Caption preferences">
      <h3>Text size</h3>
      <div className="text-controls" role="group" aria-label="Text size">
        <button aria-label="Smaller text" disabled={textSize <= 28} onClick={() => onTextSize(textSize - 4)}>A−</button>
        <span aria-live="polite" aria-label={`Text size ${textSize} pixels`}>{textSize}</span>
        <button aria-label="Larger text" disabled={textSize >= 56} onClick={() => onTextSize(textSize + 4)}>A+</button>
      </div>
      <label className="language">Speech language
        <select value={language} disabled={active} onChange={(event) => onLanguage(event.target.value)}>
          <option value="en-GB">English (UK)</option><option value="en-US">English (US)</option>
          <option value="fr-FR">Français</option><option value="de-DE">Deutsch</option><option value="es-ES">Español</option>
        </select>
      </label>
      {active && <p>Stop listening before changing the speech language.</p>}
    </section>
    <section aria-labelledby="voices-title">
      <h3 id="voices-title">Voice profiles</h3>
      <p>Saved profiles can be used for experimental name suggestions and Compare recordings. Browser captions remain anonymous.</p>
      <button ref={speakersButton} onClick={onSpeakers}>Speakers</button>
    </section>
    {localEngine && onLocalEnabled && <NameSuggestions engine={localEngine} enabled={localEnabled} active={active} onEnabled={onLocalEnabled} />}
    <section aria-labelledby="listening-help-title">
      <h3 id="listening-help-title">Listening</h3>
      <p>Tap Listen to begin. Listening continues across pauses. Tap Stop or say “command stop” to finish. Keep the app open while listening; returning from another app requires tapping Listen again.</p>
      <p>The latest 100,000 characters stay on screen. Scroll up to read earlier speech and return to the bottom to follow new words.</p>
    </section>
    <section aria-labelledby="privacy-title">
      <h3 id="privacy-title">Privacy &amp; installation</h3>
      <p>Browser captions use your browser’s speech service, which may send microphone audio to its provider. The provider’s processing and retention rules apply. Experimental name suggestions use local speech models instead.</p>
      <p>No account, analytics, saved audio or saved transcripts. Captions disappear when cleared or reloaded. Optional consented voice profiles stay in this browser and can be deleted in Speakers.</p>
      <p>App files and prepared models are cached. Browser captions may need a connection; prepared local listening can work offline. Browsers may evict cached files.</p>
      <p>On iPhone, use Safari’s Share menu → Add to Home Screen. On Android, use Chrome’s menu → Install app or Add to Home screen.</p>
      {installFailed && <p>Offline installation was unavailable. Check your browser’s storage settings. Live captions can still work online.</p>}
    </section>
  </dialog>;
}
