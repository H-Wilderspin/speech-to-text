import { useRef, useState } from 'react';
import type { ProfileSummary } from '../../storage/profiles';
import { Icon } from '../../shared/Icon';
import { colourNames, speakerColour, speakerColours, type SpeakerColourChoices } from './colours';

export function SpeakerPill({ profile, colours, disabled, onColour, onDelete, active, onToggle }: {
  profile: ProfileSummary; colours: SpeakerColourChoices; disabled: boolean;
  onColour(colour: string): void; onDelete(): void;
  active: boolean; onToggle(): void;
}) {
  const [action, setAction] = useState<'colour' | 'delete' | null>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const colour = speakerColour(profile.id, colours);
  return <li className="speaker-entry">
    <div className="speaker-pill" style={{ borderColor: colour }}>
      <strong style={{ color: colour }}>{profile.displayName}</strong>
      <button className="icon-button speaker-activity" aria-label={`Show ${profile.displayName} in Who said what`} aria-pressed={active}
        title={active ? 'Hide from Who said what' : 'Show in Who said what'} disabled={disabled} onClick={onToggle}>
        <Icon name={active ? 'visible' : 'hidden'} /></button>
      <button className="icon-button" aria-label={`Change colour for ${profile.displayName}`} aria-expanded={action === 'colour'}
        disabled={disabled} onClick={() => setAction(action === 'colour' ? null : 'colour')}><Icon name="colour" /></button>
      <button className="icon-button" ref={deleteButton} aria-label={`Delete ${profile.displayName}`} aria-expanded={action === 'delete'}
        disabled={disabled} onClick={() => setAction(action === 'delete' ? null : 'delete')}><Icon name="delete" /></button>
    </div>
    {action === 'colour' && <div className="colour-options" role="group" aria-label={`Colour for ${profile.displayName}`}>
      {speakerColours.map((value, index) => <button key={value} className="colour-swatch" aria-label={colourNames[index]} aria-pressed={colour === value}
        disabled={disabled} style={{ color: value }} onClick={() => onColour(value)}><span style={{ backgroundColor: value }} />{colour === value && <span className="swatch-check" aria-hidden="true">✓</span>}</button>)}
    </div>}
    {action === 'delete' && <div className="delete-confirmation" role="group" aria-label={`Delete ${profile.displayName}?`}>
      <p>Delete {profile.displayName}?</p>
      <button autoFocus disabled={disabled} onClick={() => { setAction(null); deleteButton.current?.focus(); }}>Cancel</button>
      <button className="danger" disabled={disabled} aria-label={`Confirm delete ${profile.displayName}`} onClick={onDelete}>Delete</button>
    </div>}
  </li>;
}
