import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { watchInterruptions } from '../../audio/interruption';
import type { ProfileStore, ProfileSummary } from '../../storage/profiles';
import type { EnrolmentSession } from './enrolment';
import type { VoiceComparisonSession } from './comparison';
import { VoiceComparison } from './VoiceComparison';

export type SpeakerServices = { store: ProfileStore; session: EnrolmentSession; comparison: VoiceComparisonSession };
export function SpeakersDialog({ onClose, createServices, canRecord }: {
  onClose: () => void; createServices: () => SpeakerServices; canRecord: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const comparisonButton = useRef<HTMLButtonElement>(null);
  const [{ store, session, comparison }] = useState(createServices);
  const [comparing, setComparing] = useState(false);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [storageError, setStorageError] = useState('');
  const [storageBusy, setStorageBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [consent, setConsent] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const alive = useRef(true);
  useEffect(() => { if (!comparing) comparisonButton.current?.focus(); }, [comparing]);
  const busy = ['preparing', 'recording', 'processing', 'saving'].includes(snapshot.phase);
  const ready = ['ready', 'saved'].includes(snapshot.phase);
  const refresh = useCallback(() => store.list().then(
    (rows) => { if (alive.current) { setProfiles(rows); setStorageError(''); } },
    (error: unknown) => { if (alive.current) setStorageError(error instanceof Error ? error.message : 'Could not open speaker storage.'); },
  ), [store]);
  useEffect(() => {
    alive.current = true; dialog.current?.showModal(); void refresh();
    const unwatch = watchInterruptions(() => { session.cancel(); comparison.cancel(); });
    return () => { alive.current = false; unwatch(); session.dispose(); comparison.dispose(); store.close(); };
  }, [refresh, session, comparison, store]);
  const remove = async (id?: string) => {
    setStorageBusy(true);
    try { if (id) await store.remove(id); else await store.clear(); await refresh(); }
    catch (error) { if (alive.current) setStorageError(error instanceof Error ? error.message : 'Could not delete speaker profiles.'); }
    finally { if (alive.current) { setStorageBusy(false); setConfirmClear(false); } }
  };
  const record = async () => {
    await session.record(displayName, consent);
    if (alive.current) {
      if (session.getSnapshot().phase === 'saved') { setDisplayName(''); setConsent(false); }
      await refresh();
    }
  };
  return <dialog ref={dialog} aria-labelledby="speakers-title" onClose={onClose}>
    <span className="eyebrow">Experimental voice profiles</span>
    <h2 id="speakers-title">Speakers on this device</h2>
    <p>Save profiles here to use in Compare recordings. Live captions do not use saved profiles yet and always show <strong>Unknown</strong>, even after a successful comparison.</p>
    <form method="dialog"><button autoFocus>Back to settings</button></form>
    {comparing ? <VoiceComparison session={comparison} profiles={profiles} canRecord={canRecord} onBack={() => {
      comparison.cancel(); setComparing(false); void refresh();
    }} /> : <>
    <section aria-labelledby="saved-speakers-title">
      <h3 id="saved-speakers-title">Saved speakers</h3>
      {profiles.length === 0 && !storageError && <p>No saved speakers on this device.</p>}
      <ul className="speaker-list">{profiles.map((profile) => <li key={profile.id}>
        <span><strong>{profile.displayName}</strong><small>Saved {new Date(profile.createdAt).toLocaleDateString()}</small></span>
        <button disabled={busy || storageBusy} aria-label={`Delete ${profile.displayName}`} onClick={() => void remove(profile.id)}>Delete</button>
      </li>)}</ul>
      {profiles.length > 0 && <button ref={comparisonButton} disabled={busy || storageBusy} onClick={() => { session.cancel(); setComparing(true); }}>Compare recordings</button>}
      {storageError && <p role="alert" className="error">{storageError}</p>}
      {(profiles.length > 0 || storageError) && <>
        {confirmClear ? <div><p>Delete all saved voice profiles on this device?</p>
          <button disabled={busy || storageBusy} onClick={() => void remove()}>Confirm delete all</button>
          <button onClick={() => setConfirmClear(false)}>Keep profiles</button>
        </div> : <button disabled={busy || storageBusy} onClick={() => setConfirmClear(true)}>Delete all profiles</button>}
      </>}
    </section>
    <section aria-labelledby="add-speaker-title">
      <h3 id="add-speaker-title">Add a speaker</h3>
      <p>Record only one person, with their permission. The recording is processed here and discarded after processing. Only the name, consent details and voiceprint are saved in this browser. They are not synced or uploaded; deleting site data removes them.</p>
      <p>The English voice model and runtime download about 39 MB when you prepare them. Your browser may cache these public files. Offline enrolment is not guaranteed.</p>
      <label className="speaker-name">Display name<input value={displayName} maxLength={60} autoComplete="off" disabled={busy}
        onChange={(event) => setDisplayName(event.target.value)} /></label>
      <label className="consent"><input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} />
        <span>This speaker agrees to record their voice and save a voiceprint on this device. They understand it can be deleted here.</span></label>
      {session.recorder.unavailableReason && <p role="alert" className="notice">{session.recorder.unavailableReason}</p>}
      {!canRecord && <p>Waiting for live captions to release the microphone…</p>}
      <p role="status" aria-live="polite" aria-atomic="true">{snapshot.message}</p>
      {snapshot.phase === 'recording' && <progress aria-label="Recording progress" value={snapshot.seconds} max={8} />}
      {!ready && !busy && <button disabled={Boolean(session.recorder.unavailableReason) || storageBusy} onClick={() => void session.prepare()}>Prepare voice model</button>}
      {ready && <>
        <p>Speak naturally for eight seconds. For example, describe the weather and what you would like to do today. Avoid personal information.</p>
        <button disabled={!canRecord || !consent || !displayName.trim() || Boolean(storageError) || storageBusy}
          onClick={() => void record()}>Record 8 seconds</button>
      </>}
      {busy && <button onClick={() => session.cancel()}>Cancel enrolment</button>}
      <p><a href={`${import.meta.env.BASE_URL}speaker/THIRD-PARTY-NOTICES.txt`} target="_blank" rel="noreferrer">Voice model and runtime licences</a></p>
    </section>
    </>}
  </dialog>;
}
