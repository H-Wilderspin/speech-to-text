# 0070: Touch navigation between meal weeks

Date: 2026-11-24
Status: Accepted

The user requested left/right swipes on the phone and tablet meal planner. Handle
single-finger touch gestures only in the visible Meals pane. Left goes forward
seven days; right goes back seven days, using the same callback as the header
arrows. Keep existing week-specific drafts and background sync ownership.

After a clearly horizontal initial movement, prevent native touch movement and
the release click. Navigate once on release after at least 60 CSS pixels. Ignore
vertical movement, short/reversed pulls, multiple fingers and editor controls;
cancel on interruption, resize, hiding or changing apps. A tap still opens a meal
card. Vertical scrolling and the separate downward refresh gesture remain active.

Touch events enable this on phones and tablets without user-agent detection and
also allow a touch-capable laptop to use it. Mouse/keyboard users retain arrows.
No animation, dependency or storage change is required. Browser edge navigation
and physical Safari/PWA gestures remain manual checks.
