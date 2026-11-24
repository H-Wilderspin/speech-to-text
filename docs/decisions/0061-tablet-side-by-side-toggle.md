# ADR 0061: One side-by-side toggle on tablet-sized screens

Date: 2026-11-24
Status: Accepted; supersedes [ADR 0051](0051-explicit-split-orientation.md) and [ADR 0054](0054-narrow-viewport-split-controls.md)

The Back/Close and modal navigation details below are superseded by
[ADR 0062](0062-global-footer-navigation.md). The split layout rules remain current.
Control placement is superseded by [ADR 0064](0064-footer-refresh-and-planner-header.md):
Split view now sits in the global footer immediately left of Settings.

## Context

The user requested removing the top/bottom split, retaining captions on the left
and the selected app on the right, controlled by one on/off toggle. They clarified
that availability means all tablet-sized or larger screens, including desktops,
rather than touch tablets only.

## Decision

Use one accessible Split view toggle in the right side of the planner header.
It is shown at viewport widths of 768 CSS pixels and above. On displays captions
on the left and meals or shopping on the right; off displays the full planner.
The selected state is exposed with aria-pressed. Remove the stacked mode, icon,
styling and orientation state.

Below 768px, hide the toggle and display the full planner. Keep the chosen split
preference in page state so widening restores it, without remounting the planner,
losing drafts or changing the caption session. Explicitly switching off replaces
that preference. The same setting applies when switching meals/shopping, lasts
until reload, and does not use device or user-agent detection.

Preserve independent pane scrolling, caption controls in split view, save/close
protections and focus handling. Close or the active app icon hides the right pane;
full planner retains Back. On narrow screens full planner is modal as before.

## Validation

Browser regressions cover the 767/768px boundary, phone/tablet/desktop widths,
caption-left geometry, one right-side toggle, no stacked control, explicit off,
draft/week preservation across resizing, meal/shopping switching, saving and app
updates. Typecheck, lint, all 148 unit tests and production build passed.
All 136 applicable browser cases passed across Chromium/mobile-WebKit runs;
two existing Chromium-only native-touch cases were skipped in WebKit.

The first WebKit run exposed a test assumption: its unsupported-speech notice
offsets the transcript within the left pane. The geometry assertion now compares
the pane itself with the planner, instead of assuming a small text offset. The
corrected test passed in both engines; the remaining WebKit suites also passed.

Local Chromium screenshots at 768px and 390px were inspected, with no uncaught
page errors. Physical device rotation, keyboards and assistive technology remain
manual checks. This change has not been deployed.
