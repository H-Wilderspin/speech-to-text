# Interface conventions

The app uses Poppins, light surfaces and dark body text. Settings offers earthy
greens (default), high-contrast coral and navy blue/grey, remembered per device.
Shared tokens and layout rules live in `src/app/styles.css`.

## Visual rules

- Three text roles, shared 12px corners and at least 48px action targets.
- All uppercase labels use `--uppercase-spacing: .2em`.
- Actions/selection use each theme's accent and pale fills.
  Green means listening/saved, red means Stop/error and orange means warning.
- Accent text must exceed 4.5:1 on the canvas, pale fill and hover fill in every
  theme. Contrast measurements alone are not a whole-app accessibility pass.
- Use plain backgrounds. Transcribed text has a 50% white box behind it;
  the text stays fully opaque.
- Keep visible keyboard focus, reduced-motion support and browser zoom.
  Hide scrollbar chrome without disabling native scrolling.

## Navigation and responsive layout

The global footer stays visible above device safe areas. App icons select Meals,
Shopping or Settings; the active icon or Speech to text returns to captions.
At normal zoom, the app follows visual-viewport height and offset changes to
keep controls within the visible area above the keyboard. Pinch zoom retains
the previous layout, allowing native magnification and panning.
There are no modal Back/Close controls or outside-click dismissal.
Saving status sits alongside Listening with a `|` divider when both are present,
wrapping on narrow screens. Distinguish
local drafts, locally saved changes awaiting sharing, conflicts and confirmed saves.

Split view sits immediately left of Settings at 768px and wider: captions left,
selected app right, independently scrollable. Below 768px hide the toggle and
show the selected screen full width, retaining the session's split preference,
week and drafts. Settings follows the same rules; narrow panes stack caption
text size above speech language.

Refresh is available in the footer on every screen and at every width. On phones
it sits beside Listen without adding a row. Touch users can also pull down from
a planner header at the top. Both actions sync meals,
defaults, shopping and catalogue while retaining local edits. Horizontal meal
swipes change weeks; do not claim editor, pinch or vertical-scroll gestures.

## Meals and shopping

- Meal header: previous arrow, stacked title/date, next arrow. No shopping dates.
- Breakfast/Lunch/Dinner stay sticky below the meal header; on narrow cards each
  label sticks within its meal. Meal text starts at the top; Weekly default is
  centred in a full-width bottom strip, with rounded bottom corners, at .6875rem.
- Shopping Add item stays at the panel bottom, above navigation, and hides during
  editing. Rows have separate checkbox, text, edit and delete controls; no drag grip.
- Go to this week uses the same bottom bar when viewing another week. Shopping
  Undo sits above Add item and remains until used, dismissed or the list is closed.
- Regular-item tiles reserve space for Added and keep focus/position when toggled.
  Avoid list jumps when save status changes. Announce saving and reordering
  accessibly; errors/conflicts remain visible beside the affected item.
- Opening or restoring an editor stops listening. Save/Cancel leaves it stopped.
  Browsing screens alone does not stop listening.

Check phone widths, split layouts, large text, software keyboards, scrolling and
focus after interaction. Use [manual testing](manual-testing.md) for physical
acceptance; desktop screenshots do not prove iPad/VoiceOver behaviour.
