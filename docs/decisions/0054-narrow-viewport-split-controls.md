# ADR 0054: Disable side-by-side split in narrow viewports

Date: 2026-10-19
Status: Accepted; supersedes ADR 0051's all-width split availability

The user requests a disabled vertical split button in tiny viewports. Use 768 CSS
pixels as the minimum width for side-by-side panes. Below it, the native button
is disabled with the existing dimmed styling and a wider-window tooltip.

Observe the viewport through matchMedia and useSyncExternalStore at app level.
Derive both the pane layout and button states from the same snapshot. A preferred
vertical split temporarily renders horizontally below the cutoff, including when
the planner was closed during resize, and returns when widened. Explicitly
choosing full/horizontal replaces the remembered preference. Do not remount
planners or stop captions on resize; drafts and selected weeks remain intact.

Browser checks cover 320, 767, 768 and 1280px, both planners, a draft during
resize across the boundary, and return to full view. Physical rotation and zoom
acceptance remain manual checks.
