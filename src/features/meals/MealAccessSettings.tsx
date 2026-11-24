import { useEffect, useRef, useState } from 'react';
import type { MealAccess } from './editor-token';
import { checkEditor, repositoryUrl } from '../planners/github';
import { DisconnectGitHub } from './DisconnectGitHub';
import { GitHubAccessError } from '../planners/github';

export function MealAccessSettings({ access, onToken, onBusy, needsToken, onAccessError }: {
  access: MealAccess; onToken: (token: string) => void; needsToken: boolean; onBusy: (busy: boolean) => void;
  onAccessError: (token: string) => void;
}) {
  const [draftToken, setDraftToken] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const tokenInput = useRef<HTMLInputElement>(null);
  const wasConnected = useRef(Boolean(access.token));
  useEffect(() => {
    if (wasConnected.current && !access.token) tokenInput.current?.focus();
    wasConnected.current = Boolean(access.token);
  }, [access.token]);

  useEffect(() => { if (needsToken || replacing) tokenInput.current?.focus(); }, [needsToken, replacing]);
  useEffect(() => {
    if (!access.token || needsToken) return;
    let current = true;
    void checkEditor(access.token).catch(error => {
      if (!current) return;
      if (error instanceof GitHubAccessError) onAccessError(access.token);
      else setError(error instanceof Error ? error.message : 'Could not check the connection. Try again.');
    });
    return () => { current = false; };
  }, [access.token, needsToken, onAccessError]);

  return <section className="meal-access" aria-labelledby="meal-access-title">
    <h3 id="meal-access-title">Planner editing</h3>
    {access.notice && <p className="notice" role="status">{access.notice}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {access.token && !needsToken && !replacing ? <>
      <p role="status">GitHub connected</p>
      <p>{access.remembered ? 'Remembered on this device. You can edit again when you reopen the app.' : 'Connected for this session only.'}</p>
      <button onClick={() => setReplacing(true)}>Change token</button>
      <DisconnectGitHub onDisconnect={() => { onToken(''); setError(''); }} />
      <p>Disconnect also removes saved access from this browser.</p>
    </> : <form onSubmit={async event => {
      event.preventDefault(); setConnecting(true); onBusy(true); setError('');
      try { onToken(await checkEditor(draftToken.trim())); setDraftToken(''); setReplacing(false); }
      catch (error) { setError(error instanceof Error ? error.message : 'Could not connect to GitHub. Try again.'); }
      finally { setConnecting(false); onBusy(false); }
    }}>
      {needsToken && <p role="status">Your saved token is no longer working. Enter a new token below to reconnect.</p>}
      <p>Connect your GitHub access token to edit meals and shopping. Reading the public lists needs no token.</p>
      <label htmlFor="github-token">GitHub token</label>
      <input id="github-token" ref={tokenInput} type="password" autoComplete="off" spellCheck={false} required value={draftToken} disabled={connecting} onChange={event => setDraftToken(event.target.value)} />
      <p>Your connection is saved automatically on this device.</p>
      <button disabled={connecting || !draftToken.trim()}>{connecting ? 'Connecting…' : access.token ? 'Save new token' : 'Connect GitHub'}</button>
      <p><a href="https://github.com/settings/personal-access-tokens/new?name=Meal+planner&target_name=H-Wilderspin&contents=write&expires_in=90" target="_blank" rel="noreferrer">Create an owner token</a>: select only <strong>speech-to-text-meals</strong>, with Contents read/write.</p>
      <p>Other family editors can <a href={`${repositoryUrl}/tree/main/weeks`} target="_blank" rel="noreferrer">edit on GitHub</a> with their own account and repository access.</p>
    </form>}
  </section>;
}
