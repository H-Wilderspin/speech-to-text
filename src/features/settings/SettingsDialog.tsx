import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { NameSuggestions } from './NameSuggestions';
import type { LocalListeningEngine } from '../../transcription/local/types';
import { SpeakerSettings, type SpeakerServices } from '../speakers/SpeakerSettings';
import type { SpeakerColourChoices } from '../speakers/colours';
import { Icon } from '../../shared/Icon';

export function SettingsDialog({ active, textSize, onTextSize, language, onLanguage, installFailed, onClose, localEngine, createSpeakers, colours, onColours, onStop, hiddenSpeakers, onHiddenSpeakers, extraSettings, processingDescription }: {
  active: boolean; textSize: number; onTextSize: (size: number) => void;
  language: string; onLanguage: (language: string) => void; installFailed: boolean;
  onClose: () => void; onStop: () => void;
  localEngine?: LocalListeningEngine; createSpeakers: () => SpeakerServices;
  colours: SpeakerColourChoices; onColours: (colours: SpeakerColourChoices) => void;
  hiddenSpeakers: string[]; onHiddenSpeakers: (ids: string[]) => void;
  extraSettings?: ReactNode; processingDescription?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pointerStartedOutside = useRef(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const outsidePanel = (event: PointerEvent<HTMLDialogElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  return <dialog className="settings-dialog" ref={dialog} aria-labelledby="settings-title" onClose={onClose}
    onPointerDown={(event) => { pointerStartedOutside.current = event.button === 0 && outsidePanel(event); }}
    onPointerUp={(event) => {
      if (pointerStartedOutside.current && outsidePanel(event)) event.currentTarget.close();
      pointerStartedOutside.current = false;
    }} onPointerCancel={() => { pointerStartedOutside.current = false; }}>
    <header className="settings-header">
      <form method="dialog"><button className="icon-button" aria-label="Back to captions" autoFocus><Icon name="back" /></button></form>
      <h2 id="settings-title">Settings</h2>
    </header>
    <div className="settings-content">
    <SpeakerSettings createServices={createSpeakers} canRecord={!active} onStop={onStop} colours={colours} onColours={onColours}
      hiddenSpeakers={hiddenSpeakers} onHiddenSpeakers={onHiddenSpeakers} />
    {extraSettings}
    {localEngine && <NameSuggestions engine={localEngine} />}
    {installFailed && <p role="status">Offline installation unavailable.</p>}
    <details><summary>About</summary>
      <p>{processingDescription ?? 'Speech uses your browser’s provider. Voiceprints stay on this device.'}</p>
      <p><a href={`${import.meta.env.BASE_URL}speaker/THIRD-PARTY-NOTICES.txt`} target="_blank" rel="noreferrer">Voice model licences</a>
        {' · '}<a href={`${import.meta.env.BASE_URL}local/THIRD-PARTY-NOTICES.txt`} target="_blank" rel="noreferrer">Speech model licences</a>
        {' · '}<a href={`${import.meta.env.BASE_URL}fonts/OFL.txt`} target="_blank" rel="noreferrer">Font licence</a></p>
    </details>
    <section className="caption-preferences" aria-label="Caption preferences">
      <div className="display-control" role="group" aria-labelledby="text-size-label">
        <span id="text-size-label" className="field-label">Text size</span>
        <div className="text-controls">
          <button aria-label="Smaller text" disabled={textSize <= 28} onClick={() => onTextSize(textSize - 4)}>A−</button>
          <span className="size-preview" aria-live="polite" aria-label={`Text size ${textSize} pixels`} style={{ fontSize: `${textSize / 16}rem` }}>{textSize}</span>
          <button aria-label="Larger text" disabled={textSize >= 56} onClick={() => onTextSize(textSize + 4)}>A+</button>
        </div>
      </div>
      <label className="language display-control"><span className="field-label">Speech language</span>
        <select value={language} disabled={active} onChange={(event) => onLanguage(event.target.value)}>
          <option value="en-GB">English (UK)</option><option value="en-US">English (US)</option>
          <option value="fr-FR">Français</option><option value="de-DE">Deutsch</option><option value="es-ES">Español</option>
        </select>
      </label>
    </section>
    </div>
  </dialog>;
}
