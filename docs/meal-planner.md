# Meals

Open Meal planner from the footer. It shows Monday?Sunday with Breakfast, Lunch
and Dinner. Use the arrows or swipe left/right on touch screens to change weeks.
When viewing another week, **Go to this week** stays at the panel bottom and hides while editing.
The date sits beneath the title; Today is highlighted. For shared layout and
refresh controls, see [the interface guide](interface-style.md).

## Editing and weekly defaults

Viewing needs no login. To edit, connect once using **Settings ? Family connection**
and a code from the family administrator. See [pairing and recovery](hosted-editing.md#pairing-and-owner-commands).
Builds without a service URL retain [legacy token access](hosted-editing.md#legacy-token-builds).

Tap a meal to edit it. Opening the editor stops listening; Save or Cancel does
not restart it. Save applies the change locally and queues a background save.
Save and Cancel stay in a separate row while the editor's fields scroll when
space is limited. The app follows the visible screen area when the on-screen
keyboard resizes or pans it, including across repeated edits.
Draft text and its date/default scope survive screen switches, reloads and reopening
on this device. Opening meals recovers the most recent draft's week. Save submits
the draft; Cancel clears it. Newer family edits still go through conflict review.

- **This date only** sets a dated override.
- **Every [weekday] [meal]** sets a weekly default, including past weeks without
  a dated entry.
- **Skip this meal** leaves one dated slot empty.
- **Use weekly default** removes a dated override or skip.
- **Remove weekly default** stops the recurring meal without changing dated entries.

Dated entries always win. Creating a default from a date with its own meal does
not replace that dated meal; select Use weekly default separately.

Completed edits persist locally and save after two idle seconds, with a ten-second
maximum batching window. Independent cells merge; competing changes to the same
cell/default show **Yours / Family**, **Keep mine / Use family change**. Other
cells keep saving. Navigation and refresh preserve drafts and pending edits.
See [sync design](decisions/0066-local-first-planner-sync.md).

## Data format and recovery

Data and history are public in
[H-Wilderspin/speech-to-text-meals](https://github.com/H-Wilderspin/speech-to-text-meals).
Data edits do not require an app deployment. Use GitHub file history for recovery;
removing a meal does not erase its history.

`weeks/YYYY-MM-DD.json` uses the Monday's date:

```json
{
  "version": 2,
  "meals": {
    "2026-10-19/breakfast": "Porridge",
    "2026-10-19/lunch": "Soup",
    "2026-10-19/dinner": null
  }
}
```

Keys must belong to that week and end in `/breakfast`, `/lunch` or `/dinner`.
Text is limited to 300 characters; `null` skips the slot. An absent key inherits
the default. Version 1 text-only files remain readable; new saves use version 2.
A missing file means no dated overrides. Invalid files are not overwritten.

`defaults.json` contains weekday defaults:

```json
{
  "version": 1,
  "meals": {
    "monday/breakfast": "Porridge",
    "friday/dinner": "Fish and chips"
  }
}
```

Keys use lowercase weekday/meal names. Values are text, never null. A missing file
means no defaults; the first saved default creates it.

A failed read retains cached data. Completed offline edits survive normal reloads,
but browser storage clearing/eviction can remove them. If storage fails, keep the
app open until the remote save succeeds. Never clear site data as a sync fix.
