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
  const busy = ['checking', 'preparing', 'recording', 'processing'].includes(snapshot.phase);
  const ready = ['ready', 'complete'].includes(snapshot.phase);
  const compatible = profiles.filter((profile) => profile.modelVersion === speakerModel.version);
  const last = snapshot.trials.at(-1);
  return <section className="comparison" aria-labelledby="comparison-title">
    <h3 id="comparison-title">Compare recordings</h3>
    <button autoFocus onClick={onBack}>Close comparison</button>
    {!compatible.length && <p>No profiles use the current voice model. Add a new speaker first.</p>}
    <label className="speaker-name">Saved voice to compare<select value={reference} disabled={busy} onChange={(event) => setReference(event.target.value)}>
      <option value="">Choose a saved speaker</option>{compatible.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
    </select></label>
    <label className="speaker-name">Who is recording?<select value={relation} disabled={busy} onChange={(event) => setRelation(event.target.value as DeclaredRelation | '')}>
      <option value="">Choose the known relationship</option><option value="same">The same person</option><option value="different">A different person</option>
    </select></label>
    {session.recorder.unavailableReason && <p role="alert" className="notice">{session.recorder.unavailableReason}</p>}
    {!canRecord && <p>Waiting for live captions to release the microphone…</p>}
    <p role="status" aria-live="polite" aria-atomic="true">{snapshot.message}</p>
    {snapshot.phase === 'recording' && <progress aria-label="Comparison recording progress" value={snapshot.seconds} max={8} />}
    {!ready && !busy && <button disabled={Boolean(session.recorder.unavailableReason) || !compatible.length} onClick={() => void session.prepare()}>Prepare comparison</button>}
    {ready && <button disabled={!canRecord || !reference || !relation || snapshot.trials.length >= 20}
      onClick={() => void session.record(reference, relation)}>Record comparison (8 seconds)</button>}
    {busy && <button onClick={() => session.cancel()}>Cancel comparison</button>}
    {last && <>
      <h4>Latest comparison</h4>
      <p>Reference: <strong>{last.referenceName}</strong>. Declared relationship: {last.relation === 'same' ? 'same person' : 'different person'}.</p>
      <p>Similarity score: <output aria-label="Similarity score">{last.score.toFixed(3)}</output></p>
      <p>Higher means more similar, not a confirmed match.</p>
      <p>Voice processing: {(last.processingMs / 1000).toFixed(2)} seconds.</p>
      <details><summary>All {snapshot.trials.length} temporary results</summary>
        <ol>{snapshot.trials.map((trial, index) => <li key={index}>{trial.referenceName} — {trial.relation === 'same' ? 'same person' : 'different person'}: {trial.score.toFixed(3)}; {(trial.processingMs / 1000).toFixed(2)} seconds.</li>)}</ol>
        <p className="model-version">Model: {last.modelVersion}</p>
      </details>
      <button onClick={() => session.clearResults()} disabled={busy}>Clear comparison results</button>
    </>}
  </section>;
}
