# ADR 0049: Weekly meal defaults with dated exceptions

Date: 2026-10-19
Status: Accepted; extends ADR 0047's data format

## Context

The user requests recurring defaults for specific meal slots and confirms weekly
recurrence with date-specific overrides. Defaults must be shared across devices
through the existing public data repository, with the same editor credentials.

## Decision

Store `defaults.json` beside `weeks/`, using version 1 and a meals map keyed by
lowercase weekday/slot, for example `monday/breakfast`. A missing defaults file
means no defaults; the first default save creates it. Values are plain text up
to 300 characters, with the same validation as dated meal descriptions.

Read both the selected week and defaults on opening, refresh and periodic/focus
updates. Apply a default only when the weekly file has no entry for that date
and meal slot. Existing dated meals remain authoritative. Defaults are templates
for all weeks, including past weeks without dated entries, not historical
snapshots or schedules starting on a particular date.

New weekly writes use version 2. Version 1 text-only files remain readable.
Version 2 permits `null` as an explicit skip for that date; a missing key means
inherit the weekly default. Removing a dated meal writes a skip so a default
cannot unexpectedly reappear. Use weekly default deletes the dated entry.
Removing a recurring default affects only its weekday/slot and preserves all
dated meals and skips. Version 1 defaults never accept null or dated keys.

The meal editor offers This date only (initial selection) and Every weekday/meal
under Apply to. Inherited meals show Weekly default. When editing a default from
a date with its own entry, explain that the dated entry will stay unchanged.
Default changes write only defaults.json; dated changes write only that week's
file. This avoids a partially completed operation across two files.

Use the existing GitHub Contents API conditional SHA writes for both documents.
Re-read before saving, merge independent slots and reject changes to the same
slot since the editor opened. Preserve drafts on errors/conflicts. Defaults and
weekly data are read together before enabling initial editing; an unavailable or
malformed file is not treated as an empty plan. The two reads are not an atomic
repository snapshot; later refreshes reconcile changes made during loading.

## Consequences

- No backend, new dependency, copied future-week files or credential changes.
- Old clients that do not support version 2 cannot read new weekly writes;
  publish the updated application before using the new format on live data.
- Existing v1 weekly files and absent defaults need no up-front migration.
- Default updates can change the display of past weeks without explicit entries.
  Git history preserves previous definitions, but the UI is not a meal history log.
- A skip persists even if the default is later changed, until explicitly reset.

## Validation

Unit tests cover inheritance, skips, version compatibility, defaults validation,
creation, deletion, conditional merges and conflicts. Browser tests cover shared
defaults across weeks/devices, dated overrides, skip/reset, removing defaults
without erasing exceptions, and retained drafts on errors/conflicts. Executed
results and remaining live/physical checks are recorded in feasibility notes.
