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
    </section>
    <section aria-labelledby="voices-title">
      <h3 id="voices-title">People &amp; colours</h3>
      <button ref={speakersButton} onClick={onSpeakers}>Speakers</button>
    </section>
    {localEngine && onLocalEnabled && <NameSuggestions engine={localEngine} enabled={localEnabled} active={active} onEnabled={onLocalEnabled} />}
    {installFailed && <p role="status">Offline installation unavailable.</p>}
    <details><summary>About</summary>
      <p>Speech uses your browser’s provider. Voiceprints stay on this device.</p>
      <p><a href={`${import.meta.env.BASE_URL}speaker/THIRD-PARTY-NOTICES.txt`} target="_blank" rel="noreferrer">Voice model licences</a>
        {' · '}<a href={`${import.meta.env.BASE_URL}local/THIRD-PARTY-NOTICES.txt`} target="_blank" rel="noreferrer">Speech model licences</a></p>
    </details>
  </dialog>;
}
