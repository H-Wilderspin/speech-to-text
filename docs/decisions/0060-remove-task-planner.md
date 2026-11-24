# ADR 0060: Remove the task planner

Date: 2026-11-24
Status: Accepted; supersedes the task feature in [ADR 0052](0052-shared-cleaning-checklists.md) and [ADR 0058](0058-sunday-task-completion-reset.md)

## Context

The user explicitly requested removing the task planner entirely while improving
the app's usability. Live captions, meals and shopping remain in scope.

## Decision

Remove task navigation, the task icon, its mounted pane, task-specific styling,
recurrence/completion logic, GitHub adapter, Sunday resets and dedicated tests.
Remove task references from active access/disconnect copy and user documentation.
Keep the old guide and decisions clearly marked as historical.

The shared planner frame now switches only between meals and shopping. Preserve
drafts, split layout, save/close protections, focus restoration, caption controls
and the existing GitHub access namespace. Update integration tests to exercise
the remaining features, including that no task data is requested.

Do not delete or migrate existing `cleaning/` files in the separate data
repository. The updated app no longer reads or writes them. Older app versions
can still access those files until updated; this change does not revoke tokens.
Use the existing service-worker update flow to receive the removal after release.

## Consequences

One fewer toolbar action and no task-specific runtime, polling or reset writes.
Meal/shopping data and remembered credentials remain compatible. No dependencies,
backend or storage migration are added. The previous usability plan's task work
is superseded by this removal.

## Validation

`npm run check` passed typecheck, lint, all 148 remaining unit tests and the
production build. The full browser suite passed 136 tests in 3.0 minutes in
Windows Chromium/mobile-WebKit. Two existing Chromium-only native-touch tests
were skipped in WebKit; physical Safari touch remains a manual check.

Coverage includes remaining navigation, split views, drafts, save failures,
focus, captions, no task-data reads and root/project-path app updates. A local
Chromium check at 390px confirmed the five remaining toolbar controls and no
uncaught page errors. No task strings or paths remain in the production assets.
The initial sandbox check hit the known Vite configuration-read restriction;
checks and browser tests passed outside the sandbox.

No physical-device verification or publication was performed. Existing shared
data was not modified; browser editing tests used mocked GitHub responses.
