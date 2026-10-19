# ADR 0052: Shared cleaning checklists in the planner pane

Date: 2026-10-19
Status: Accepted; extends ADRs 0047–0051

## Context

The user requests a cleaning planner with weekly recurrence, confirms daily
task lists with completion checkboxes, and wants its icon beside cutlery. Meals
and cleaning replace one another while captions can remain visible.

## Decision

Use one shared Planner frame for week navigation, refresh, split direction and
save protection. Keep both week components mounted behind hidden wrappers;
only the active component loads or polls. This preserves drafts when switching
planners without displaying both. Changing the selected week remounts both week
components. Planner switching is disabled during saves. Caption state is separate.

Use the existing data repository and remembered GitHub access. Extract the
existing HTTP/base64/SHA transport for both adapters; retain existing meal formats
and token storage keys. Cleaning lives under cleaning/defaults.json and
cleaning/weeks/YYYY-MM-DD.json, version 1, with task and completion maps.

Task IDs are stable across recurrence and dated overrides. Weekly defaults map
weekday/ID to text; dated entries map date/ID to text or null (skip). Absent dated
entries inherit. Completions map date/ID to boolean, independently of text and
recurrence, so next week's occurrences are unchecked. Deletion leaves harmless
historical completion entries; recreating a task gets a new UUID. Recurrence
changes apply to all weeks without explicit exceptions, as with meals.

Conditional commits compare the selected task/checkbox with the value originally
displayed. Retry unrelated SHA conflicts up to three times; never overwrite a
same-field conflict. Validate every loaded document and proposed mutation. Keep
failed drafts and previously confirmed checkbox state. No offline write queue.

## Consequences and validation

No new service, dependency, microphone stream or separate token setup. Cleaning
data/history is public under the existing repository's policy. Reading remains
anonymous; completion ticks require editor access because they update shared data.
UI and documentation call the existing Settings section Planner editing.

Unit coverage covers recurrence, date boundaries, skip/restore, malformed inputs,
completion isolation, merges/conflicts, idempotency and failures. Browser tests
exercise shared updates, both splits, drafts/captions during planner switches,
remembered credentials, busy controls, periodic refresh and error recovery.
No live cleaning writes or physical-device acceptance are implied.
