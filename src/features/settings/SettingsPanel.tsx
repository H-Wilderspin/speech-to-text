import { useEffect, useState } from 'react';
import type { WakeStatus } from '../../app/screen-wake-lock';
import { MealAccessSettings } from '../meals/MealAccessSettings';
import { DeviceAccessSettings } from '../meals/DeviceAccessSettings';
import { familyServiceUrl, isDeviceToken } from '../planners/family-service';
import type { MealAccess } from '../meals/editor-token';
import { AppUpdate } from './AppUpdate';
import type { ColourTheme } from './preferences';

export function SettingsPanel({ active, beforeUpdate, textSize, onTextSize, language, onLanguage, theme, onTheme, installFailed, onBusy, onUpdating, wakeStatus, mealAccess, onMealToken, needsToken, onAccessError }: {
  active: boolean; textSize: number; onTextSize: (size: number) => void;
  beforeUpdate: () => Promise<boolean>;
  language: string; onLanguage: (language: string) => void; installFailed: boolean;
  theme: ColourTheme; onTheme: (theme: ColourTheme) => void;
  onBusy: (busy: boolean) => void; onUpdating: (updating: boolean) => void;
  wakeStatus?: WakeStatus;
  mealAccess: MealAccess; onMealToken: (token: string) => void; needsToken: boolean;
  onAccessError: (token: string) => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const busy = connecting || updating;
  const AccessSettings = familyServiceUrl || isDeviceToken(mealAccess.token) ? DeviceAccessSettings : MealAccessSettings;
  useEffect(() => { onBusy(busy); return () => onBusy(false); }, [busy, onBusy]);
  return <section id="settings-panel" className="app-panel settings-panel" aria-labelledby="settings-title">
    <header className="settings-header"><h2 id="settings-title">Settings</h2></header>
    <div className="settings-content">
    <AppUpdate active={active} beforeUpdate={beforeUpdate} busy={busy} onBusy={value => { setUpdating(value); onUpdating(value); }} />
    {installFailed && <p role="status">Offline installation unavailable.</p>}
    {wakeStatus === 'held' && <p role="status">Keeping screen awake.</p>}
    {wakeStatus === 'unavailable' && <p role="status">Screen may sleep. Check your device’s Auto-Lock settings.</p>}
    <fieldset className="settings-fields" disabled={updating}>
    <section className="caption-preferences" aria-label="Caption preferences">
      <div className="display-control" role="group" aria-labelledby="text-size-label">
        <span id="text-size-label" className="field-label">Caption text size</span>
        <div className="text-controls">
          <button aria-label="Smaller text" disabled={textSize <= 28} onClick={() => onTextSize(textSize - 4)}>A−</button>
          <span className="size-preview" aria-live="polite" aria-label={`Caption text size ${textSize} pixels`} style={{ fontSize: `${textSize / 16}rem` }}>{textSize}</span>
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
    <section className="appearance-preferences" aria-label="Appearance">
      <div className="display-control">
        <label htmlFor="colour-theme">Colour theme</label>
        <select id="colour-theme" value={theme} onChange={event => onTheme(event.target.value as ColourTheme)}>
          <option value="earth">Earthy greens</option>
          <option value="coral">Coral — high contrast</option>
          <option value="navy">Navy blue / grey</option>
        </select>
      </div>
      <p className="appearance-note">Your colour theme is remembered on this device.</p>
    </section>
    <AccessSettings needsToken={needsToken} onAccessError={onAccessError} access={mealAccess} onToken={onMealToken} onBusy={setConnecting} />
    </fieldset>
    <details><summary>About</summary>
      <p>Speech uses your browser’s provider. Captions are not saved.</p>
      <p><a href={`${import.meta.env.BASE_URL}fonts/OFL.txt`} target="_blank" rel="noreferrer">Font licence</a></p>
    </details>
    </div>
  </section>;
}
