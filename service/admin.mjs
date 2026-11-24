// Owner-only local command. Secrets are read from the environment, never arguments.
// Example: node --env-file=service/.admin.local service/admin.mjs invite "Granddad tablet"
const [action, argument] = process.argv.slice(2);
const address = process.env.FAMILY_SERVICE_URL;
const secret = process.env.FAMILY_ADMIN_TOKEN;
if (!address || !secret) throw new Error('Set FAMILY_SERVICE_URL and FAMILY_ADMIN_TOKEN in an ignored local environment file.');
const url = new URL(address);
if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Use HTTPS for the hosted service.');
const commands = {
  status: ['GET', '/admin/status'],
  devices: ['GET', '/admin/devices'],
  invite: ['POST', '/admin/invites', { label: argument }],
  revoke: ['DELETE', `/admin/devices/${encodeURIComponent(argument ?? '')}`],
  pause: ['POST', '/admin/pause', { paused: true }],
  resume: ['POST', '/admin/pause', { paused: false }],
};
const command = commands[action];
if (!command) throw new Error('Choose: status, devices, invite "device label", revoke DEVICE_ID, pause, resume.');
const [method, path, body] = command;
const response = await fetch(`${address.replace(/\/+$/, '')}${path}`, {
  method, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(30000),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error ?? 'The owner request failed.');
if (action === 'invite') console.log(`Pairing code: ${result.code}\nExpires: ${new Date(result.expires).toLocaleString()}\nEnter it in the app: Settings → Family connection.`);
else console.log(JSON.stringify(result, null, 2));
