# ADR 0048: Remember meal editing access on a personal device

Date: 2026-10-19
Status: Accepted; supersedes the token-persistence rule in ADR 0047

## Context

The user explicitly requests one-time setup on a 92-year-old family member's
phone and tablets. Requiring a token each session makes editing impractical.
This authorization replaces the original memory-only requirement; public plans,
conditional writes, personal credentials and static hosting remain unchanged.

## Decision

Offer an unchecked **Remember on this device** option when connecting GitHub.
Only after repository access verification succeeds, store the token in
localStorage under `speech-to-text-meal-editor:<app-path>`. Restore it into
application memory on reopening. All reads/writes still authenticate to the
fixed GitHub API; the token is never sent to public raw-file reads or URLs.
GitHub remains responsible for enforcing current validity and write permissions.

Without the option, keep access only for the page session. Disconnect clears
memory and removes exactly that app's saved token. Listen, Clear, meal deletion,
preference changes and static-shell upgrades do not remove remembered access.
Storage events synchronize saved access across open tabs, including disconnect;
no effect writes tokens back from a stale tab.

If storage is blocked or full, connect for the current session and display that
remembering failed. If removal fails, stop using the token in the current page
and explicitly explain that saved access could remain; clear site data or revoke
the saved token to prevent reuse. Never claim a failed removal succeeded.
Expired/revoked tokens produce an actionable reconnect error; offline failures
do not delete saved access or discard meal drafts.

## Consequences

- Setup is once per browser/profile or installed-app storage context, on each
  device. Expiry, revocation, cleared storage and private browsing can require
  setup again. This is not an indefinite sign-in guarantee.
- Anyone using that browser can edit. The token is stored as text and readable
  by scripts running on the same origin, including other projects under that
  GitHub Pages hostname. The app-path key prevents accidental mixing/cleanup;
  it is not a security boundary. No misleading client-side encryption is added.
- Use a personal, repository-restricted token where supported. Existing GitHub
  collaborator limitations still apply. Do not embed credentials in app code,
  logs, screenshots, test fixtures with real tokens or the public plan.
- No new dependency, backend, microphone behavior or transcript persistence.

## Validation

Unit tests cover opt-in persistence, restoration, scoped deletion, session-only
replacement and blocked storage. Chromium/WebKit browser cases cover reopening,
editing after reload, cross-tab disconnect, preservation of preferences/sibling
keys, rejected/expired credentials and storage denial. Executed results and
remaining physical-device acceptance are recorded in `docs/feasibility.md`.

References: [localStorage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage),
[GitHub token permissions and expiry](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
