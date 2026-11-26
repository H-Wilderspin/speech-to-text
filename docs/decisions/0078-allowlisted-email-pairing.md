# 0078: Allowlisted email pairing

Status: Accepted. Live setup and verification are recorded in
[current evidence](../feasibility.md#family-service).

## Context

The owner wants a small set of family email addresses to request their own
pairing codes in the app. The service already supports six-digit invitations,
single-device claims, remembered device access and persistent guessing limits.
The owner has no known sending domain and the project requires free hosting.

## Decision

Add an optional email request form under Family connection. The Worker advertises
availability and approved addresses through `/pair/options` and accepts requests
through `/pair/email`. The owner requested an address dropdown so family members
cannot mistype an address or select an unapproved recipient. Require an explicit
selection and retain the server-side allowlist check for every request.
Use Brevo's transactional REST API with a verified existing mailbox. No custom
domain, additional frontend service, SDK or package dependency is needed. Keep
the sender, API key and exact email allowlist in Worker secrets and ignored local
configuration. Never include actual family addresses in tracked files.

The dropdown deliberately makes approved addresses visible before pairing,
including to anyone inspecting the public options endpoint. Serve the list with
no-store and keep it out of browser persistence and compiled frontend assets.
Sender credentials remain private. Generic send responses conceal delivery and
rate-limit outcomes, not the separately published address list.

Reuse the existing invitation store and claim flow. Emailed and manual codes
both expire after 24 hours, giving family members time to find and enter them.
Both share the five-unused-invitation cap, 100-device/invitation capacity and existing global
guess limits. Requests neither reset guess budgets nor disconnect existing
devices. A resend replaces only that recipient's unused email invitation.

Normalize email case and surrounding whitespace, without folding aliases. Store
only a recipient hash keyed with the owner secret, not the address. Check the
current allowlist again before accepting an emailed invitation. Removing an
address blocks unclaimed codes; revoke connected devices separately. Owner-key
rotation also invalidates outstanding emailed codes.

Reserve send attempts atomically in D1: one per recipient per minute, five per
recipient per UTC day, and twenty across the service per UTC day. Fail closed
when configuration or D1 is unavailable. Unknown recipients, cooldowns, capacity
and delivery failures receive the same generic response. Do not claim confirmed
delivery or expose provider errors. Log only a fixed delivery-failure diagnostic.
These controls limit abuse, not provider billing; retain free plans without
automatic upgrades. Provider delivery timing can still differ by outcome.

Use HTTPS only, a fixed provider URL, a bounded timeout and manual redirect
handling so credentials cannot be forwarded to another host. Do not retry sends
automatically. Delete a new unused invitation if sending fails; a timed-out send
may still deliver an unusable code, requiring a fresh request after cooldown.

## Consequences

The owner must set up a free email account, verify its sender and supply an API
key. Family members need no provider accounts. Brevo processes recipient addresses
and code email content; its provider logs/retention are separate from this app.
A free-mailbox sender may appear under a Brevo sending domain. Inbox delivery,
spam handling and account activation need live verification.

The frontend hides email requests until the service is configured. Email-specific
failures do not block manual pairing or planner syncing. Existing devices remain
connected, with no account-login screen added. Generic responses deliberately
direct people to check spam or ask the administrator when mail does not arrive.

Migration 0003 must precede Worker deployment. It adds an email hash to invitations
and persistent send counters. Unit tests exercise real SQL and mocked delivery;
browser tests cover requesting, fallback and remembered access at phone widths.
See [service operations](../hosted-editing.md#email-codes-in-the-app) for setup.
