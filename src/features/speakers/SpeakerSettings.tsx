import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { watchInterruptions } from '../../audio/interruption';
import type { ProfileStore, ProfileSummary } from '../../storage/profiles';
import type { EnrolmentSession } from './enrolment';
import type { VoiceComparisonSession } from './comparison';
import { VoiceComparison } from './VoiceComparison';
import type { SpeakerColourChoices } from './colours';
import { SpeakerPill } from './SpeakerPill';
import { ENROLMENT_SECONDS, READING_PASSAGE } from './reading-passage';

export type SpeakerServices = { store: ProfileStore; session: EnrolmentSession; comparison: VoiceComparisonSession };
export function SpeakerSettings({ onStop, createServices, canRecord, colours, onColours, hiddenSpeakers, onHiddenSpeakers }: {
  onStop: () => void; createServices: () => SpeakerServices; canRecord: boolean;
  colours: SpeakerColourChoices; onColours: (colours: SpeakerColourChoices) => void;
  hiddenSpeakers: string[]; onHiddenSpeakers: (ids: string[]) => void;
}) {
  const comparisonButton = useRef<HTMLButtonElement>(null);
  const passage = useRef<HTMLDivElement>(null);
  const [{ store, session, comparison }] = useState(createServices);
  const [comparing, setComparing] = useState(false);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [storageError, setStorageError] = useState('');
  const [storageBusy, setStorageBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [profileId, setProfileId] = useState('');
  const selectedProfile = profiles.find((profile) => profile.id === profileId);
  const [confirmClear, setConfirmClear] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const alive = useRef(true);
  useEffect(() => { if (!comparing) { comparisonButton.current?.focus(); void session.restore(); } }, [comparing, session]);
  useEffect(() => { if (snapshot.phase === 'recording') passage.current?.scrollIntoView({ block: 'start' }); }, [snapshot.phase]);
  const busy = ['checking', 'preparing', 'recording', 'processing', 'saving'].includes(snapshot.phase);
  const ready = ['ready', 'saved'].includes(snapshot.phase);
  const refresh = useCallback(() => store.list().then(
    (rows) => { if (alive.current) { setProfiles(rows); setStorageError(''); } },
    (error: unknown) => { if (alive.current) setStorageError(error instanceof Error ? error.message : 'Could not open speaker storage.'); },
  ), [store]);
  useEffect(() => {
    alive.current = true; void refresh();
    const unwatch = watchInterruptions(() => { session.cancel(); comparison.cancel(); });
    return () => { alive.current = false; unwatch(); session.dispose(); comparison.dispose(); store.close(); };
  }, [refresh, session, comparison, store]);
  const remove = async (id?: string) => {
    setStorageBusy(true);
    try {
      if (id) await store.remove(id); else await store.clear();
      if (!id || id === profileId) setProfileId('');
      onColours(id ? Object.fromEntries(Object.entries(colours).filter(([key]) => key !== id)) : {});
      onHiddenSpeakers(id ? hiddenSpeakers.filter((key) => key !== id) : []);
      await refresh();
    }
    catch (error) { if (alive.current) setStorageError(error instanceof Error ? error.message : 'Could not delete speaker profiles.'); }
    finally { if (alive.current) { setStorageBusy(false); setConfirmClear(false); } }
  };
  const record = async () => {
    await session.record(selectedProfile?.displayName ?? displayName, selectedProfile?.id);
    if (alive.current) {
      if (session.getSnapshot().phase === 'saved') { setDisplayName(''); setProfileId(''); }
      await refresh();
    }
  };
  return <>
    <section aria-labelledby="saved-speakers-title">
      <h3 id="saved-speakers-title">People &amp; colours</h3>
      {profiles.length === 0 && !storageError && <p>No speakers yet.</p>}
      <ul className="speaker-list">{profiles.map((profile) => <SpeakerPill key={profile.id} profile={profile} colours={colours}
        active={!hiddenSpeakers.includes(profile.id)} onToggle={() => onHiddenSpeakers(hiddenSpeakers.includes(profile.id)
          ? hiddenSpeakers.filter((id) => id !== profile.id) : [...hiddenSpeakers, profile.id])}
        disabled={busy || storageBusy} onColour={(colour) => onColours({ ...colours, [profile.id]: colour })} onDelete={() => void remove(profile.id)} />)}</ul>
      {storageError && <p role="alert" className="error">{storageError}</p>}
      {(profiles.length > 0 || storageError) && <details open={moreOpen} onToggle={(event) => setMoreOpen(event.currentTarget.open)}><summary>More</summary>
        {profiles.length > 0 && <button ref={comparisonButton} disabled={['recording', 'processing', 'saving'].includes(snapshot.phase) || storageBusy} onClick={() => { session.cancel(); setComparing(!comparing); }}>Compare recordings</button>}
        {confirmClear ? <div><p>Delete all saved voice profiles on this device?</p>
          <button disabled={busy || storageBusy} onClick={() => void remove()}>Confirm delete all</button>
          <button onClick={() => setConfirmClear(false)}>Keep profiles</button>
        </div> : <button disabled={busy || storageBusy} onClick={() => setConfirmClear(true)}>Delete all profiles</button>}
      </details>}
    </section>
    {comparing && <VoiceComparison session={comparison} profiles={profiles} canRecord={canRecord} onBack={() => {
      comparison.cancel(); setComparing(false); void refresh();
    }} />}
    <section aria-labelledby="add-speaker-title">
      <h3 id="add-speaker-title">Add a speaker</h3>
      <div className="registration-fields">
      {profiles.length > 0 && <label className="speaker-name">Voice to record<select value={profileId} disabled={busy || comparing}
        onChange={(event) => setProfileId(event.target.value)}>
        <option value="">New speaker</option>
        {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
      </select></label>}
      {!selectedProfile && <label className="speaker-name">Display name<input value={displayName} maxLength={60} autoComplete="off" disabled={busy || comparing}
        onChange={(event) => setDisplayName(event.target.value)} /></label>}
      </div>
      <div ref={passage} className="reading-passage" aria-labelledby="reading-passage-title">
        <h4 id="reading-passage-title">Read aloud</h4>
        <p>{READING_PASSAGE}</p>
        <p className="reading-hint">Use your normal voice. Repeat if you finish early.</p>
      </div>
      {session.recorder.unavailableReason && <p role="alert" className="notice">{session.recorder.unavailableReason}</p>}
      {!canRecord && <button onClick={onStop}>Stop listening to record</button>}
      <p role="status" className={['idle', 'ready'].includes(snapshot.phase) ? 'sr-only' : undefined} aria-live="polite" aria-atomic="true">{snapshot.message}</p>
      {snapshot.phase === 'recording' && <progress aria-label="Recording progress" value={snapshot.seconds} max={ENROLMENT_SECONDS} />}
      {!ready && !busy && <button disabled={comparing || Boolean(session.recorder.unavailableReason) || storageBusy} onClick={() => void session.prepare()}>Prepare voice model</button>}
      {ready && <>
        <button disabled={!canRecord || comparing || !(selectedProfile?.displayName ?? displayName).trim() || Boolean(storageError) || storageBusy}
          onClick={() => void record()}>{selectedProfile ? 'Update voice' : 'Record'} ({ENROLMENT_SECONDS} seconds)</button>
      </>}
      {busy && <button onClick={() => session.cancel()}>Cancel enrolment</button>}
    </section>
  </>;
}
