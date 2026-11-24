# Interface styling

The user requested brighter Contentful Forma 36 colours on 2026-10-19 after
trying the sage palette. Keep the familiar controls, targets and compact layout.
Values come from the official [Forma 36 colour system](https://f36.contentful.com/tokens/color-system),
checked on that date; no component package or runtime dependency is needed.

- Cool grey canvas (gray100), white cards, dark text (gray800) and secondary text
  (gray600). Blue600 primary actions and blue100 selected controls/Today make
  navigation clearer. Green600 Listen/Save and green100 Added tiles retain green
  for positive states. Red600 marks Stop/errors; orange600 marks warnings.
  The light focus glow remains blue300. Control outlines use gray500 for contrast.
- Add, Listen, Save and Stop buttons use a soft 100-to-200 shade gradient with
  dark coloured text/borders and a 200-shade hover fill. Keep text fully opaque;
  opacity remains reserved for disabled controls. This replaces solid dark fills
  at the user's request while leaving the rest of the palette unchanged.
- Shared colours, border radius and card shadow are CSS variables in
  src/app/styles.css. Buttons and fields share 12px corners and at least 48px
  height; icon actions keep their 48px square targets and consistent strokes.
- Shopping rows align checkboxes, readable names and the two action icons in
  fixed columns. Text wraps in its own column at narrow widths. Edit/delete
  icons have quieter surfaces, with visible hover/focus feedback.
  Keep Add item in a sticky footer inside the shopping panel, above the global
  navigation. Stretch short shopping content so the button still sits at the
  bottom. Hide the button while editing to avoid overlapping sticky controls.
- Meal cards have light borders and subtle shadows. Strong day headings,
  a tinted card and a labelled Today badge establish hierarchy without relying
  only on colour.
  Breakfast/Lunch/Dinner labels use the same green as Listen. Column headings stick beneath the title/date header;
  at narrow widths with stacked meals, each card's label sticks within its text
  instead. Measure the header height so wrapping and larger text do not overlap
  the labels. Keep meal text at the top and Weekly default in a full-width blue
  strip flush with the card's bottom inside its border, with spare vertical space
  between them. Centre the tag text and use the shared semibold, spaced uppercase
  label typography at a smaller .75rem size. Round the strip's bottom corners to match the card's inner edge;
  avoid overflow clipping on the card, which would interfere with sticky labels.
- Keep the global footer visible beneath every screen. App icons select the main
  content; the speech-bubble Speech to text icon explicitly returns to full captions.
  Highlight the active screen; tapping its app icon again also toggles it off. Full
  screens have no modal backdrop or Back/Close buttons. At 768px and wider, the
  footer's Split view toggle, immediately left of Settings, keeps captions left
  and the selected app right. Refresh shares the footer and checks both apps.
  Keep week arrows beside the Meal planner title, with dates stacked beneath the title inside the header.
- Regular shopping items use equal-width responsive tiles. Added items retain
  readable text, a green background and the existing Added label. Reserved label
  space and catalogue anchoring prevent movement while toggling items.
- No additional headings, decorative images, drag icons, status rows or animation.
  Save/reorder announcements and keyboard instructions remain available to screen
  readers. Reduced motion and forced-colour focus handling remain in place.

Colour-pair contrast measurements are recorded in feasibility.md. These are not
a full accessibility audit. Decorative card borders stay quieter than control outlines.

Check phone/tablet splits, larger text, Today, bought/Added states, keyboard focus
and drag/scroll behaviour when changing these rules. Physical iPad/VoiceOver
acceptance remains separate from desktop browser and screenshot checks.

Planner conflicts appear beside only the affected meal/item using the existing
notice colours and large action buttons. Show Yours and Family in plain text with
Keep mine / Use family change. The Refresh icon has a small saved/pending/conflict
indicator and a screen-reader status; never shift list rows for background progress.
Editing and navigation remain available during network saves (ADR 0066).

Settings shares the footer Split view toggle at widths of 768px and above, with
captions left and Settings right. Settings controls stack based on the pane's
width, including narrow tablet splits. Its active footer icon returns to full
captions, just like Meals/Shopping. Keep input state across layout changes and
phone-width fallback; preserve the split preference when returning to a wider view.

Hide visible scrollbars on Settings, planner and transcript panes while retaining
native scrolling with touch, mouse wheel and keyboard. Keep overflow-y: auto; do
not clip scrollable content to hide the scrollbar.

Planner pull-to-refresh shows a centred green status beneath the header only
during a downward touch pull at the top. Change the prompt at the release
threshold. Show footer Refresh only at 1024px and wider with a hover-capable fine
primary pointer. Phones and touch tablets use pull-to-refresh; remove the unused
footer column and retain sync announcements outside the hidden button. Use the
existing sync status/errors after release rather than reloading the page.
