# ADR 0071: Free hosted family editing
Date: 2026-11-24
Status: Accepted (Worker and D1 deployed and verified; frontend release pending)

## Context
The user approved replacing routine GitHub token entry for grandparents with a
hosted connection, on the condition that hosting must cost nothing. Existing
local journals and per-field conflict resolution must continue to work.

## Decision
Keep the static Pages app and GitHub data repository. Add a Cloudflare Worker
and D1 on the Free plan. A GitHub App installed on the data repository issues
short-lived installation tokens on the server. Devices pair once using a
single-use, 15-minute invitation and retain a revocable random device credential.
Store only credential hashes, device labels, invitations and guard counters in D1;
no captions, audio or meal/shopping data. The owner manages devices using a local
command, authenticated with a separate server secret. No owner secret enters the
static app. A full owner web dashboard is outside this increment.

Only allowlisted meal/shopping paths can be read/written. Validate documents and
forward conditional GitHub SHA writes; ADR 0066 still owns merge/conflict behaviour.
An optional public service URL enables pairing. Keep legacy access available for
existing installations until paired; replacing access never clears local edits.

Use provider-enforced Free quotas as the zero-cost boundary. Application daily
request limits and a persistent pause switch are supplementary safeguards, not a
billing cap. Do not upgrade plans. Return retry guidance on pauses; retain edits
and avoid repeatedly calling a paused service. Installation credential failures
require owner maintenance, not new pairing from grandparents.

Wrangler is a development-only dependency for local Workers/D1 and deployment.
Use native WebCrypto, fetch and SQL at runtime. Node SQLite exercises the actual
SQL in unit tests; a local Wrangler smoke test checks the Workers binding.

## Consequences
The owner must create a free Cloudflare account and configure a GitHub App.
Cloudflare/GitHub outages and account-level suspensions remain possible. Free
quotas are shared by the account; check usage and plan before deployment.
Devices hold bearer credentials in browser storage: revoke a lost device, and
keep same-origin scripts trusted. Pairing grants family editing, not GitHub admin.
GitHub commits identify the App; device labels are administrative, not attribution.

## Validation
Service tests cover pairing/replay/revocation, origin/path/schema restrictions,
concurrent quota admission, pause recovery, App token renewal and SHA conflicts.
Transport and sync tests cover retained edits and conservative retries; browser
tests cover pairing and remembered access. See `docs/hosted-editing.md` for setup
and explicit live-validation steps.

Live validation on 2026-11-24 verified device pairing/revocation, origin checks,
meal and shopping reads, unchanged-value conditional saves, rejection of stale
revisions, and owner pause/resume. All temporary devices were revoked. The owner
explicitly approved uploading credentials and creating the two test commits.
Cloudflare requires `redirect: 'manual'`; reject non-OK responses so App and
installation credentials never follow a redirect. See troubleshooting.

Sources checked 2026-11-24:
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/platform/spend-management/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app
