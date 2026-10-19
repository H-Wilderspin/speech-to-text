import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Icon } from '../../shared/Icon';
import type { WakeStatus } from '../../app/listening-wake-lock';
import { MealAccessSettings } from '../meals/MealAccessSettings';
import type { MealAccess } from '../meals/editor-token';

export function SettingsDialog({ active, textSize, onTextSize, language, onLanguage, installFailed, onClose, wakeStatus, mealAccess, onMealToken }: {
  active: boolean; textSize: number; onTextSize: (size: number) => void;
  language: string; onLanguage: (language: string) => void; installFailed: boolean;
  onClose: () => void;
  wakeStatus?: WakeStatus;
  mealAccess: MealAccess; onMealToken: (token: string, remember?: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
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
    onCancel={event => { if (busy) event.preventDefault(); }}
    onPointerDown={(event) => { pointerStartedOutside.current = event.button === 0 && outsidePanel(event); }}
    onPointerUp={(event) => {
      if (!busy && pointerStartedOutside.current && outsidePanel(event)) event.currentTarget.close();
      pointerStartedOutside.current = false;
    }} onPointerCancel={() => { pointerStartedOutside.current = false; }}>
    <header className="settings-header">
      <form method="dialog"><button className="icon-button" aria-label="Back to captions" disabled={busy} autoFocus><Icon /></button></form>
      <h2 id="settings-title">Settings</h2>
    </header>
    <div className="settings-content">
    {installFailed && <p role="status">Offline installation unavailable.</p>}
    {wakeStatus === 'held' && <p role="status">Keeping screen awake.</p>}
    {wakeStatus === 'unavailable' && <p role="status">Screen may sleep. Check your device’s Auto-Lock settings.</p>}
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
    <MealAccessSettings access={mealAccess} onToken={onMealToken} onBusy={setBusy} />
    <details><summary>About</summary>
      <p>Speech uses your browser’s provider. Captions are not saved.</p>
      <p><a href={`${import.meta.env.BASE_URL}fonts/OFL.txt`} target="_blank" rel="noreferrer">Font licence</a></p>
    </details>
    </div>
  </dialog>;
}
