# ADR 0062: Global footer navigation

Date: 2026-11-24
Status: Accepted; supersedes the modal and Back/Close navigation in ADR 0061

[ADR 0063](0063-automatic-token-persistence-and-renewal.md) adds an exception to
save-before-navigation: authentication failures allow Settings to open while
the pending shopping batch stays mounted for token recovery.
[ADR 0064](0064-footer-refresh-and-planner-header.md) moves Refresh and Split view
to the footer and makes explicit Refresh check both data views.

Settings split and toggle behaviour is superseded by [ADR 0067](0067-settings-split-and-toggle.md).

## Context

The user requested replacing modal app screens with a persistent global footer.
Selecting an icon should replace the main screen; visibility should be controlled
through footer toggles without Back or Close buttons.

## Decision

Render captions, the planner and Settings within the main content area above one
footer. Meals and Shopping switch the selected app; tapping its active icon
returns to captions in both full and split modes. Settings temporarily replaces
the main view, with its icon restoring the prior view. Escape and outside clicks
do not dismiss these screens. Keep the deliberate Disconnect confirmation as an
alert dialog, as required by the existing access policy.

Retain the tablet-width Split view toggle from ADR 0061. Preserve mounted planner
state when switching apps or visiting Settings, and pause hidden polling. Flush
shopping changes before any footer navigation; errors retain the visible list.
Disable navigation during saves, reordering, connection and app updates. Caption
controls remain available except during an app update. Preserve transcript state
and reading position while hidden, continuing the existing recognition session.

## Consequences

The footer is reachable while content scrolls, including on phones. Screens are
labelled regions rather than dialogs; hidden content is excluded from keyboard
and accessibility navigation. Footer controls expose their selected state and
retain focus after asynchronous saves. Closing the planner still discards text
not yet applied through an editor's Save button; switching apps retains it.
Settings originally retained the update guard while a planner draft remained
mounted; [ADR 0065](0065-update-directly-from-settings.md) replaces that guard.
No additional dependencies, storage, backend or transcript persistence are added.

## Validation

Browser coverage in app, meals, shopping and app-update suites checks navigation,
footer geometry, removed dismissal routes, full/split draft retention, caption
continuity, save protection, reading position, reordering and update guards.
See the corresponding entry in [feasibility](../feasibility.md) for executed checks
and physical-device limitations.

## Follow-up: explicit captions destination (2026-11-24)

The user found toggling another app off unclear. Add a Speech to text speech-bubble
icon to select full captions directly from any view. Use the existing navigation
guard, including flushing pending shopping changes, and preserve the listening
session and split preference. Highlight this icon only when captions are the sole
selected screen. Existing app-toggle shortcuts remain available. At phone widths,
wrap the footer into rows while retaining 48px touch targets.
