import { useEffect, useRef, useState } from 'react';
import type { MealAccess } from './editor-token';
import { checkEditor, repositoryUrl } from './github-plan';
import { DisconnectGitHub } from './DisconnectGitHub';

export function MealAccessSettings({ access, onToken, onBusy }: {
  access: MealAccess; onToken: (token: string, remember?: boolean) => void; onBusy: (busy: boolean) => void;
}) {
  const [draftToken, setDraftToken] = useState('');
  const [remember, setRemember] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const tokenInput = useRef<HTMLInputElement>(null);
  const wasConnected = useRef(Boolean(access.token));
  useEffect(() => {
    if (wasConnected.current && !access.token) tokenInput.current?.focus();
    wasConnected.current = Boolean(access.token);
  }, [access.token]);

  return <section className="meal-access" aria-labelledby="meal-access-title">
    <h3 id="meal-access-title">Planner editing</h3>
    {access.notice && <p className="notice" role="status">{access.notice}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {access.token ? <>
      <p role="status">GitHub connected</p>
      <p>{access.remembered ? 'Remembered on this device. You can edit again when you reopen the app.' : 'Connected for this session only.'}</p>
      <DisconnectGitHub onDisconnect={() => { onToken(''); setError(''); }} />
      <p>Disconnect also removes saved access from this browser.</p>
    </> : <form onSubmit={async event => {
      event.preventDefault(); setConnecting(true); onBusy(true); setError('');
      try { onToken(await checkEditor(draftToken.trim()), remember); setDraftToken(''); }
      catch (error) { setError(error instanceof Error ? error.message : 'Could not connect to GitHub. Try again.'); }
      finally { setConnecting(false); onBusy(false); }
    }}>
      <p>Connect your GitHub access token to edit meals, tasks and shopping. Reading the public lists needs no token.</p>
      <label htmlFor="github-token">GitHub token</label>
      <input id="github-token" ref={tokenInput} type="password" autoComplete="off" spellCheck={false} required value={draftToken} disabled={connecting} onChange={event => setDraftToken(event.target.value)} />
      <label className="remember-access"><input type="checkbox" checked={remember} disabled={connecting} aria-describedby="remember-access-note" onChange={event => setRemember(event.target.checked)} />Remember on this device</label>
      <p id="remember-access-note">Use on a personal device. Anyone using this browser can edit with remembered access. Leave unchecked to connect for this session only.</p>
      <button disabled={connecting || !draftToken.trim()}>{connecting ? 'Connecting…' : 'Connect GitHub'}</button>
      <p><a href="https://github.com/settings/personal-access-tokens/new?name=Meal+planner&target_name=H-Wilderspin&contents=write&expires_in=90" target="_blank" rel="noreferrer">Create an owner token</a>: select only <strong>speech-to-text-meals</strong>, with Contents read/write.</p>
      <p>Other family editors can <a href={`${repositoryUrl}/tree/main/weeks`} target="_blank" rel="noreferrer">edit on GitHub</a> with their own account and repository access.</p>
    </form>}
  </section>;
}
