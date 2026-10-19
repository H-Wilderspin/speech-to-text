# ADR 0059: Drag shopping items from their row

Date: 2026-10-19
Status: Accepted; extends ADR 0056

## Context

The user wants a larger drag target encompassing the shopping item. The existing
pointer capture, insertion target, edge scrolling and keyboard reorder code
already provides the required behaviour; no new component dependency is needed.
Applying touch-action:none to every row would prevent ordinary list scrolling.

## Decision

Mouse/pen dragging starts from row text or background, excluding embedded
controls. The text is no longer a checkbox label; the checkbox retains its
explicit accessible name and dedicated target. Keep the grip as a visual cue,
immediate pointer target and keyboard/assistive pickup/drop control.

Touching the row starts a 350ms hold. Movement exceeding 8px before pickup
cancels the hold and leaves native scrolling available. After pickup, native
non-passive touch listeners prevent scrolling and feed the existing drag session.
The row itself retains native touch actions so pinch and ordinary scrolling are
not disabled. A second touch cancels; release/cancel, visibility, blur, resize,
keyboard input, deactivation and unmount clean up pending holds. Active sessions
retain the existing cancellation, target validation and edge scroll behaviour.

Suspend polling/saving/navigation during pickup and movement. A successful drop
updates local state and uses the existing 30-second/close batch (ADR 0057).

## Validation and limits

Browser checks exercise text and background dragging, preserved embedded controls,
keyboard ordering, cancellation and batched saves in Chromium and mobile WebKit.
Chromium CDP native touches exercise hold-to-drag and immediate swipe scrolling.
Synthetic touch events exercise hold timing and cancellation in both engines.
Physical Safari/iPad touch and VoiceOver acceptance remain pending; desktop
WebKit mouse and synthetic events do not establish physical touch behaviour.
See feasibility.md for executed results.

## Follow-up: remove the grip icon (2026-10-19)

The user approved row dragging and requested removal of its separate grip icon.
The item text now serves as the native keyboard/assistive reorder button, styled
as text. Row pointer capture and focus target that button, and both text and
background use the same touch hold. Checkbox/edit/delete remain separate.
No extra icon, invisible focus stop or button wrapping other controls is needed.
