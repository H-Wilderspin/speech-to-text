# 0068: Planner pull-to-refresh

Date: 2026-11-24
Status: Accepted

## Decision

The user requested pulling down from the top to sync and refresh. Add a touch
gesture to the visible planner pane, sharing the footer Refresh callback. A
single-finger downward pull starting at the top arms after 72 CSS pixels and
refreshes on release. Show pull/release instructions during the gesture.

Keep the document sync pipeline, local queue, conflict handling and editor drafts
unchanged. Refresh both planners and their defaults/catalogue without reloading
the app or interrupting captions. The footer remains the accessible alternative.

Exclude controls, forms and shopping rows so editing, selection and touch reorder
retain their behaviours. Ignore short, horizontal, reversed and multi-touch pulls;
cancel on interruption, resize, hidden pane or dragging. Only prevent the default
touch move for a recognised downward pull. Each split pane scrolls independently.

## Validation and limits

`npm run check` passed typecheck, lint, 168 unit tests and production build.
The focused Playwright shopping suite passed 13 cases across Chromium and WebKit:
both planners refresh together, pending edits merge, drafts persist, invalid
gestures cancel, and existing touch reorder/scrolling still work. Three native
touch cases skip WebKit because their input uses Chromium CDP. Native Chromium
pulling also retains a page marker, verifying no reload.

No physical phone/tablet was tested. Safari native overscroll and installed-PWA
behaviour remain manual checks; synthetic WebKit events only verify app logic.
