import { useEffect, useState, useSyncExternalStore } from 'react';
import { speakerModel } from '../../identification/model';
import type { ProfileSummary } from '../../storage/profiles';
import { type DeclaredRelation, type VoiceComparisonSession } from './comparison';

export function VoiceComparison({ session, profiles, canRecord, onBack }: {
  session: VoiceComparisonSession; profiles: readonly ProfileSummary[]; canRecord: boolean; onBack: () => void;
}) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useEffect(() => { void session.restore(); }, [session]);
  const [reference, setReference] = useState(''); const [relation, setRelation] = useState<DeclaredRelation | ''>('');
  const [consent, setConsent] = useState(false);
  const busy = ['checking', 'preparing', 'recording', 'processing'].includes(snapshot.phase);
  const ready = ['ready', 'complete'].includes(snapshot.phase);
  const compatible = profiles.filter((profile) => profile.modelVersion === speakerModel.version);
  const last = snapshot.trials.at(-1);
  return <section className="comparison" aria-labelledby="comparison-title">
    <h3 id="comparison-title">Compare recordings</h3>
    <button autoFocus onClick={onBack}>Back to saved speakers</button>
    <p>This experiment measures similarity to one saved voice. It does not identify anyone. Declare whether the person making the new recording is the same person as the saved profile, or a different person.</p>
    <p>Audio and the new voiceprint are discarded. Results stay only while this comparison screen is open; they are cleared when you leave or the app is interrupted. Saved profiles are not changed.</p>
    {!compatible.length && <p>No profiles use the current voice model. Add a new speaker first.</p>}
    <label className="speaker-name">Saved voice to compare<select value={reference} disabled={busy} onChange={(event) => { setReference(event.target.value); setConsent(false); }}>
      <option value="">Choose a saved speaker</option>{compatible.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
    </select></label>
    <label className="speaker-name">Who is recording?<select value={relation} disabled={busy} onChange={(event) => { setRelation(event.target.value as DeclaredRelation | ''); setConsent(false); }}>
      <option value="">Choose the known relationship</option><option value="same">The same person</option><option value="different">A different person</option>
    </select></label>
    <label className="consent"><input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} />
      <span>The person recording agrees to this temporary voice comparison on this device. Their recording and new voiceprint will not be saved or uploaded.</span></label>
    <p>Use a fresh passage, rather than repeating the enrolment words. Speak alone for eight seconds and avoid personal information. Test both the same person and different people, including in a later session.</p>
    {session.recorder.unavailableReason && <p role="alert" className="notice">{session.recorder.unavailableReason}</p>}
    {!canRecord && <p>Waiting for live captions to release the microphone…</p>}
    <p role="status" aria-live="polite" aria-atomic="true">{snapshot.message}</p>
    {snapshot.phase === 'recording' && <progress aria-label="Comparison recording progress" value={snapshot.seconds} max={8} />}
    {!ready && !busy && <button disabled={Boolean(session.recorder.unavailableReason) || !compatible.length} onClick={() => void session.prepare()}>Prepare comparison</button>}
    {ready && <button disabled={!canRecord || !reference || !relation || !consent || snapshot.trials.length >= 20}
      onClick={() => void session.record(reference, relation, consent)}>Record comparison (8 seconds)</button>}
    {busy && <button onClick={() => session.cancel()}>Cancel comparison</button>}
    {last && <>
      <h4>Latest comparison</h4>
      <p>Reference: <strong>{last.referenceName}</strong>. Declared relationship: {last.relation === 'same' ? 'same person' : 'different person'}.</p>
      <p>Similarity score: <output aria-label="Similarity score">{last.score.toFixed(3)}</output></p>
      <p>The score ranges from −1 to 1. Higher means more similar; it is not a probability, confidence percentage or confirmed match. No match threshold has been validated.</p>
      <p>Voice processing: {(last.processingMs / 1000).toFixed(2)} seconds.</p>
      <details><summary>All {snapshot.trials.length} temporary results</summary>
        <ol>{snapshot.trials.map((trial, index) => <li key={index}>{trial.referenceName} — {trial.relation === 'same' ? 'same person' : 'different person'}: {trial.score.toFixed(3)}; {(trial.processingMs / 1000).toFixed(2)} seconds.</li>)}</ol>
        <p className="model-version">Model: {last.modelVersion}</p>
      </details>
      <button onClick={() => session.clearResults()} disabled={busy}>Clear comparison results</button>
    </>}
  </section>;
}
