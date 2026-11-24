# Shared shopping list

On touch screens, pull down from the header while the list is at the top, then
release when prompted to sync and refresh both planners. This uses the same
action as footer Refresh, preserving pending edits and editor text without a
page reload. Pulling a shopping row keeps its existing scrolling/dragging behaviour.
The footer Refresh icon is desktop-only: at least 1024px wide with a hover-capable
fine primary pointer. Phones and touch tablets use pull-to-refresh.

The shopping-cart icon opens the list in the existing planner pane. Full view,
the tablet-sized footer Split view toggle and shared footer Refresh behave like meals.
Refresh checks both apps and their defaults/catalogue, updating changed data while
preserving drafts. Shopping's header contains only its title. The meal
planner is hidden; captions remain available in split view. Use the speech-bubble
Speech to text icon to return directly to full captions. Tapping the active cart
icon again also returns to captions. The global footer stays visible in every view;
switching to meals or Settings retains editor drafts. Completed changes are kept on the device and save in the background, including
while another screen is visible. Unapplied editor text stays for the page session
but clears on reload. There is no week selection. Split view is available at 768px and wider: captions
are always on the left and shopping on the right. On narrower screens the toggle
is hidden and shopping uses the full view, preserving drafts and the split preference.

Add item stays in a sticky footer at the bottom of the shopping panel in full and
split views, including when the list is short. It hides while the item editor is
open and returns after Save or Cancel. The app navigation footer remains below it.
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
in the device journal until a successful GitHub save. Quantities can be part of the text. Grey
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

Reuse the existing Settings → Planner editing connection and automatically remembered
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
most 300 characters. New items use UUIDs. Unsupported/malformed remote files are
never overwritten. A cached valid list remains editable; those edits wait until
the shared file is repaired. Documents and pending actions are stored in IndexedDB,
scoped to this app path. Tokens remain in the existing separate access storage.

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

The list updates immediately. Completed actions are kept in an IndexedDB journal,
then save in a batch after two seconds without another edit, or ten seconds of
continuous editing. Clean and net-zero changes do not write. Save in the item
editor applies text locally and closes the editor; network work never disables
editing or ordinary navigation. Footer Refresh and navigation start an earlier
save. Failed saves retain the queue and retry with increasing delays, up to a
minute. Retry saving and reconnecting can retry sooner.

The list loads on opening, returning to the tab and every minute while visible.
The catalogue reloads every five minutes; on failure the current catalogue stays,
or the bundled catalogue is used on a new offline visit. Hidden panes do not poll,
but pending writes continue. Refresh merges family changes under local operations
and preserves active editor text. Drag gestures defer refresh and save publication.

Each batch reads the latest GitHub file and uses its SHA for a conditional write.
Independent items and fields merge: a rename and someone else's bought tick can
both survive. A conflict stays beside only the affected item with Yours/Family,
Keep mine and Use family change. Deleting an edited item and incompatible list
ordering require review. Moves retain family additions and do not resurrect deleted
items. Other items keep saving. A newer family change during conflict resolution
can require another choice; nothing silently overwrites it. Concurrent identical
adds are deduplicated; explicitly keeping a conflicting rename may retain two
separate items with the same name.

Normal reloads and app updates restore completed pending actions. View navigation
also retains unapplied drafts for the current session. If browser storage fails,
a warning asks you to keep the app open until GitHub saves succeed; navigation to
Settings still works to fix access. Page exit is guarded only for changes not yet
kept locally. Clearing/evicting site data or closing a private session can remove
pending changes. There is no guaranteed unload-time network request.

See [ADR 0066](decisions/0066-local-first-planner-sync.md). Automated coverage:
`src/features/planners/sync-document.test.ts`, shopping unit tests,
`tests/local-sync.spec.ts` and `tests/shopping.spec.ts`. Physical iPad/phone touch
and screen-reader checks remain in the manual matrix.
