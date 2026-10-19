# ADR 0056: Shopping drag handles and direct deletion

Date: 2026-10-19
Status: Accepted; supersedes ADR 0055's up/down buttons

Save timing is superseded by [ADR 0057](0057-batched-shopping-saves.md).
Grip-only pointer pickup is extended by [ADR 0059](0059-shopping-row-dragging.md).

## Context

The user requests direct delete icons and drag-and-drop instead of separate
up/down controls. The list must remain usable on tablets and with a keyboard,
and preserve existing concurrent-edit protection.

## Decision

Use a 48px grip button with Pointer Events and pointer capture for mouse/touch
movement. Limit `touch-action: none` to the grip so the rest of the row can scroll
normally. Show a floating item label and insertion line; edge scrolling stops at
the list ends. Space/Enter picks up/drops for keyboard users, Up/Down/Home/End
choose a position and Escape cancels. Announce positions through the existing
status region. No drag library or native HTML drag API is introduced.

Suspend polling and disable other list/planner actions during a move. Cancel on
pointer cancellation/lost capture, outside drop, blur, hiding or resize. Clean up
listeners and animation frames on exit/unmount. Keep the confirmed order until
one conditional save on drop succeeds; use a target index plus the original ID
order to retain stale-order detection. Data file format stays version 1.

Each row also gets a labelled bin button using the existing protected-against-
concurrent-change removal operation. It removes directly, without opening the
editor. Focus moves to the next remaining item's editor or Add item.

## Consequences and validation

Long moves take one gesture/save. Keyboard access remains available without
keeping the arrow buttons. Direct deletion is immediate as requested; regular
items can be added again from the catalogue. Failed saves do not remove items.

Unit checks cover target bounds, multiple-position moves and stale order. Browser
checks exercise mouse, keyboard, cancellation, long-list scrolling, direct delete
failures and conflicts. Chromium CDP supplies native touch events; physical Safari
touch and VoiceOver remain manual acceptance checks. See feasibility evidence.
