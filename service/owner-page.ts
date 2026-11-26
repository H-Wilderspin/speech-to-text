// Static owner UI: no credentials or invitation data are embedded in the page.
// The nonce is replaced for each response by the Worker.
export const ownerPage = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow">
  <title>Pair a family device</title>
  <style nonce="__NONCE__">
    @font-face { font-family: Poppins; src: url('https://h-wilderspin.github.io/speech-to-text/fonts/Poppins-Regular.woff2') format('woff2'); font-display: swap; }
    :root { font-family: Poppins, sans-serif; color: #273022; background: #f5f6ef; line-height: 1.6; color-scheme: light; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body { margin: 0; padding: max(1.25rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1.25rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left)); }
    main { max-width: 32rem; margin: 2rem auto; }
    h1 { font-size: 1.8rem; line-height: 1.3; }
    h2 { font-size: 1.2rem; }
    p { overflow-wrap: anywhere; }
    .muted { color: #596451; }
    .card { padding: 1.25rem; background: #fffef9; border: 1px solid #d4dbc9; border-radius: 12px; margin: 1rem 0; }
    label { display: block; margin-bottom: .5rem; }
    input, button { font: inherit; min-height: 48px; border: 1px solid #6d795f; border-radius: 12px; padding: .7rem; }
    input { width: 100%; color: inherit; background: white; }
    button { cursor: pointer; color: #fff; background: #425b35; font-weight: 600; touch-action: manipulation; }
    button:disabled { opacity: .6; cursor: wait; }
    button.secondary { background: #e9efdf; color: #425b35; }
    :focus-visible { outline: 3px solid #425b35; outline-offset: 3px; }
    form button { width: 100%; margin-top: 1rem; }
    .actions { display: flex; flex-wrap: wrap; gap: .75rem; }
    .actions button { flex: 1 1 8rem; }
    #code { font: 600 clamp(2rem, 10vw, 3rem)/1.6 monospace; letter-spacing: .12em; user-select: all; overflow-wrap: anywhere; }
    #error { color: #bd002a; }
    #result { scroll-margin-top: 1rem; }
  </style>
</head>
<body>
<main>
  <p class="muted">Speech to Text · Family admin</p>
  <h1>Pair a family device</h1>
  <p>Create a code, then send it to the person connecting their phone or tablet.</p>
  <p id="status" role="status">Checking sign-in…</p>
  <p id="error" role="alert"></p>
  <section id="login" class="card" hidden>
    <h2>Owner sign-in</h2>
    <p class="muted">Use your owner key. Your password manager can save it for this page.</p>
    <form id="login-form">
      <input type="text" name="username" value="Family owner" autocomplete="username" hidden>
      <label for="owner-key">Owner key</label>
      <input id="owner-key" name="password" type="password" autocomplete="current-password" required maxlength="256" spellcheck="false" autocapitalize="none">
      <button id="sign-in" type="submit">Sign in</button>
    </form>
  </section>
  <section id="create" hidden>
    <form id="invite-form" class="card">
      <label for="label">Device name</label>
      <input id="label" name="label" placeholder="e.g. Granddad’s tablet" required maxlength="80" autocomplete="off" aria-describedby="code-help">
      <p id="code-help" class="muted">Each code connects one device and lasts 24 hours. You can have up to five unused codes at once.</p>
      <button id="generate" type="submit">Create pairing code</button>
    </form>
    <section id="result" class="card" aria-labelledby="result-title" hidden>
      <h2 id="result-title" tabindex="-1">Your pairing code</h2>
      <p id="device-name"></p>
      <p id="code"></p>
      <p id="expiry"></p>
      <p>Enter all six digits in <strong>Settings → Family connection</strong> in the Speech to Text app.</p>
      <div class="actions">
        <button id="copy" type="button">Copy code</button>
        <button id="share" type="button" class="secondary" hidden>Share instructions</button>
      </div>
      <p class="muted">Copy or share before leaving this page. Codes are not saved here.</p>
    </section>
    <button id="sign-out" type="button" class="secondary">Sign out</button>
    <p class="muted">Sign-in lasts 12 hours. Use this page only on your own device.</p>
  </section>
  <noscript>Turn on JavaScript to sign in and create a pairing code.</noscript>
</main>
<script nonce="__NONCE__">
  const element = id => document.getElementById(id);
  let invitation = null;
  let busy = false;
  const status = message => { element('status').textContent = message; };
  const error = message => { element('error').textContent = message; };
  function signedIn(value) {
    element('login').hidden = value;
    element('create').hidden = !value;
    if (!value) {
      invitation = null;
      element('result').hidden = true;
      element('code').textContent = '';
      element('device-name').textContent = '';
      element('expiry').textContent = '';
    }
  }
  async function request(path, options = {}) {
    const response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      if (response.status === 401) signedIn(false);
      const detail = await response.json().catch(() => ({}));
      throw new Error(response.status === 401 ? 'Sign in with your owner key to continue.' : detail.error || 'The service could not complete the request.');
    }
    return response.status === 204 ? null : response.json();
  }
  async function action(work) {
    if (busy) return;
    busy = true;
    error('');
    document.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try { await work(); }
    catch (failure) {
      status('');
      error(failure instanceof TypeError || failure.name === 'TimeoutError'
        ? 'Could not reach the service. Check your connection. If you were creating a code, it may have been created; unused codes expire after 24 hours.'
        : failure.message);
    }
    finally {
      busy = false;
      document.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
  }
  element('login-form').addEventListener('submit', event => {
    event.preventDefault();
    void action(async () => {
      status('Signing in…');
      try {
        await request('/admin/session', { method: 'POST', headers: { Authorization: 'Bearer ' + element('owner-key').value.trim() } });
      } finally { element('owner-key').value = ''; }
      // Check the cookie was accepted before presenting the invitation form.
      await request('/admin/session');
      signedIn(true);
      status('Signed in.');
      element('label').focus();
    });
  });
  element('invite-form').addEventListener('submit', event => {
    event.preventDefault();
    void action(async () => {
      const label = element('label').value.trim();
      if (!label) { element('label').focus(); throw new Error('Enter a device name.'); }
      status('Creating code…');
      const result = await request('/admin/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }) });
      invitation = { ...result, label };
      element('device-name').textContent = label;
      element('code').textContent = result.code;
      element('expiry').textContent = 'Expires ' + new Date(result.expires).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      element('result').hidden = false;
      element('share').hidden = typeof navigator.share !== 'function';
      status('Pairing code created.');
      element('result-title').focus();
    });
  });
  element('copy').addEventListener('click', async () => {
    if (!invitation) return;
    try { await navigator.clipboard.writeText(invitation.code); status('Code copied.'); }
    catch { status('Touch and hold the six-digit code to copy it.'); }
  });
  element('share').addEventListener('click', async () => {
    if (!invitation) return;
    try {
      await navigator.share({ title: 'Speech to Text pairing code', text: 'Pairing code for ' + invitation.label + ': ' + invitation.code + '. Open Speech to Text, then Settings → Family connection. Expires ' + new Date(invitation.expires).toLocaleString() + '. Use once for this device.' });
      status('Sharing finished.');
    } catch (failure) { if (failure.name !== 'AbortError') status('Sharing is unavailable. Copy the code instead.'); }
  });
  element('sign-out').addEventListener('click', () => void action(async () => {
    await request('/admin/session', { method: 'DELETE' });
    signedIn(false);
    status('Signed out.');
    element('owner-key').focus();
  }));
  // Revalidate after history restoration so a signed-out page does not reappear.
  window.addEventListener('pageshow', async () => {
    signedIn(false);
    try {
      await request('/admin/session');
      signedIn(true);
      status('Signed in.');
    } catch (failure) { status(failure.message); }
  });
</script>
</body>
</html>`;
