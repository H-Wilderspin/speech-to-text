# Family service operations

The published app pairs devices through a Cloudflare Worker/D1 and edits GitHub
data through a GitHub App. The frontend stays on GitHub Pages. No audio/captions
go to the Worker; D1 stores access metadata, not meals.

- Worker: `https://speech-to-text-family-sync.wilderspin-family-sync-b71e6c4a.workers.dev`.
- Data repository: `H-Wilderspin/speech-to-text-meals`.
- Configuration: `service/wrangler.jsonc`; public frontend variable: `VITE_SYNC_SERVICE_URL`.
- [Current verification](feasibility.md) / [rollout evidence](archive/hosted-editing-history.md).

## Pairing and owner commands

### Email codes in the app

Connected devices show **This device is connected**, including devices still using
a valid older GitHub connection. Refreshing, reopening or updating the app does
not require another code. Code requests stay hidden unless access is missing or
the saved connection is rejected; a temporary network failure does not require
pairing again.

After email setup and deployment, unconnected devices show an **Email address** dropdown
containing only the approved addresses, followed by **Email me a code**. Choose
your address; there is no free-text email field. Only approved addresses receive a six-digit code. Enter it
in the existing **Pairing code** field to connect the device. Emailed and manually
issued codes both expire after **24 hours**. Both are single
use, and connected devices retain access without routine expiry.

The app uses Brevo's transactional-email API so the owner does not need to buy a
domain. Brevo can verify an individual sender mailbox and may replace a free
mailbox's sender domain with its own `brevosend.com` domain. Recipients do not
need Brevo accounts. Delivery to the actual family inboxes still needs checking;
provider acceptance does not prove inbox delivery.

The allowlist is configured on the server and returned to the app for the dropdown;
anyone who can open the unpaired app can see those approved addresses. They are
not embedded in frontend assets or tracked files. The sender address and API key
remain private server secrets. Email addresses are not saved by the app in browser storage or D1.
D1 stores keyed recipient hashes for limits and access checks; Brevo necessarily
receives the recipient address and email content. Devices created through this
flow have the label **Family device (email)** in the owner device list.

Requests use the same response for unknown addresses, resend limits and delivery
failure; the dropdown separately lists the approved addresses. The server still
checks every requested recipient, even if the browser is modified. Check spam or ask the
administrator if no email arrives. Resends replace that address's previous unused
code; use only the newest message. Sending is limited to once per minute and five
attempts per recipient per UTC day, plus twenty attempts across the service per
UTC day. Failed sends count too. The existing five-unused-code cap and pairing
guess limits apply to manual and emailed codes together. No request retries
automatically. Removing an address blocks its outstanding emailed codes and
future requests; separately revoke its already connected devices if required.

#### Enable email delivery

1. Create a **Free** [Brevo account](https://www.brevo.com/). Do not enable paid
   add-ons, upgrades or purchased credits. The Free plan currently includes 300
   emails/day; account limits are separate from this app's smaller guard.
2. In **Settings > Senders, Domains, IPs > Senders**, add **Speech to Text** with
   an email address you own. Complete the mailbox verification and any required
   account/transactional-sending activation. A custom domain is optional for this
   route; free-mailbox sender addresses may be rewritten by Brevo.
3. Create a Brevo **API key** (not an SMTP password). Fill in the ignored
   `service/secrets.email.local.json`: `PAIRING_EMAIL_FROM` is the verified sender;
   `BREVO_API_KEY` is the key; `PAIRING_EMAIL_ALLOWLIST` is a JSON-array **string**
   containing up to twenty exact addresses. Keep this file private and never
   paste the key into chat, frontend configuration or tracked files. Matching
   trims whitespace and ignores case; aliases are not merged automatically.
4. Run the checks below and apply migration `0003_email_pairing.sql` remotely
   using the normal deployment procedure **before deploying this Worker**.
   Deploy the Worker, then upload only the new secrets with
   `npx wrangler secret bulk service/secrets.email.local.json --config service/wrangler.jsonc`.
   This preserves the existing App/owner secrets. It also publishes a Worker
   version. Do not upload the file while its sender/key fields are empty.
5. Publish the frontend through the normal Pages process. Test a request from an
   approved address, receipt, pairing, and remembered access on the actual phone.
   Verify an unapproved address cannot trigger mail. Do not repeatedly request
   codes to test delivery; requests consume the small daily allowance.

If email setup is absent, malformed or the service has not yet been updated, the
app hides the email form and keeps manual pairing available. Removing the Brevo
key disables new email requests and invalidates outstanding emailed codes; it
does not disconnect devices or invalidate manual codes.

Provider references (checked 26 November 2026):
[Free plan](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans),
[sender verification](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email),
[free-mailbox sender handling](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication).
Recheck terms and both providers' Free plans before deployment. See
[ADR 0078](decisions/0078-allowlisted-email-pairing.md) for the security decisions.

### From your phone

After deploying the updated Worker, open [the owner pairing page](https://speech-to-text-family-sync.wilderspin-family-sync-b71e6c4a.workers.dev/admin)
and bookmark it before travelling. Sign in using the existing FAMILY_ADMIN_TOKEN
value from ignored `service/.admin.local` as your **Owner key**. Transfer it to
your own password manager, associated with this service URL; never send it to
family members. They only need the six-digit pairing code.

Enter a device name, tap **Create pairing code**, then **Copy code** or
**Share instructions** (where the phone supports sharing). If clipboard access
is denied, touch and hold the displayed code to copy it. Expiry is shown in the
phone's local time. Copy or share before leaving: the page does not save codes,
and the service stores only their hashes. A network failure may leave an unused
code on the service; requests are not retried automatically.

Sign-in lasts 12 hours and survives a reload. **Sign out** clears this browser's
cookie and displayed code. The cookie is HTTPS-only, HttpOnly and SameSite Strict;
it permits invitation creation only. Other owner actions still require the CLI.
The page clears the owner-key input after sign-in and does not save it in browser
storage. A password manager may save it at your request. Rotating ADMIN_TOKEN
invalidates all browser sessions. As sessions are signed rather than stored,
sign-out does not revoke a separately copied cookie; it expires within 12 hours.
See [ADR 0077](decisions/0077-mobile-owner-pairing.md).

Before leaving, test sign-in and copying on your actual phone. Browser automation
covers simulated phone layouts, not password-manager integration or native sharing.

### From your computer

Use ignored `service/.admin.local`, containing FAMILY_SERVICE_URL and
FAMILY_ADMIN_TOKEN. Keep it private. From the repository root:

```sh
node --use-system-ca --env-file=service/.admin.local service/admin.mjs status
node --use-system-ca --env-file=service/.admin.local service/admin.mjs invite "Granddad tablet"
node --use-system-ca --env-file=service/.admin.local service/admin.mjs devices
node --use-system-ca --env-file=service/.admin.local service/admin.mjs revoke DEVICE_ID
node --use-system-ca --env-file=service/.admin.local service/admin.mjs pause
node --use-system-ca --env-file=service/.admin.local service/admin.mjs resume
```

New codes contain six digits, connect one device and expire 24 hours after creation. Enter one in
**Settings ? Family connection ? Connect this device**. Access is remembered
without routine expiry; grandparents do not need GitHub accounts.
If the form closes before pairing succeeds, generate a fresh code.

Keep leading zeros. Up to five unused codes can exist at once. Pairing allows
five submissions per 15-minute window and twenty per 24-hour window across the
service, including successful attempts. If limited, wait as instructed; generating
another code does not reset the limit. Connected devices keep syncing. Old long
codes remain valid until their original expiry. See [ADR 0074](decisions/0074-six-digit-pairing-codes.md).

Revocation applies on the device's next request. Clearing browser data removes
pairing and unsynced edits. D1 stores credential hashes, not plaintext credentials.
After restoring a D1 backup, review revocations again: old backups may restore access.

## Free-plan and pause behaviour

Keep **Workers Free**, without paid add-ons or automatic upgrades. The account
plan/provider quotas are the cost boundary. Before service deployment, recheck
the dashboard and current [Workers](https://developers.cloudflare.com/workers/platform/pricing/)
and [D1](https://developers.cloudflare.com/d1/platform/pricing/) terms.
Wrangler config cannot enforce the billing plan.

The configured 5,000 non-admin requests/day guard (UTC) and owner pause are
additional controls, **not billing caps**. Rejected requests still invoke the
Worker and may use D1. Other services share account allowances. Do not move to a
paid plan without explicit approval.

Pauses/outages keep local edits and remembered access. The app honours Retry-After
across planner documents; unknown service failures retry after 15 minutes.
Manual-pause backoff is normally one hour; reopening after recovery can retry sooner.
Never clear browser data to fix a pause. Owner resume does not reset the daily
counter or override SYNC_PAUSED: only the exact config value `"false"` permits sync.

## Credentials and recovery

Installation tokens renew automatically. A revoked App key, removed installation
or repository rule needs owner repair, not device re-pairing. Do not bypass
repository protections to make saves pass.

App/owner secrets belong in Cloudflare secret storage and ignored local files,
never VITE variables, static assets, logs or chat. Device credentials must never
go to GitHub; do not remove the service URL to troubleshoot paired access.

Rotate a compromised App key and replace its Worker secret. If ADMIN_TOKEN leaks,
replace it, review devices and revoke unexpected access. Pause if needed.
Routine key rotation does not require reconnecting family devices.

## Local development and checks

```sh
npm ci
npm run check
npm run service:build
npm run service:migrate:local
npm run test:family
npm run test:owner
npm run test:e2e -- --workers=1 --max-failures=1
```

For local Worker development, copy `service/.dev.vars.example` to ignored
`service/.dev.vars`, configure it, then run `npm run service:dev`.
Local D1 is isolated, but GitHub calls are real: use disposable test data/access.
Automated service tests mock GitHub.

For the frontend, set public VITE_SYNC_SERVICE_URL in ignored
`.env.development.local` and restart Vite. Use the hosted origin or
`http://localhost:8787`. Vite proxies only device endpoints with the production
origin; keep local APP_ORIGIN at `https://h-wilderspin.github.io`.
Owner endpoints/secrets are not proxied. This file does not affect tests or builds.

The owner page is served directly by the Worker at `/admin`, not by Vite or Pages.
Browser owner sessions require HTTPS. The owner browser suite exercises the real
Worker handlers with an isolated SQLite database and simulated HTTPS transport;
it never uses the local owner key or contacts the hosted service.

Without local configuration, Settings shows legacy token access. Development
connected to the hosted service edits real family data; use a separate pairing
code. For Windows TLS failures, see [troubleshooting](troubleshooting.md#windows-certificate-or-login-failures).

## Service deployment

The existing service is configured. Do not recreate its App/database for updates.
Pages CI tests the Worker bundle but does not deploy it.

1. Verify the account is Workers Free, review config and run the checks above.
2. Authenticate using
   `npx wrangler login --scopes account:read user:read workers_scripts:write d1:write`.
   Confirm the account with `npx wrangler whoami`; billing scopes are unnecessary.
3. If schema changed, run
   `npx wrangler d1 migrations apply speech-to-text-family-sync --remote --config service/wrangler.jsonc`.
4. Deploy with `npx wrangler deploy --config service/wrangler.jsonc`.
   For credential changes, use
   `npx wrangler secret bulk service/secrets.local.json --config service/wrangler.jsonc`;
   this also publishes a Worker version.
5. Verify status, pairing/reload, reads, stale-revision rejection and pause/revocation.
   Use approved test data for writes, check the commit and offline/conflict recovery.
   Revoke temporary devices and observe CPU/D1 usage.
6. The frontend Actions variable VITE_SYNC_SERVICE_URL is the HTTPS Worker origin
   without a trailing slash. For frontend releases, follow Pages CI and verify
   the served app.

### First-time setup on another account

Run `npm run service:setup`, open its local URL and approve the private GitHub
App. Give Contents read/write, disable webhooks and install only on the data
repository. The helper saves ignored `service/secrets.local.json`; it does not
deploy. If credentials were saved first, complete installation and run
`npm run service:setup -- --finish`. Do not create duplicate Apps.

Manual alternative: use the same permissions, download a PEM from the App's
**Credentials ? Key pairs ? New key**, then run
`node service/prepare-key.mjs PATH_TO_PEM APP_ID INSTALLATION_ID`.
It creates the ignored secrets file and refuses to overwrite one.

Create D1 with `npx wrangler d1 create speech-to-text-family-sync`; replace the
config's database ID with the new account's ID and set SYNC_PAUSED to `"true"`.
Apply migrations, deploy paused and upload secrets using the commands above.
Verify origin/bindings/Free plan before setting `"false"` and redeploying.
Create the owner environment file and complete live verification.

## Legacy token builds

Builds without VITE_SYNC_SERVICE_URL retain Settings ? Planner editing. Use a
repository-restricted owner token with Contents read/write; never share it.
Tokens are remembered automatically. Replacement validates before swapping
access, retaining queued edits. Invalid tokens offer replacement directly.

Disconnect requires confirmation and removes saved access in this browser and
its other tabs, not the token in GitHub. Anyone using that browser can edit;
storage is not an encrypted password vault.

Pairing replaces legacy access without losing pending edits. Revoke old tokens
only after family devices work with the service. For collaborator limitations,
consult [GitHub token guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
