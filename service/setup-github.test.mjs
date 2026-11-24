import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startSetup, finishInstallation } from './setup-github.mjs';

const pem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
test('manifest callback checks state, saves keys privately, rejects replay and verifies only the data repository', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'family-app-setup-'));
  const file = join(dir, 'secrets.json');
  const messages = [];
  let conversions = 0;
  let allRepos = true;
  const request = async path => {
    if (path.includes('/conversions')) { conversions++; return { id: 123, slug: 'test-family', pem }; }
    if (path.endsWith('/installation')) return { id: 456, app_id: 123, repository_selection: 'selected', account: { login: 'H-Wilderspin' }, permissions: { contents: 'write' } };
    if (path.endsWith('/access_tokens')) return { token: 'test-installation-token' };
    return { total_count: allRepos ? 2 : 1, repositories: [{ full_name: 'H-Wilderspin/speech-to-text-meals' }] };
  };
  const { server, url } = await startSetup({ file, port: 0, request, onMessage: message => messages.push(message) });
  t.after(() => { server.close(); server.closeAllConnections(); rmSync(dir, { recursive: true }); });
  const initial = await fetch(url);
  const html = await initial.text();
  assert.match(html, /contents&quot;:&quot;write/);
  assert.match(html, /active&quot;:false/);
  const callback = new URL('/callback', url);
  callback.searchParams.set('code', 'test-code');
  assert.equal((await fetch(callback)).status, 403);
  assert.equal(conversions, 0);
  callback.searchParams.set('state', new URL(url).searchParams.get('state'));
  const registered = await fetch(callback);
  assert.equal(registered.status, 200);
  assert.doesNotMatch(await registered.text(), /PRIVATE KEY|ADMIN_TOKEN/);
  assert.equal((await fetch(callback)).status, 409);
  assert.equal(conversions, 1);
  const secrets = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(secrets.GITHUB_APP_ID, '123');
  assert.match(secrets.GITHUB_PRIVATE_KEY, /BEGIN PRIVATE KEY/);
  assert.equal(secrets.ADMIN_TOKEN.length, 64);
  assert.equal(secrets.GITHUB_INSTALLATION_ID, '');
  assert.ok(messages.every(message => !message.includes(secrets.ADMIN_TOKEN) && !message.includes('PRIVATE KEY')));
  await assert.rejects(finishInstallation(file, request), /Select only/);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).GITHUB_INSTALLATION_ID, '');
  allRepos = false;
  assert.equal(await finishInstallation(file, request), '456');
  const final = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(final.GITHUB_INSTALLATION_ID, '456');
  assert.equal(final.ADMIN_TOKEN, secrets.ADMIN_TOKEN);
});

test('existing credentials are never replaced by another registration', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'family-app-existing-'));
  const file = join(dir, 'secrets.json');
  try {
    writeFileSync(file, 'existing');
    await assert.rejects(startSetup({ file }), /already exist/);
    assert.equal(readFileSync(file, 'utf8'), 'existing');
  } finally { rmSync(dir, { recursive: true }); }
});
