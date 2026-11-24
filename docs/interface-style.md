# Interface conventions

The current app uses Poppins, light surfaces, dark body text and coral actions.
Shared tokens and layout rules live in `src/app/styles.css`.

## Visual rules

- Three text roles, shared 12px corners and at least 48px action targets.
- All uppercase labels use `--uppercase-spacing: .2em`.
- Actions/selection use `#db6931`, with `#fff1ed` and `#ffe0d6` fills.
  Green means listening/saved, red means Stop/error and orange means warning.
- **Known contrast issue:** the current accent is below 4.5:1 for small text on
  these fills. Preserve this as an open readability issue, not an accessibility
  pass. Measurements are in [verification](feasibility.md#known-limits).
- Keep visible keyboard focus, reduced-motion support and browser zoom.
  Hide scrollbar chrome without disabling native scrolling.

## Navigation and responsive layout

The global footer stays visible above device safe areas. App icons select Meals,
Shopping or Settings; the active icon or Speech to text returns to captions.
There are no modal Back/Close controls or outside-click dismissal.

Split view sits immediately left of Settings at 768px and wider: captions left,
selected app right, independently scrollable. Below 768px hide the toggle and
show the selected screen full width, retaining the session's split preference,
week and drafts. Settings follows the same rules; narrow panes stack caption
text size above speech language.

Refresh appears only at 1024px+ with a hover-capable fine primary pointer.
Touch users pull down from a planner header at the top. Both actions sync meals,
defaults, shopping and catalogue while retaining local edits. Horizontal meal
swipes change weeks; do not claim editor, pinch or vertical-scroll gestures.

## Meals and shopping

- Meal header: previous arrow, stacked title/date, next arrow. No shopping dates.
- Breakfast/Lunch/Dinner stay sticky below the meal header; on narrow cards each
  label sticks within its meal. Meal text starts at the top; Weekly default is
  centred in a full-width bottom strip, with rounded bottom corners, at .6875rem.
- Shopping Add item stays at the panel bottom, above navigation, and hides during
  editing. Rows have separate checkbox, text, edit and delete controls; no drag grip.
- Regular-item tiles reserve space for Added and keep focus/position when toggled.
  Avoid list jumps when save status changes. Announce saving and reordering
  accessibly; errors/conflicts remain visible beside the affected item.
- Opening or restoring an editor stops listening. Save/Cancel leaves it stopped.
  Browsing screens alone does not stop listening.

Check phone widths, split layouts, large text, software keyboards, scrolling and
focus after interaction. Use [manual testing](manual-testing.md) for physical
acceptance; desktop screenshots do not prove iPad/VoiceOver behaviour.
