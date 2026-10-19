# ADR 0047: Public GitHub meal plans alongside live captions

Date: 2026-10-19
Status: Accepted

Token persistence is superseded by [ADR 0048](0048-remember-meal-access.md),
following the user's request to set up elderly family members' devices once.
The original decision below records the initial session-only design.
The dated-file format is extended by [ADR 0049](0049-recurring-meal-defaults.md)
to support weekly defaults and explicit date-specific skips.

## Context

The user adds a Monday-first weekly meal planner, shared by the couple's devices
and family. They explicitly choose a public GitHub plan with GitHub-authenticated
editors over a private storage service. This extends the caption-only product
scope of ADR 0046; speaker attribution remains removed.

GitHub Pages cannot accept data writes. Putting an application-wide write token
in a static bundle would give every visitor that permission. A normal OAuth sign-in
would require additional application registration and a secure token-exchange
service. No such service or subscription is introduced here.

## Decision

Use a separate public `H-Wilderspin/speech-to-text-meals` repository. One versioned
JSON file per Monday (`weeks/YYYY-MM-DD.json`) holds dated breakfast/lunch/dinner
entries. Meals are plain text, limited to 300 characters. Read through GitHub's
public raw-file endpoint; refresh while the modal is visible every minute, on
window focus and on demand. CDN propagation can delay other readers. Connected
editors read through the authenticated Contents API. No meal data is precached
or silently queued offline; a successful save means GitHub accepted the commit.

The app owner can connect a fine-grained personal access token restricted to this
data repository, Contents read/write. Credentials remain in React memory, survive
modal close and disappear on reload. They are never included in code, URLs,
local/session storage, logs, or raw-file requests. Only fixed `api.github.com`
requests receive authentication, and redirects are rejected. Disconnect removes
the in-memory credential. Repository access is checked before enabling editing;
the actual write additionally enforces token permissions.

GitHub currently restricts fine-grained tokens for repository collaborators.
Other editors can use GitHub's signed-in web editor, or knowingly supply their own
classic token with `public_repo` scope (broader than one repository). We do not
create, share or embed a common editor token. An OAuth-backed GitHub App is a
future option if token setup proves unsuitable. Family collaborator invitations
require their usernames and are not sent automatically.

Before each save, read current JSON and SHA. Merge only the selected slot into
the latest document; block if its previous value differs. Retry a bounded number
of conditional-write conflicts, rechecking that slot each time. Preserve the
draft on failure; publish no optimistic success. Retried identical saves are
idempotent. Deletion removes the selected entry, not the weekly file/history.

## Consequences

- Family readers need no account and the UI remains hosted on Pages.
- Meals and Git commit history/author information are public by explicit choice.
  Removing a meal does not remove it from Git history.
- Data commits do not deploy/rebuild the caption app.
- No extra runtime dependency, backend, microphone capture or transcript storage.
- One-time editor setup is more technical than a standard sign-in; credentials
  must be reconnected after a page reload. The elderly couple can simply read.
- The footer keeps Listen/Stop and uses labelled icons for Clear, Meals and
  Settings. The scrollable modal highlights today, navigates weeks, and adapts
  the seven day rows / three meal columns to narrow screens. Opening it does not
  stop listening; caption Clear never removes meals.

## References and validation

- [Pages is static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Contents API](https://docs.github.com/en/rest/repos/contents)
- [Token permissions and collaborator limitations](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

Unit coverage: calendar boundaries, Unicode, missing/malformed weeks, access and
network failures, conditional merges, same-slot conflicts, deletion, idempotency
and bounded retries. Browser coverage: week navigation/today, responsive layout,
CRUD and shared reads, errors, session-only credentials, project paths and ongoing
captions. Live repository and publication checks are recorded in feasibility.
