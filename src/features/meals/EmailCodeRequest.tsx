import { useEffect, useRef, useState } from 'react';
import { pairingEmailAddresses, requestPairingEmail } from '../planners/family-service';

export function EmailCodeRequest({ disabled, onBusy }: { disabled: boolean; onBusy: (busy: boolean) => void }) {
  const [emails, setEmails] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void pairingEmailAddresses().then(value => { if (mounted.current) setEmails(value); });
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    update();
    if (retryAt <= Date.now()) return;
    const timer = window.setInterval(() => {
      update();
      if (Date.now() >= retryAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  if (!emails.length) return null;
  return <form onSubmit={async event => {
    event.preventDefault();
    if (pending.current || Date.now() < retryAt || disabled || !emails.includes(email)) return;
    pending.current = true; setSending(true); onBusy(true); setError(''); setNotice('');
    // A lost response may still have sent a code. Never resend automatically.
    setRetryAt(Date.now() + 60000);
    try {
      const result = await requestPairingEmail(email);
      if (mounted.current) {
        setNotice(result.message);
        setRetryAt(Date.now() + result.retryAfter * 1000);
      }
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : 'Could not request a code. You can still use a code from the family administrator.');
    } finally {
      pending.current = false;
      if (mounted.current) setSending(false);
      onBusy(false);
    }
  }}>
    <p>Choose your email address to receive a pairing code.</p>
    <label htmlFor="family-email">Email address</label>
    <select id="family-email" required value={email} onChange={event => setEmail(event.target.value)} disabled={disabled || sending}
      aria-describedby="email-code-help">
      <option value="" disabled>Choose your email address</option>
      {emails.map(address => <option key={address} value={address}>{address}</option>)}
    </select>
    <p id="email-code-help">Emailed codes last 24 hours. Enter the newest code below. Once connected, this device stays connected.</p>
    <button disabled={disabled || sending || remaining > 0 || !emails.includes(email)}>
      {sending ? 'Requesting code…' : remaining > 0 ? `Send again in ${remaining}s` : 'Email me a code'}
    </button>
    {notice && <p role="status">{notice}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </form>;
}
