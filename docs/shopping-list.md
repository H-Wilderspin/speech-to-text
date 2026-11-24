# Shopping list

Open Shopping from the footer. It is one ongoing shared list, with the same
[connection](hosted-editing.md#pairing-and-owner-commands), split view and refresh
controls as meals. Viewing needs no login; editing requires a connection.

## Controls

- **Add item** stays at the panel bottom and hides while editing.
- Use the pencil to edit, bin to delete, and checkbox to mark bought.
  Quantities can be included in the text.
- Drag row text/background with a mouse. On touch screens, hold briefly (350ms),
  then drag; an immediate swipe scrolls. Embedded buttons keep their own actions.
- With a keyboard, focus item text, press Space/Enter to pick up, use arrows or
  Home/End to position, then Space/Enter to drop. Escape cancels.
- **Regular items** tiles add items; tapping an Added tile removes matching items,
  including bought ones. Matching ignores case/repeated spaces; quantity variants
  remain separate.

A drop outside the list or cancelled gesture does not reorder it. Edge dragging
scrolls the list. Opening/restoring an editor stops listening and retains captions.

## Saving and conflicts

Changes appear immediately and enter a durable local journal. They save after two
idle seconds or ten seconds of continuous editing. Navigation/Refresh can start
an earlier save. Clean or net-zero batches do not write.

Visible documents refresh every minute and on return to the tab; the regular-item
catalogue refreshes every five minutes. Hidden panels stop polling, while pending
writes continue. Refresh checks both planners and overlays pending edits without
replacing drafts. Dragging defers refresh/save publication.

Each batch reads the latest file and uses its SHA for a conditional write.
Independent changes merge, including a rename and someone else's bought tick.
Same-field edits, delete-versus-edit and incompatible ordering need the affected
item's **Keep mine / Use family change** choice. Other items continue saving.
Newer local edits survive older save responses.

Completed changes survive normal reloads; unapplied editor text only survives
navigation in the current page session. Outages retain the queue and retry with
backoff; service pauses may delay retries longer. If local storage fails, keep the
app open until the remote save succeeds. Clearing site data removes unsynced edits.
See [sync design](decisions/0066-local-first-planner-sync.md).

## Data format

Files live in the public
[meal data repository](https://github.com/H-Wilderspin/speech-to-text-meals);
their history is public too. Missing files are created on first save.
`shopping/list.json` stores array order, stable IDs and bought state:

```json
{
  "version": 1,
  "items": [
    { "id": "example-apples", "text": "Apples ? 6", "checked": false }
  ]
}
```

IDs are unique, 1?64 letters/digits/hyphens; new items use UUIDs. Text is nonblank
and at most 300 characters. Malformed remote documents are never overwritten;
cached edits wait for repair. Credentials are kept outside the planner database.

The bundled catalogue is in `src/features/shopping/regular-items.ts`.
To replace it without an app release, create `shopping/regular-items.json`:

```json
{ "version": 1, "items": ["Puppy pads", "Wet wipes", "Pants"] }
```

This replaces the whole catalogue. Names have the same 300-character limit;
duplicates collapse. An empty array hides all quick-add tiles. A missing file
uses the bundled list. There is no catalogue editor in the app.
