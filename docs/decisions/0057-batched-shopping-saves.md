# ADR 0057: Immediate local shopping edits and batched saves

Date: 2026-10-19
Status: Accepted; supersedes shopping save timing in ADRs 0055–0056

## Context

The user asks for shopping changes in state, saved to GitHub every 30 seconds or
on close. The previous per-action save made each item wait for a network write.

## Decision

Update local state immediately. Keep the last shared snapshot and compare it
with the current list to determine whether there are net changes. Flush one
batch every 30 seconds, before close/switch and manual Refresh. Disable edits
only during the actual save; share its promise to prevent overlapping writes.
Preserve local state on failure and refuse to close until resolved. Pause remote
replacement while dirty, saving or dragging. Show pending/saving/error state.

Merge base/local/latest by stable ID and field. Preserve unrelated remote changes;
reject incompatible local/remote ordering and conflicting item edits/deletions.
Use net changes, not an operation log, so retry after a lost response is idempotent.
Show the remote snapshot on conflict, with explicit Keep my changes / Use shared
list choices. Keep my changes rebases onto the reviewed snapshot; a later conflict
is checked again by the normal conditional save. Existing file schemas stay intact.

App-level navigation awaits the shopping handle's flush. Shared modal dismissal
requests navigation rather than closing its native dialog first. This covers
Back, Close, Escape, outside clicks and toolbar actions. Restore focus after the
save has re-enabled controls. Meals/tasks retain their per-action saves.

## Consequences

Fast consecutive edits and reorders need one GitHub commit. Changes are shared
after the flush, not immediately. Failed writes retry on the next interval or
explicit retry; conflicts require review. Editor text still needs its Save button
to enter the list. Closing an unapplied editor draft retains prior discard behaviour.

State is in memory, not a durable offline queue. Visibility loss triggers a
best-effort save; a dirty beforeunload listener requests the browser's leave-page
warning. Mobile process termination can skip events or cancel requests. Finishing
an in-app close is the reliable save-before-leaving route, not forced browser exit.

## Validation

Unit tests cover merge semantics, duplicate adds, batches/retries and net-zero
changes. Browser tests cover immediate state, the 30-second timer, each close
route, planner switching, focus, failures, conflict resolution and the exit guard.
Shared modal regressions are checked across the other planners. See feasibility
evidence for executed results and device limitations.
