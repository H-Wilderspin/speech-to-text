# ADR 0051: Explicit split orientation controls

Date: 2026-10-19
Status: Accepted; supersedes the layout-selection UI in ADR 0050

The all-width availability rule below is superseded by
[ADR 0054](0054-narrow-viewport-split-controls.md).

## Decision

At the user's request, replace the checkbox with vertical and horizontal split
icons at the right of the planner title bar. Back and Refresh form a pair on the
left. Vertical means side-by-side panes; horizontal means captions above meals.
Both are labelled toggle buttons with aria-pressed. Selecting the active split
again restores the full planner. Preserve the selected mode in page state until
reload, and keep the same planner mounted as in ADR 0050.

The chosen direction applies at every viewport width, replacing automatic
direction changes. A narrow side-by-side panel wraps its title/header controls
and week navigation to retain 48px touch targets. Horizontal split gives more
reading width on phones. Container-based meal layouts remain in place.

## Validation

Browser coverage checks both directions at 1280, 768 and 320px, the two header
button pairs, mutually exclusive pressed states, return to full view, caption
controls and preservation of the week/draft across all modes. Physical phone and
assistive-technology checks remain in the manual acceptance list.
