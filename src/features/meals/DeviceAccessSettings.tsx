import { useEffect, useRef, useState } from 'react';
import type { MealAccess } from './editor-token';
import { checkEditor } from '../planners/github';
import { DeviceAccessError, isDeviceToken, newDeviceToken, pairDevice } from '../planners/family-service';

export function DeviceAccessSettings({ access, needsToken, onAccessError, onToken, onBusy }: {
  access: MealAccess; needsToken: boolean; onAccessError: (token: string) => void;
  onToken: (token: string) => void; onBusy: (busy: boolean) => void;
}) {
  const [code, setCode] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  // Keep the same secret across retries so a lost pairing response is recoverable.
  const candidate = useRef('');
  const input = useRef<HTMLInputElement>(null);
  const paired = isDeviceToken(access.token);
  useEffect(() => {
    if (needsToken) input.current?.focus();
  }, [needsToken]);
  useEffect(() => {
    if (!paired || needsToken) return;
    let current = true;
    void checkEditor(access.token).catch(error => {
      if (!current) return;
      if (error instanceof DeviceAccessError) onAccessError(access.token);
      else setError(error instanceof Error ? error.message : 'Could not check the family connection.');
    });
    return () => { current = false; };
  }, [access.token, paired, needsToken, onAccessError]);
  return <section className="meal-access" aria-labelledby="meal-access-title">
    <h3 id="meal-access-title">Family connection</h3>
    {access.notice && <p role="status">{access.notice}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {paired && !needsToken ? <>
      <p role="status">This device is connected.</p>
      <p>{access.remembered ? 'You can edit meals and shopping whenever you open the app.' : 'Connected for this session. This browser could not remember access.'}</p>
      <p>Changes are kept on this device and shared with your family when connected.</p>
    </> : <form onSubmit={async event => {
      event.preventDefault(); setConnecting(true); onBusy(true); setError('');
      candidate.current ||= newDeviceToken();
      try { onToken(await pairDevice(code.trim(), candidate.current)); setCode(''); candidate.current = ''; }
      catch (error) { setError(error instanceof Error ? error.message : 'Could not connect. Try again.'); }
      finally { setConnecting(false); onBusy(false); }
    }}>
      {needsToken && <p>Your device needs a new family connection. Your changes are still here.</p>}
      {access.token && !paired && <p>You can now use a family pairing code instead of a GitHub token. Connecting keeps your meals, shopping and saved changes.</p>}
      <p>Connect this device once to edit meals and shopping.</p>
      <ol id="family-code-help">
        <li>Ask the family member who looks after the app for a pairing code.</li>
        <li>Type or paste the six-digit code below.</li>
        <li>Tap <strong>Connect this device</strong>. We will remember the connection.</li>
      </ol>
      <p>Each code works for one device and lasts 24 hours. Once connected, this device stays connected. Ask for a new code if it has expired or already been used.</p>
      <label htmlFor="family-code">Pairing code</label>
      <input id="family-code" ref={input} value={code} onChange={event => { setCode(event.target.value); candidate.current = ''; }}
        aria-describedby="family-code-help" inputMode="numeric" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} maxLength={40} required disabled={connecting} />
      <button disabled={connecting || !code.trim()}>{connecting ? 'Connecting…' : 'Connect this device'}</button>
    </form>}
  </section>;
}
