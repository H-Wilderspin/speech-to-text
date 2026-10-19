# ADR 0058: Reset task completion ticks once on Sunday

Date: 2026-10-19
Status: Accepted; extends task completion handling in ADR 0052

## Context

The user requests automatic Sunday clearing of checked task items. Interpret
clearing as resetting completion ticks while retaining tasks and recurrence.
Tasks already belong to Monday–Sunday files. Multiple devices, anonymous readers
and suspended/closed browsers make a repeated timer-only reset inappropriate.

## Decision

For each weekly file, clear its completion map once on or after the start of its
Sunday in local calendar time. Keep all task definitions, overrides and skips.
Store that Sunday's date as completionReset. Subsequent ticks are retained,
including when viewing the week later. Catch up on the next read of a missed
week; no global scan or background service is introduced.

The visible task planner synchronizes on opening, day change, minute polling,
focus and visibility return. Editors save a due reset with the existing SHA
conditional transport and three-attempt retry limit. On a race, read again and
honour the other device's marker, preserving any new ticks. Anonymous views
derive the same unchecked state without writing. A save also applies any due
reset to the latest file before checking the requested field change.

Reset weekly documents use version 2 with a required, validated Sunday marker.
Continue accepting version 1; recurring defaults stay version 1. Older clients
reject version 2 instead of silently stripping the marker during writes and
causing repeated resets. Update app is the migration path for those clients.

## Consequences

No tasks or recurrence are deleted. Historical completion ticks in an unreset
week are cleared when that week is next viewed; GitHub history retains earlier
values. No writes occur solely because an anonymous reader opens the list.
There is no execution while the app is closed, nor a guarantee of delivery at
midnight. An open visible planner updates within its polling interval. Different
time zones use their local Sunday; the first editor's shared marker wins.
Failed automatic writes leave the displayed snapshot intact and expose a retryable
error. Existing editor drafts survive reset refreshes. No live data is modified
as part of implementing or testing this change.

## Validation

Unit coverage checks the local midnight boundary, New Year, catch-up, retention
of definitions and subsequent ticks, malformed markers, anonymous reads, failed
writes, concurrent SHA retries and saves crossing the boundary. Browser coverage
checks the Saturday/Sunday transition, drafts, later ticks across devices,
anonymous catch-up and failed-reset recovery. Execution results are recorded
in feasibility.md; physical tablet checks remain pending.
