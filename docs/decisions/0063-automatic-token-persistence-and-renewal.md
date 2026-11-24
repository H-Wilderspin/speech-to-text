# ADR 0063: Automatic token persistence and renewal

Date: 2026-11-24
Status: Accepted; supersedes persistence choice and renewal flow in ADR 0048

## Context

The user requested a simpler GitHub setup for elderly users: remove the Remember
checkbox, always save successful connections, and accept replacement tokens
without requiring a manual disconnect/reconnect sequence.

## Decision

Validate submitted tokens, then save them in the existing app-scoped localStorage
key. Replacing access is one state/storage update after validation, so a rejected
replacement does not erase the previous connection or planner drafts. Retain an
accurate session-only notice if storage is unavailable. If a replacement cannot
be stored, attempt removal of the stale saved token to prevent its restoration.

Settings checks existing access and shows the new-token form for rejected access.
Authenticated planner reads/writes report access failures to the app; Settings
then asks for a new token with a Save new token action instead of Disconnect.
Offer Change token for renewal before expiry. Token entry remains masked, and no
credentials are logged or added to URLs. Retain confirmed Disconnect for users
who deliberately want to forget access. Replacement requires no confirmation.

Separate authentication/permission failures from network errors and rate limits.
A failed shopping flush caused by rejected access allows opening Settings while
keeping the pending batch mounted; navigating back after renewal flushes it with
the new token. Other failed flushes continue to block navigation. Keep drafts,
caption sessions, conflict checks and app-update protections.

## Consequences

Setup has one fewer choice and renewal has one submission. Any user of the same
browser can use its saved editing access, as with previously remembered tokens.
Browser storage restrictions still prevent guaranteed persistence. No new token
scope, backend, third-party storage, dependency or public data write is introduced.
The previous save-before-navigation rule gains a narrow recovery exception for
Settings; the unsaved shopping batch is never discarded by that exception.

## Validation

Unit coverage checks persistence, namespace isolation, replacement storage failure
and rate-limit classification. Browser coverage checks reload/reopen, explicit
Disconnect, failed/expired replacements, preserved meal drafts and shopping batches
through 401/403 recovery. See the matching feasibility entry for execution results
and device limitations.
