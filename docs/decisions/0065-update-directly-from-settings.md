# ADR 0065: Update directly from Settings

Date: 2026-11-24
Status: Accepted; replaces the planner-open update guard in ADRs 0053 and 0062

Superseded for persistence and save/navigation behaviour by [ADR 0066](0066-local-first-planner-sync.md).

## Context

Settings replaces the visible planner, but keeps its state mounted so ordinary
navigation preserves drafts. Requiring users to leave Settings and close that
hidden planner before updating is confusing. The user requested removing this step.
Settings can also hold unsaved shopping changes after an authentication failure,
because it is the place to replace the token (ADR 0063).

## Decision

Allow Update app from Settings regardless of the retained planner. Remove the
planner-open prop and message. Continue blocking during listening and connection.
Before downloading/activating the update, await the shopping handle's existing
flush operation. If saving fails, keep Settings and the pending batch intact,
show a save error and allow retry after recovery. Do not reload or bypass conflicts.

Normal Settings navigation still preserves editor drafts. Explicit updating
reloads the app and clears captions and unapplied editor text; the existing update
help explains this. Saved preferences and remembered access remain. No extra
confirmation, storage, dependencies or service-worker lifecycle changes.

## Validation

App-update browser tests install two real local releases at root and project
paths after entering Settings from Meals. Listening remains a guard. Shopping
tests verify an expired-token batch prevents updating and survives token renewal.
See feasibility.md for executed checks and physical-device limitations.
