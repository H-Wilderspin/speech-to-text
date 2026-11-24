# 0069: Desktop-only Refresh icon

Date: 2026-11-24
Status: Accepted; amends the always-visible Refresh alternative in ADR 0068

The user requested the Refresh icon only on desktop, with pull-to-refresh on
other devices. Use CSS media features: minimum width 1024px, hover support and a
fine primary pointer. A large touch tablet still uses the gesture; a desktop
window narrower than the breakpoint also hides the icon. No user-agent detection.

Hide the button from layout and accessibility navigation together. Remove its
footer grid column, keep five app icons on a phone row, and retain the tablet
Split view action. Keep the sync live-region outside the hidden button so state
announcements remain available. Existing pull-to-refresh, automatic sync, retry
controls and conflict handling are unchanged.

Browser regressions cover resizing across the breakpoint, fine versus touch
input, footer column counts and shared refresh using either supported action.
Physical Safari gesture verification remains a manual check from ADR 0068.
