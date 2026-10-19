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
- Meal/task cards have light borders and subtle shadows. Strong day headings,
  a tinted card and a labelled Today badge establish hierarchy without relying
  only on colour. Task cards use a consistent compact gap.
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
