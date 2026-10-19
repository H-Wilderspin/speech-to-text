# Task planner

Use the checklist beside the cutlery to open a Monday–Sunday task list for
shopping trips, housework or other activities. Only one
planner is visible at a time. In either split mode, switching between the two
icons replaces the planner pane while captions and Listen/Stop/Clear remain
available. Close (×) hides the split pane; full planner mode uses Back before
opening the other planner.
In split view, tapping the active planner's toolbar icon closes its pane;
tapping the other icon switches planners. Reopening keeps the split direction.
Below 768px, vertical split is disabled. Existing side-by-side panes stack while
narrow and return when widened; selected weeks and drafts stay intact.

The existing GitHub connection in **Settings → Planner editing** serves both
planners. No new token or repository is required. Reading needs no login;
editing and completion ticks require write access. Remembered access from the
meal planner is retained. Data and history are public in the same
[data repository](https://github.com/H-Wilderspin/speech-to-text-meals).

## Tasks and completion

1. Choose Add task on a day. Enter the task and save for This date only, or
   choose Every Monday (the selected weekday) to repeat weekly.
2. Tick a task when done. The tick is shared with other readers, applies only
   to that date, and is saved immediately. Untick to undo. A failed save shows
   an error and leaves the previous completion state visible.
3. Use the pencil to edit. This date only creates a dated exception; Every
   weekday changes the recurring task. Existing dated exceptions stay unchanged.
4. Skip this task hides its checkbox for that date and offers Restore task.
   Use weekly task removes a dated edit. Remove weekly task stops recurrence
   without deleting explicit dated tasks. Remove task deletes a one-off task.

A day can have several tasks, including tasks with the same description. Each
has its own ID and checkbox. Recurrence applies to every matching weekday,
including past weeks without exceptions. Changing a task's text retains its ID
and any existing completion tick. Skipping/restoring also preserves that date's
tick. Deleting and recreating a task creates a new ID with fresh completion state.

Each week's ticks reset once at the start of its Sunday, using the device's
local date. Tasks, dated edits, skips and recurring defaults stay in place.
Ticks made after that reset stay checked; refreshing or opening another device
does not reset them again. The next week still starts with its own unchecked tasks.

The visible planner checks on opening, every minute and when returning to the
tab. There is no background scheduler while the app is closed: a missed reset
catches up when that week is next viewed, including an older week. Anonymous
readers see the reset without writing; a connected editor saves the reset and
its marker to GitHub. Failed reset saves show an error and retain the previously
displayed list; Refresh or the next poll retries.

Both planners retain drafts when switching icons or split direction. Changing
week, closing the pane or reloading discards unsaved drafts. While saving,
navigation, planner switching and closing are disabled; caption controls work.
The visible planner refreshes every minute, on returning to the tab and through
Refresh. Background updates retain the draft; conflicting edits require review.
Failed saves are not queued offline. Only the app shell is cached.

## Data files

The first save creates the required file; no manual initialization is needed.
The existing `cleaning/` paths are retained for compatibility with saved tasks;
the Task planner rename does not require a data migration.
Meal files remain unchanged. Recurring tasks use `cleaning/defaults.json`:

```json
{
  "version": 1,
  "tasks": { "monday/task-123": "Vacuum the lounge" },
  "completed": {}
}
```

Dated tasks, skips and completion ticks use `cleaning/weeks/YYYY-MM-DD.json`
(Monday's date):

```json
{
  "version": 1,
  "tasks": { "2026-10-19/task-123": null, "2026-10-20/task-456": "Clean windows" },
  "completed": { "2026-10-20/task-456": true }
}
```

The app creates UUID task IDs; imported IDs may contain 1–64 letters, digits or
hyphens. Text is limited to 300 characters. A dated null skips the weekly task;
an absent dated entry inherits it. Default tasks cannot be null. Completion
values must be booleans in a weekly file, never in defaults. Keys must belong to
the named week or weekday. Missing files are empty; malformed files are rejected
before writes. Stale completion entries for removed tasks are harmless and do
not recreate tasks. GitHub SHA checks merge edits to separate fields/tasks and
reject conflicting changes to the same task or checkbox.

After its Sunday reset a weekly file uses version 2, with the same task and
completion maps plus `"completionReset": "2026-10-25"` (that week's Sunday).
The marker prevents clearing ticks made afterwards and must be retained on
all subsequent writes. Existing version 1 files remain readable; defaults stay
at version 1. Older app versions reject version 2 rather than dropping the marker:
use Settings → Update app on those devices. See [ADR 0058](decisions/0058-sunday-task-completion-reset.md).

Use GitHub history to recover data. As with meals, deletion in the app does not
erase public commit history. No deployment is required for data changes.
