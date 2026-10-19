# Shared shopping list

The shopping-cart icon opens the list in the existing planner pane. Full view,
vertical/horizontal splits, Close and Refresh behave like meals/tasks. The other
planners are hidden; captions remain available in split view. Tap the active cart
icon again to return to captions. Switching panes retains editor drafts. Closing
discards text still in the editor that has not been applied with Save; changes
already applied to the list are flushed to GitHub first. There is no week selection.

Use Add item for custom items, the pencil to edit, the bin to delete directly,
and the checkbox to mark bought. Drag anywhere on the row text or background
with a mouse. On touch screens, hold the row briefly (350ms), then drag; an
immediate swipe still scrolls normally. The checkbox, edit and delete controls
keep their own actions. A line marks the drop position, and dragging near the
pane edge scrolls the list. There is no separate drag icon.
Keyboard users focus the item text, press Space/Enter to pick up, use Up/Down or
Home/End to position, then Space/Enter to drop. Escape cancels without closing
the planner. Pointer cancellation, leaving the page or resizing cancels too.
Dropping outside the list does not change its order. A completed move updates the
list immediately, as do adds, edits, bought ticks and deletions. Changes collect
in memory until the next save. Quantities can be part of the text. Grey
Regular items buttons toggle the supplied household essentials: tap to add, then
tap the Added tile to remove the matching item, including bought items. Name
matching ignores case and repeated whitespace; quantity variants remain separate.
Toggles update locally and use the same batched saves as other list changes.
Quick toggles keep focus and the tapped button's position in the catalogue, with
the selected state announced to screen readers. Ticking an item leaves focus
on its checkbox. Save/reorder status and keyboard instructions are available to
screen readers without occupying visible space. Errors and retry controls remain
visible. There is no drag-hint paragraph or save-status row above the list.

## Data and access

Reuse the existing Settings → Planner editing connection and optional remembered
token. Anonymous readers can view the public list. Files live in
`H-Wilderspin/speech-to-text-meals`; all data and commit history are public, as with
the other planners. Missing files are normal; the first save creates the list.
No changes to existing meal/task files are needed.

`shopping/list.json` stores array order, stable IDs and completion:

```json
{
  "version": 1,
  "items": [
    { "id": "example-apples", "text": "Apples — 6", "checked": false }
  ]
}
```

IDs must be unique, 1–64 letters/digits/hyphens. Item text must be nonblank and at
most 300 characters. New items use UUIDs. Unsupported/malformed files block edits
instead of being replaced. Pending changes live in page memory; no shopping data
is stored on disk. Existing preferences and the optional token remain persisted.

The bundled `src/features/shopping/regular-items.ts` contains the 24 items supplied
by the user. To replace that catalogue without an app release, create
`shopping/regular-items.json` in the data repository:

```json
{ "version": 1, "items": ["Puppy pads", "Wet wipes", "Pants"] }
```

This example replaces the whole catalogue. Names use the same 300-character
limit. Duplicate names are collapsed. An empty array intentionally hides all
quick-add buttons; a missing file uses the bundled catalogue. The app does not
provide a catalogue editor.

## Saving, refresh and conflicts

The list updates immediately in React state. Dirty state saves in one batch every
30 seconds, before closing or switching planners, and before manual Refresh.
Clean and net-zero changes do not write. The editor's Save button applies its text
to the local list; screen-reader status announces pending changes and GitHub saves.
Edits/navigation briefly disable during the network save; Stop remains available.
Failed saves keep local changes and the pane open. Retry saving or the next timer
attempt can recover. Only one save can run at a time; drag gestures defer it.

Both files load with cache bypass on opening, focus/visibility return and every
60 seconds while active and clean. Hidden panes stop polling. Pending edits and
drag gestures block refresh replacement. This is polling, not instantaneous push.

Before saving, compare the last shared snapshot, the current local list and fresh
GitHub data. Apply only net local changes so intermediate edits/ticks do not need
separate writes. Merge independent fields and additions. Conflicting edits,
deletions of changed items and incompatible ordering retain the local list and
show the latest shared list for review. **Keep my changes** applies local changes
to that reviewed version while preserving unrelated remote changes; **Use shared
list** discards local changes. A new concurrent conflict still requires review.
Conditional SHA writes retry up to three times; retrying an already-written batch
does not duplicate it. Same-name concurrent additions are deduplicated.

Closing via Back, Close, Escape, outside click or the active cart icon waits for
the save. Leaving for another planner also flushes first. Layout switches alone
keep pending state. Page visibility loss attempts a save; beforeunload requests
the browser's unsaved-changes prompt while dirty and starts a best-effort flush.
Mobile browsers may omit these events and can terminate requests. Close the pane
and finish saving before quitting. Forced exit/reload can lose unsaved in-memory
changes; there is no durable offline queue or guaranteed unload-time GitHub write.

Automated coverage: `src/features/shopping/*.test.ts` and `tests/shopping.spec.ts`.
Physical iPad/phone touch and screen-reader checks remain in the manual matrix.
