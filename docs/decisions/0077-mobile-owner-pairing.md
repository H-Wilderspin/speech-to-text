# 0077: Mobile owner pairing page

Status: Accepted

## Context

The owner needs to issue pairing codes from a phone while away from a computer.
The Worker already authenticates owner commands and creates single-use, 24-hour
codes. Family devices must not gain the ability to issue invitations.

## Decision

Serve a small responsive page at the existing Worker's `/admin` path. Exchange
the existing owner bearer key for a signed, 12-hour cookie after an explicit
same-origin sign-in. Keep the key in the password field only until the request
completes; never embed it in assets, URLs or browser storage. Password-manager
storage remains an explicit owner choice. No additional hosting or identity
provider is introduced.

Use HMAC-SHA-256 with the existing owner key, a purpose label, service origin,
expiry and random nonce. The cookie is Secure, HttpOnly, SameSite Strict and
restricted to `/admin`. It authorizes session checks and invitation creation
only. Mutations using browser sessions require the exact service Origin;
existing CLI bearer authentication remains available. Do not enable credentialed
CORS. Apply no-store, a nonce-based CSP, no-referrer and frame restrictions to
the page. Display labels and results as text, never HTML.

Reuse the existing invitation handler, labels, admission limits and database.
Do not retry a failed creation automatically: a lost response can still consume
an unused-code slot. Keep returned codes only in page memory, with copy/share
controls and a local-time expiry. Revalidate sign-in on history restoration.

## Consequences

No schema migration, new secret, account, paid service or frontend deployment is
needed. The owner must transfer the existing key to their own password manager
before travelling. Family members continue receiving only a six-digit code.

Stateless sessions avoid extra D1 writes. Sign-out clears this browser's cookie
but cannot revoke a separately copied cookie; rotating the owner key revokes all
sessions immediately, and each session expires within 12 hours. The session
cannot pause syncing, enumerate or revoke devices, or edit planner documents.

Unit tests cover scope, tampering, expiry, key rotation and cross-origin rejection.
Phone-sized Chromium/WebKit tests exercise the Worker and isolated SQL through
simulated HTTPS. Physical password-manager, clipboard and native share behaviour
still need an owner phone check. Operations live in [the service guide](../hosted-editing.md).
