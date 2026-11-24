import { createServer } from 'node:http';
import { createPrivateKey, randomBytes, sign } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = 'H-Wilderspin/speech-to-text-meals';
const homepage = 'https://h-wilderspin.github.io/speech-to-text/';
const target = new URL('./secrets.local.json', import.meta.url);
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options, headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'speech-to-text-family-setup', ...options.headers },
    redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  // Do not print response bodies: manifest conversion returns private credentials.
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}. Check the App installation and try again.`);
  return response.json();
}

export async function finishInstallation(file = target, request = github) {
  const secrets = JSON.parse(readFileSync(file, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iat: now - 60, exp: now + 540, iss: secrets.GITHUB_APP_ID })}`;
  const jwt = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), secrets.GITHUB_PRIVATE_KEY).toString('base64url')}`;
  const installation = await request(`/repos/${repository}/installation`, { headers: { Authorization: `Bearer ${jwt}` } });
  if (String(installation.app_id) !== secrets.GITHUB_APP_ID || installation.repository_selection !== 'selected'
    || installation.account?.login?.toLowerCase() !== 'h-wilderspin' || installation.permissions?.contents !== 'write') {
    throw new Error('Install this App on H-Wilderspin with selected repositories and Contents read/write.');
  }
  // Confirm the installation contains ONLY the intended data repository.
  const access = await request(`/app/installations/${installation.id}/access_tokens`, { method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ permissions: { contents: 'read' } }) });
  const repos = await request('/installation/repositories?per_page=100', { headers: { Authorization: `Bearer ${access.token}` } });
  if (repos.total_count !== 1 || repos.repositories?.[0]?.full_name?.toLowerCase() !== repository.toLowerCase()) {
    throw new Error('Select only speech-to-text-meals in the GitHub App installation, then retry.');
  }
  secrets.GITHUB_INSTALLATION_ID = String(installation.id);
  const pendingFile = `${file instanceof URL ? fileURLToPath(file) : file}.local`;
  writeFileSync(pendingFile, JSON.stringify(secrets, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  renameSync(pendingFile, file); // Replace only after the complete credential file is written.
  return secrets.GITHUB_INSTALLATION_ID;
}

export async function startSetup({ file = target, port = 8977, request = github, onMessage = console.log } = {}) {
  if (existsSync(file)) throw new Error('Credentials already exist. Use --finish to check the installation; existing keys will not be replaced.');
  const state = randomBytes(32).toString('hex');
  let phase = 'new';
  let installUrl = '';
  let origin;
  let timer;
  const server = createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; form-action https://github.com; base-uri 'none'; frame-ancestors 'none'" });
      res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Family GitHub App setup</title><body>${body}</body></html>`);
    };
    if (req.headers.host !== new URL(origin).host || req.method !== 'GET') return reply(403, 'Request not allowed.');
    const url = new URL(req.url, origin);
    if (url.searchParams.get('state') !== state) return reply(403, 'This setup link is invalid. Use the link printed by the CLI.');
    try {
      if (url.pathname === '/' && phase === 'new') {
        const manifest = { name: `Family meals ${randomBytes(3).toString('hex')}`, url: homepage,
          description: 'Shared family meal and shopping editing.', public: false,
          hook_attributes: { url: homepage, active: false }, redirect_url: `${origin}/callback`,
          default_permissions: { contents: 'write' }, default_events: [], request_oauth_on_install: false };
        return reply(200, `<h1>Create the family GitHub App</h1><p>Sign in as H-Wilderspin. This private App requests Contents read/write and has webhooks disabled.</p>
          <p>On the following installation screen, select only <strong>speech-to-text-meals</strong>.</p>
          <form action="https://github.com/settings/apps/new?state=${state}" method="post">
          <input type="hidden" name="manifest" value="${escape(JSON.stringify(manifest))}"><button>Create on GitHub</button></form>`);
      }
      if (url.pathname === '/callback' && phase === 'new') {
        const code = url.searchParams.get('code');
        if (!code || !/^[a-zA-Z0-9_-]{1,256}$/.test(code)) return reply(400, 'Missing GitHub registration code.');
        phase = 'converting';
        const app = await request(`/app-manifests/${code}/conversions`, { method: 'POST' });
        if (!app.id || !app.pem || !/^[a-zA-Z0-9-]+$/.test(app.slug ?? '')) throw new Error('GitHub returned an incomplete App registration.');
        const secrets = { ADMIN_TOKEN: randomBytes(32).toString('hex'), GITHUB_APP_ID: String(app.id),
          GITHUB_INSTALLATION_ID: '', GITHUB_PRIVATE_KEY: createPrivateKey(app.pem).export({ type: 'pkcs8', format: 'pem' }).toString() };
        writeFileSync(file, JSON.stringify(secrets, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
        installUrl = `https://github.com/apps/${app.slug}/installations/new`;
        phase = 'install';
        onMessage('App credentials saved locally in the ignored secrets file. Complete repository selection in the browser.');
        return reply(200, `<h1>App created</h1><p>The private key is saved on this computer.</p>
          <p><a href="${installUrl}" target="_blank" rel="noreferrer">Install the App on GitHub</a>. Choose <strong>Only select repositories → speech-to-text-meals</strong>.</p>
          <p>After installation, return here and <a href="${origin}/finish?state=${state}">check the installation</a>.</p>`);
      }
      if (url.pathname === '/finish' && phase === 'install') {
        await finishInstallation(file, request);
        phase = 'done';
        reply(200, '<h1>GitHub App setup complete</h1><p>Credentials and installation ID are saved locally. You can close this page.</p>');
        onMessage('GitHub App setup complete. Credentials are ready for Cloudflare; nothing has been deployed.');
        clearTimeout(timer); server.close();
        return;
      }
      return reply(409, 'This step is already in progress or complete. Use the latest setup page, or run the CLI with --finish.');
    } catch (error) {
      // A conversion failure may have consumed the one-use code; don't start a
      // second App silently or expose credential-bearing API response content.
      reply(502, `<h1>Setup needs attention</h1><p>${escape(error instanceof Error ? error.message : 'Try again.')}</p>
        ${phase === 'install' ? `<p>Correct the repository selection, then <a href="${origin}/finish?state=${state}">retry</a>.</p>` : '<p>If the App was created, recover its key from GitHub settings before restarting setup.</p>'}`);
      onMessage('Setup needs attention. See the local browser page; no secret values have been printed.');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  timer = setTimeout(() => { server.close(); server.closeAllConnections(); onMessage('Setup listener closed after 15 minutes. Use --finish if credentials were already saved.'); }, 15 * 60000);
  server.on('close', () => clearTimeout(timer));
  const url = `${origin}/?state=${state}`;
  onMessage(`Open this local setup page: ${url}`);
  return { server, url };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.includes('--finish')) {
      await finishInstallation();
      console.log('GitHub App installation verified. Local secrets are ready for Cloudflare.');
    } else await startSetup();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Setup failed.');
    process.exitCode = 1;
  }
}
