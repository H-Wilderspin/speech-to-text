# ADR 0064: Footer refresh and a simpler meal header

Date: 2026-11-24
Status: Accepted; supersedes control placement in ADRs 0061/0062

## Context

The user requested moving Refresh and Split view into the global footer, putting
week arrows beside Meal planner, and placing the date directly below the header.
Refresh should check meals and shopping together and update data where it differs.

## Decision

The meal header contains Previous week, Meal planner and Next week. The date and
optional This week action appear below. Shopping has a title-only header. Place
Refresh in the footer, followed by Split view immediately left of Settings.
Retain 48px targets, selected split state and the 768px split threshold. Refresh
is enabled while a planner remains mounted; Split view needs a visible planner.
Caption-only screens retain disabled data controls. Small phones wrap Listen
onto its own row so icon targets remain usable.

Own the refresh request in App and pass it to both mounted data views. An explicit
refresh loads the selected week's meals, weekly defaults, shopping list and
regular-items catalogue, including the hidden view. Automatic hidden polling
remains paused. Compare incoming data by value and retain unchanged state arrays
and records. Keep the selected week, editor text, focus and scroll containers.

Shopping still flushes pending changes before reading a replacement list. Failed
saves or conflicts retain local changes. Meal drafts remain open, with the usual
conflict check before saving. No page reload, transcript reset, extra dependency,
storage or data schema change is introduced.

## Validation

Browser tests check header/date geometry, footer toggle order, 320px through
desktop layouts, tablet split behavior, both data sets refreshing together,
draft retention, unchanged rows and shopping save protection. Refer to the
corresponding feasibility entry for final check results and device limitations.

## Follow-up: stacked header date

On 2026-11-24 the user requested moving the date inside the header, stacked
beneath Meal planner. Title and date now share a centered column between the
week arrows, and scroll together as part of the sticky header. The optional
This week action remains below. This replaces the date placement described above;
footer controls and refresh behavior stay as decided.
