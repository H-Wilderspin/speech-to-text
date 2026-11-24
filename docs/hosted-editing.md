# Hosted family editing — owner setup

Worker, D1 and the pairing-enabled frontend deployed and verified on 2026-11-24.
This replaces routine GitHub token entry
with a one-time pairing code. The static captions app remains on GitHub Pages;
the Worker only handles family editing. No captions or audio go to this service.

Current Worker origin:
`https://speech-to-text-family-sync.wilderspin-family-sync-b71e6c4a.workers.dev`.
The GitHub App installation is verified with access only to
`H-Wilderspin/speech-to-text-meals`. Its credentials were uploaded to Cloudflare
secret storage with explicit owner approval. Remote migration `0001_devices.sql`
is applied. The ignored `service/.admin.local` contains local owner configuration.
The public Pages Actions variable `VITE_SYNC_SERVICE_URL` is configured and
verified. Frontend release `7e52555` passed the
[Pages workflow](https://github.com/H-Wilderspin/speech-to-text/actions/runs/45444887729)
and is published at https://h-wilderspin.github.io/speech-to-text/.
`SYNC_PAUSED=false`; the 5,000-request daily guard and owner pause switch are active.
Pairing, live reads/saves, stale-revision rejection, pause/resume and revocation
passed. All temporary test devices were revoked. Two owner-approved saves kept
the JSON values unchanged and verified App-authored commits:
[meal defaults](https://github.com/H-Wilderspin/speech-to-text-meals/commit/a02d787b288ec9645f0a8c6951207b450f297f57),
[shopping list](https://github.com/H-Wilderspin/speech-to-text-meals/commit/13752b81259861f70e376f670012dd3853100248).
A configured frontend build also paired with the real service in desktop
Chromium, retained access across reload and read shopping data through CORS.
The browser used local build assets intercepted at the production project URL;
this verifies the prepared build, not a published Pages release. Its test device
was revoked. App and owner secrets were absent from the built static assets.

After publication, the actual served app passed pairing, remembered access after
reload, and authenticated shopping/meal reads in desktop Chromium and mobile
WebKit on Windows. Both verification devices were revoked; no family data changed.
The latest release also verified the clearer pairing and Update app instructions
on the actual published Settings screen. The served script is
`assets/index-BV0LUksE.js` and the service-worker version is
`ab16c62eca800501`. Physical family devices have not been tested. Existing users
should stop listening and choose **Settings → Update app**, then enter their
individual pairing code under **Family connection**.

## 1. Create the free account

Create an account at https://dash.cloudflare.com/sign-up. Use **Workers Free**;
do not enable Workers Paid, metered add-ons, or an automatic paid upgrade. A
domain purchase is unnecessary: the Worker can use its free `workers.dev` URL.

The £0 boundary is the account's Free plan, not an application spending estimate.
Free limits checked on 2026-11-24 are 100,000 Worker requests/day (10 ms CPU per
request), and D1 5 million rows read/day, 100,000 rows written/day, 5 GB total.
These are shared account allowances. Recheck the dashboard and current terms
before deployment. When a Free quota is exhausted, syncing can fail until reset;
the app retains completed edits locally. The app does not upgrade the account.

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1 pricing and daily resets](https://developers.cloudflare.com/d1/platform/pricing/)
- [Why paid spending limits are not a £0 guarantee](https://developers.cloudflare.com/workers/platform/spend-management/)

The service additionally admits at most **5,000 non-admin requests/day** (UTC),
using an atomic SQL counter, and provides an owner pause switch. Rejected requests
still invoke the Worker and may read D1, so this counter is **not** a billing cap.
Other services on the account also consume quotas. Do not move this deployment to
a paid account without a new explicit cost decision.

## 2. Create the GitHub App

The easiest route is now the local CLI helper:

```sh
npm run service:setup
```

Open its local URL, click **Create on GitHub**, approve the private App, and
follow **Install the App on GitHub**. Choose **Only select repositories →
speech-to-text-meals**. Return to the local page and click **check the installation**.
The helper prefills Contents read/write with webhooks disabled, captures the
generated private key directly into ignored `service/secrets.local.json`, and
verifies that the installation includes exactly the data repository. No `gh`
installation, personal token, manual key download or copying of IDs is needed.
GitHub still requires the owner's browser approval and repository selection.

The listener binds only to `127.0.0.1`, validates an unguessable state value and
closes after completion or 15 minutes. Existing credentials are never replaced
by a new registration. If the listener closed after credentials were saved,
complete installation in GitHub, then run `npm run service:setup -- --finish`.
If manifest conversion failed before saving, recover a private key from the
created App's GitHub settings using the manual route below; do not create
duplicate Apps. Nothing is deployed by this helper.

[GitHub's supported manifest flow](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)

### Manual alternative

In the data repository owner's GitHub settings, create a private GitHub App:

- Homepage: `https://h-wilderspin.github.io/speech-to-text/`.
- Disable webhooks; this service polls and needs no webhook or OAuth callback.
- Repository permission: **Contents: Read and write**. Metadata read is automatic.
- Install only on **H-Wilderspin/speech-to-text-meals**, not all repositories.
- Note the App ID (or client ID) and installation ID (from the installation's
  GitHub settings URL). In the App settings sidebar, open **Credentials → Key
  pairs → New key** to download the private PEM key. The current GitHub.com UI
  places this outside the main About/Basic information page; some older
  quickstarts still describe a "Private keys" section on that page.

The Worker signs App JWTs and renews installation tokens before their one-hour
expiry, with one renewal after a GitHub 401. A revoked App key, removed
installation, repository rule or GitHub outage needs owner attention; it does not
invalidate a grandparent's device connection. Never grant bypass of repository
protections just to make a test pass. Check any rules requiring PRs before launch.

[GitHub App installation authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)

Keep the downloaded PEM outside source control. From the repository root:

```sh
node service/prepare-key.mjs PATH_TO_DOWNLOADED_PEM APP_ID INSTALLATION_ID
```

This converts GitHub's key to PKCS8 and creates ignored
`service/secrets.local.json`, containing the key, IDs and a random owner secret.
It refuses to overwrite an existing file. Store these securely, never paste them
in chat, and never put them in `VITE_` variables or GitHub Pages assets.

## 3. Review, then deploy the service

These commands change Cloudflare resources; run only when ready to deploy.
All testing commands in the next section are local instead.

1. Run `npx wrangler login --scopes account:read user:read workers_scripts:write d1:write`
   (no billing permissions) and `npx wrangler whoami`; verify the intended account
   is **Workers Free** in the dashboard. Wrangler config cannot enforce the
   account's billing plan. Use a dedicated free account if another project needs
   paid Workers. `whoami` may warn that other default scopes are missing; that is
   expected with this deliberately limited login. Do not add billing, AI or other
   unrelated permissions just to remove that warning.
2. Run `npx wrangler d1 create speech-to-text-family-sync`. Put its database ID in
   `service/wrangler.jsonc`, replacing the all-zero local placeholder. Keep
   `SYNC_PAUSED` set to `"true"` initially.
3. Apply the schema:
   `npx wrangler d1 migrations apply DB --remote --config service/wrangler.jsonc`.
4. Deploy paused:
   `npx wrangler deploy --config service/wrangler.jsonc`.
5. Upload secrets directly:
   `npx wrangler secret bulk service/secrets.local.json --config service/wrangler.jsonc`.
   **This publishes a Worker version**, not just a local file change.
6. Check the origin (`https://h-wilderspin.github.io`, without a path), database
   binding and Free plan. Set `SYNC_PAUSED` to `"false"` in the config and deploy
   again. A missing or different value fails closed. This config switch overrides
   the database pause/resume switch.
7. Use the owner command below to pair one test device. Confirm reads, a harmless
   edit and its GitHub commit, a second-device conflict, offline recovery, pause
   and resume. Observe Worker CPU/D1 usage in Cloudflare. Local tests cannot prove
   the deployed App permissions or Free-plan CPU headroom.
8. Set the static app repository's **Actions variable** `VITE_SYNC_SERVICE_URL`
   to the HTTPS Worker origin (no trailing slash). It is public configuration.
   The Pages workflow tests both connection modes and builds this URL into the
   published app. Deploy the app through the normal reviewed Pages process and
   verify the served release. No Worker deploy is performed by Pages CI.

If the service is unavailable at launch, leave the app variable unset; the old
connection remains available. After a device is paired, do not remove that URL
to troubleshoot: paired credentials must never be sent to GitHub directly.
Pause/fix the Worker instead. Existing personal tokens continue until a successful
pair replaces them; queued edits are retained. Revoke old personal tokens in
GitHub only after confirming the new service works on the family devices.

## Owner commands

Create `service/.admin.local` (ignored by Git) on your own computer:

```dotenv
FAMILY_SERVICE_URL=https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev
FAMILY_ADMIN_TOKEN=OWNER_SECRET_FROM_SECRETS_LOCAL_JSON
```

Do not share this file. Commands run locally; there is no owner web dashboard:

```sh
node --env-file=service/.admin.local service/admin.mjs status
node --env-file=service/.admin.local service/admin.mjs invite "Granddad tablet"
node --env-file=service/.admin.local service/admin.mjs devices
node --env-file=service/.admin.local service/admin.mjs revoke DEVICE_ID
node --env-file=service/.admin.local service/admin.mjs pause
node --env-file=service/.admin.local service/admin.mjs resume
```

`invite` prints a single-use code valid for 15 minutes. Enter it on that device in
**Settings → Family connection → Connect this device**. The app remembers access
automatically. Codes are grouped for copying or dictation; generating and entering
them yourself once is easiest for grandparents. A lost pairing response can retry
with the same secret while that form remains open and the invitation is valid.
If the form/browser was closed before success, generate a fresh invitation.

Device credentials have no routine expiry; revoke a lost/shared device using its
ID. Revocation takes effect on its next request. D1 stores credential hashes and
device labels, not credentials in plaintext. Restoring an old D1 backup could
restore a revoked device: review/revoke devices again after a database restore.
Clearing browser data removes pairing and unsynced local edits. Keep same-origin
scripts trusted, since browser storage contains the device bearer credential.

Rotate a compromised GitHub App key in GitHub and replace the Worker secret;
family devices do not need re-pairing. If the owner secret leaks, replace
`ADMIN_TOKEN`, review devices and revoke unexpected ones. Disable syncing if needed.
App tokens stay in Worker memory and are never returned to clients. The service
does not log request bodies/headers, and Worker observability is disabled in config.

## Pause behaviour

Manual pause, the daily cap, database failures and provider outages return an
unavailable response. The app keeps local edits and distinguishes them from shared
saves. It honours `Retry-After` across all planner documents (up to the next UTC
reset); unknown provider errors retry after 15 minutes. Opening Settings does not
ask for a new code for these failures. Normal polls use that same backoff without
network calls. A full page reopen can make one new attempt; captions stay usable.

Resuming the owner pause does not reset the daily counter or override
`SYNC_PAUSED=true`. After manual resume, an already open device may take up to its
retry interval to reconnect (normally one hour for manual pauses). Reopening the
app after recovery retries sooner. Never clear browser data to fix a sync pause.

## Local development and checks

```sh
npm ci
npm run check
npm run service:build
npm run service:migrate:local
```

Copy `service/.dev.vars.example` to `service/.dev.vars`, set local values, and run
`npm run service:dev`. Use a disposable GitHub App/test installation when testing
real commits: local Wrangler has local D1 but real outbound GitHub calls. All
automated service tests mock GitHub and perform no external writes.

For the app's local connection, set the public `VITE_SYNC_SERVICE_URL` in an
ignored `.env.development.local`, then restart `npm run dev`. Use the hosted
Worker origin to connect to the live family data, or `http://localhost:8787` for
a local Worker. Vite proxies only `/session`, `/pair` and `/files` through the
local `/family-sync` path, with the production app origin header; keep the local
Worker's `APP_ORIGIN` at `https://h-wilderspin.github.io` for this route.
Owner endpoints are not proxied and no owner/App secrets are loaded by Vite.
TLS verification stays enabled using Node's system certificate store.

This configuration is development-only: tests keep their own fixtures and
production builds still use the Actions variable. Without local configuration,
Settings shows legacy token access even when the published app has pairing.
Use separate pairing codes for local development and family devices. Local
development connected to the hosted Worker edits the real family data.

Settings explains the three connection steps: ask the family member who manages
the app for a code, enter it, then tap Connect this device. Codes last 15 minutes
and connect one device; successful access is remembered. Update app explains how
to refresh an older installed version while retaining settings and connection.

```sh
npm run test:family
npm run test:e2e -- --workers=1 --max-failures=1
```

The paired browser suite builds an isolated production app under `.wrangler/`
and mocks the service at root and project paths. The default browser suite tests
legacy access and existing workflows. Unit service tests execute the migration
and SQL against Node SQLite, verify real JWT signatures and mock GitHub responses.
The local Wrangler smoke check exercises actual Worker/D1 binding behaviour.
No test here measures physical iPad speech or guarantees hosted availability.

Validation on 2026-11-24: TypeScript, lint, 162 unit tests, two setup-helper tests and the production build
passed. Eight paired browser tests passed in Windows Chromium/WebKit, including
project paths, replacement codes and paused edits surviving reload. Existing
full-app regressions passed 190 tests; four Chromium-only native-touch tests
were skipped in WebKit. The actual local Worker/D1 runtime
passed pairing, authentication, pause/resume and revocation, and the Worker dry
bundle passed. These tests mocked GitHub. Subsequent setup verified the real App
and installation, applied the remote D1 migration and deployed the paused Worker
with secrets, then enabled syncing and completed the live checks recorded above.
The initial HTTPS handshake failure resolved after a short wait without changing
TLS settings. Live GitHub checks also exposed and verified the fix for Workers'
unsupported redirect mode; see troubleshooting. Physical family devices and a
two-device simultaneous editing scenario have not yet been tested against the
hosted service; automated browser tests cover local queue/conflict recovery.
`npm audit --omit=dev` reported no production dependency advisories. The full
development-tool audit still reports lint/test-tool advisories; resolving those
upgrades is separate from this service implementation.

On a managed Windows computer, Wrangler may report
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY` during login. Use Node's `--use-system-ca`
option for the command (preserving existing `NODE_OPTIONS`) to trust the Windows
certificate store. Do not disable HTTPS verification. See troubleshooting.
