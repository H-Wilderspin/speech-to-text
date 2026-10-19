# MVP manual acceptance

Current scope: live captions, shared meals/tasks and shopping. Record device model, OS version,
browser version and Safari tab/Home Screen mode for each physical run. Automated
recognition fixtures are not physical acceptance evidence.

Check the Forma 36 blue/green/grey styling on a phone and tablet: headings and
Today should be distinct, shopping icons align with the item text, and quick-add
tiles retain readable Added states. Test large text and light-blue keyboard focus
without horizontal overflow; all action icons should still have 48px targets.

In Settings, check that text size and speech language occupy separate full-width
rows at 600px and narrower, with text size first. Wider screens keep them side by
side. Confirm the size buttons, preview and language dropdown remain usable.

With remembered GitHub access, tap Disconnect GitHub. Confirm that access stays
connected until explicitly choosing Disconnect in the confirmation. Keep connected
is focused first; it and Escape cancel and return focus to the original button.
Check on a narrow phone screen and with a keyboard/screen reader. Confirming
removes remembered access and focuses the token entry; saved plans remain intact.

## Sunday task reset

- With a test data repository, tick recurring and one-off tasks before Sunday.
  On Sunday, open/return to Task planner: ticks clear and all tasks remain.
  Keep an editor draft open across the boundary and confirm it survives.
- Tick a task after the reset, refresh and reopen from another device: it stays
  checked. Check next week's recurring tasks are still unchecked. Reopen a week
  whose Sunday was missed and confirm its reset catches up exactly once.
- Fail a reset save, confirm the list remains visible with an error, then
  reconnect and Refresh. Anonymous reading should show the reset without writes.
  Update older app clients before reading newly reset version 2 files.

## Shopping list

- Open the cart icon and verify all 24 supplied regular items appear as muted
  buttons. Add custom items and quick-add several regular items. Selected tiles
  show Added; tap again to remove (including bought items), then tap to re-add.
  Check Enter/Space toggles, focus stays on the tile, and changes save on close.
  Edit quantities in item text; different quantity names remain separate.
- Tick/untick bought items and delete directly with the bin. Drag row text/background to reorder
  using a mouse and actual iPad touch. For quick adds on a long list, confirm
  the catalogue stays under your finger and its buttons do not reflow when Added
  appears. Keyboard Space should tick without moving focus to the edit button.
  The top of the list should stay still as pending/saved status changes. Drag
  near the pane edge to scroll a long
  list, then drop at the first/last position. Check that scrolling stops at the
  list ends and doesn't continue into Regular items. Drag outside and cancel a
  gesture: neither should save. On touch screens, hold a row briefly then drag;
  an immediate swipe should scroll. Release before pickup, cancel a held drag,
  and use a second finger: no delayed move or stuck busy state should remain.
  Check that checkbox/edit/delete taps keep their actions and never start dragging.
- Confirm only edit and delete icons remain on each row. With a keyboard, focus
  the item text; Space picks it up, arrows/Home/End position the item,
  Enter drops and Escape cancels without closing the planner. Check announcements,
  focus after saving/deleting, and arrow boundaries. Confirm saved order and edits
  on another device after Refresh or the next poll. Try simultaneous editing,
  deleting and moving from two devices.
- Make several fast changes and confirm they appear immediately, with a pending
  message and one GitHub update after 30 seconds. Close before the timer using
  Back, Close, Escape, the cart icon or outside click; each must save before closing.
  Switching planners and manual Refresh also flush pending changes. No-change
  and edit-then-undo batches should not create commits.
- Test failed/offline saves: keep the local list and draft; reconnect and retry.
  Failed close attempts must leave the pane open. Polling/focus must not replace
  pending edits. Make a conflicting change on another device; review the shared
  list and test both Keep my changes and Use shared list. Try page/app exit with
  unsaved edits: where supported, the browser warns. Mobile forced shutdown is
  not a guaranteed save; close the pane first and verify GitHub before quitting.
  Switch among meals, tasks and shopping with drafts and listening active. Confirm
  only one planner appears and all drafts survive. Save while listening: caption
  Stop stays usable but planner switching/closing waits for the save.
- Check full, horizontal and supported vertical splits, scrolling, keyboard focus
  and VoiceOver labels on an actual iPad/phone. At 320px the toolbar wraps with
  Listen on its own row; all icon targets remain reachable. Physical checks pending.

## Update app

- On an Apple tablet, record iPadOS/browser version and test both Safari and the
  installed Home Screen app. Open a deployed release, then publish a newer one.
  In Settings tap Update app; verify the new UI appears without clearing browser
  data, remembered GitHub access and reading preferences remain, and the shell
  subsequently reopens offline. Current captions clear on reload.
- Keep another app tab open; updating must not force that tab to reload. Check
  that Update app is disabled while listening, while a planner is open and
  during GitHub connection. Stop/close first and retry.
- Try offline and interrupted downloads. Show an error and let the user retry
  without losing the working app. Test a second press when already up to date.
- For older versions, open online to download the release, then close all its
  tabs/windows and reopen to activate the button. Physical checks remain pending.

## Meal planner

- Add a meal with Apply to set to Every Monday breakfast (or another slot).
  Confirm Weekly default appears in other weeks and on a second reading device.
  Override one date, skip another and restore it with Use weekly default. Change
  and remove the weekly default: dated overrides and skipped dates must survive.
  Try competing default edits and a failed save; keep the unsaved draft.
- Open the cutlery icon on a tablet/phone. Check Monday–Sunday, three slots per
  day, today's marker, week arrows, scrolling and legible meal text.
- Connect a repository-restricted owner token via Settings → Planner editing. Add/change/
  remove a meal. Read it from a second device with no GitHub login; use Refresh
  if needed. Do not use real credentials in screenshots or test logs.
- Edit the same meal on two devices: the second save must report a conflict,
  keep the typed draft and allow reviewing the first change. Different meals
  should merge. With Remember unchecked, reload and confirm editing is disabled.
- Connect with Remember checked, reload and close/reopen the browser/app: editing
  should remain available. Repeat on each target phone/tablet and installed-app
  mode. Disconnect, reload and confirm editing is disabled, including another
  open tab; reading preferences must remain. Revoke a test token and confirm the
  error explains reconnection. Record the actual devices tested.
- Verify the token entry, Remember and Disconnect controls appear only in
  Settings, and that the planner remains focused on meals. While connecting,
  Settings should remain open until the request finishes or reports an error.
- During Listen, open and close meals, then Clear captions: listening continues
  and the meal plan is retained. Test offline/save failure without losing drafts.
- Use the vertical/horizontal split icons while speaking: both panes remain
  readable, captions continue updating and Listen/Stop/Clear remain usable. Check
  both orientations at widths of 768px and above; below 768px the vertical button
  must be disabled. Resize/rotate with a vertical split and a draft: panes stack
  below the cutoff and return when widened without losing the week or draft.
  Check active-button state, independent scrolling,
  large caption text and the on-screen keyboard. Toggle with an unsaved meal and
  a different week selected: both must survive. Press the active icon to return
  to the full planner. Split modes show Close (×), full mode shows Back; both hide
  the plan and restore focus to its toolbar icon without stopping captions. Escape works
  while focused inside it. Open/close Settings without losing the combined view.
- With a keyboard, save/cancel a meal and confirm focus returns to its slot.
  Keep a draft open during an automatic refresh; its text must remain unchanged.
  Leave the planner open across Monday and check This week selects the new week.

## Tasks and planner switching

- In each split direction, tap the active cutlery/list icon to close its pane:
  captions expand, listening continues, focus stays on the icon and it reports
  collapsed. Tap again to reopen with the same split. Tapping the other icon
  switches planners. Both icons remain disabled during saves.

- Open the checklist beside cutlery, add a shopping trip, other daily tasks and a weekly task,
  and confirm next week's occurrence starts unchecked. Tick/untick on one device
  and check another reflects it after refresh. Test remembered editor access.
- Edit one date, skip/restore, remove a recurrence and confirm dated exceptions
  survive. Disconnect and verify reading still works but writing/ticking is disabled.
- While listening in either split, switch meal/task icons with drafts in both:
  exactly one planner is visible, drafts survive and captions keep updating.
  Stop/Clear must work during a delayed save; planner switching must be disabled.
- Check phone keyboard, tablet/phone layouts, 48px icon targets, screen-reader
  checkbox labels, enlarged text and focus after save/remove. Simulate offline
  save and concurrent edits: show errors and retain drafts/confirmed tick state.

## Captions

1. Close all previous app tabs, reopen the deployed HTTPS URL. Live is the only
   transcript; Settings has text size/language and no People or model controls.
2. Listen, allow the microphone, speak a sentence. Revise/extend it: one line
   composes without cumulative duplicates. Pause, then speak another sentence;
   verify sentence openings/endings and display casing.
3. Clear during listening, then speak again after Reconnecting. Only new-session
   text appears. Repeat with command clear; command stop and Stop release capture.
4. Speak enough to scroll. New text follows the bottom; reading earlier text
   preserves scroll. Returning to the bottom resumes following; Clear resets it.
5. Settings: change size, check preview, preserve captions/listening, disable
   language while active, close with return/outside click/Escape as applicable.
   Stop, change language, reload and verify size/language remain.
6. Check green Listening, amber startup/restart, neutral Stopping and no indicator
   after Stop. Enable reduced motion: the green dot should remain steady.
7. Leave Listen untouched longer than Auto-Lock. Check screen remains awake when
   Settings reports Keeping screen awake. Stop and verify normal sleep resumes.
   Switch apps/lock manually: capture must stop, and returning must not restart it.
8. Deny microphone access and disconnect the network: keep the UI usable and show
   actionable errors. Offline shell does not imply offline speech recognition.
9. Test enlarged browser text, portrait/landscape and keyboard/screen reader focus.
   No horizontal overflow, clipped controls or repeated status announcements.
10. On an upgrade test device, verify old model caches/voiceprint DB are removed
    after old tabs close, while reading preferences and sibling-site data survive.

Physical target-user wake-lock and accessibility acceptance remain pending unless
explicitly recorded in feasibility notes. Do not silently mark these as passed.
