import { createPrivateKey, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [pemPath, appId, installationId] = process.argv.slice(2);
if (!pemPath || !appId || !/^\d+$/.test(installationId ?? '')) {
  throw new Error('Usage: node service/prepare-key.mjs PATH_TO_GITHUB_PEM APP_ID INSTALLATION_ID');
}
const pem = createPrivateKey(readFileSync(pemPath)).export({ type: 'pkcs8', format: 'pem' }).toString();
const target = new URL('./secrets.local.json', import.meta.url);
// Exclusive creation prevents accidentally replacing the owner secret of an existing service.
writeFileSync(target, JSON.stringify({ ADMIN_TOKEN: randomBytes(32).toString('hex'), GITHUB_APP_ID: appId,
  GITHUB_INSTALLATION_ID: installationId, GITHUB_PRIVATE_KEY: pem }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log('Prepared service/secrets.local.json (ignored by Git). Keep it private; upload directly to Cloudflare when ready.');
