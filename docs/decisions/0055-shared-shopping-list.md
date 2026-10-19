# ADR 0055: Shared ordered shopping list

Date: 2026-10-19
Status: Accepted

Reordering controls are superseded by [ADR 0056](0056-shopping-drag-and-delete.md).

## Context

The user requests a shopping pane equivalent to meals/tasks, shared CRUD, manual
ordering and muted fixed-item quick-add buttons. They supplied 24 catalogue items.

## Decision

Reuse the existing planner frame, GitHub transport and editing token. Store an
ongoing ordered array of stable-ID items in `shopping/list.json`; each has text
and a bought checkbox. Use labelled up/down buttons for touch and keyboard
reordering. The fixed catalogue ships with the app; an optional separate
`shopping/regular-items.json` can replace it without deploying the app.

Apply narrow operations to fresh data before conditional writes. Merge independent
fields; reject stale item edits/removals and stale ID ordering. Deduplicate names
for additions. Retain drafts, only show confirmed saves, pause hidden polling and
preserve the existing caption lifecycle. No dependency or backend is added.

## Consequences

The same public-data and personal-token constraints apply. List order is global
and bought items remain until removed. Every move is a save; arrow controls are
simple and accessible but take multiple taps for long moves. Updates use existing
60-second/focus/manual polling. Offline changes are not queued.

At 375px and below, Listen gets its own toolbar row so all five icon buttons
retain 48px targets. Wider phone layouts retain the single control row.

## Validation

Unit tests exercise schema validation, independent-field merging, stale changes,
order protection, conditional-write retries, catalogue parsing and missing files.
Browser tests cover CRUD, reordering, quick adds, cross-device reads, draft/split
behaviour, failed saves and active-only polling in Chromium and WebKit. See
`docs/feasibility.md` for executed checks and physical-device limitations.
