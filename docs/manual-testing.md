# MVP manual acceptance

Current scope: live captions, shared meals and shopping. Record device model, OS version,
browser version and Safari tab/Home Screen mode for each physical run. Automated
recognition fixtures are not physical acceptance evidence.

Check the coral highlighting and actions on a phone and tablet: headings and
Today should be distinct, shopping icons align with the item text, and quick-add
tiles retain readable Added states. Test large text and coral keyboard focus
without horizontal overflow; all action icons should still have 48px targets.

In Settings, check that text size and speech language occupy separate full-width
rows at 600px and narrower, with text size first. Wider screens keep them side by
side. Confirm the size buttons, preview and language dropdown remain usable.

With remembered GitHub access, tap Disconnect GitHub. Confirm that access stays
connected until explicitly choosing Disconnect in the confirmation. Keep connected
is focused first; it and Escape cancel and return focus to the original button.
Check on a narrow phone screen and with a keyboard/screen reader. Confirming
removes remembered access and focuses the token entry; saved plans remain intact.

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
- Make several fast changes: they appear immediately and batch after about two
  seconds of inactivity, with a ten-second maximum window during continuous edits.
  Navigation starts an earlier background save without disabling editing. Refresh
  reads both planners. Clean and edit-then-undo batches should not create commits.
- Go offline after loading the list, edit/tick/delete/move, then reload. Completed
  changes must return. Reconnect and check family additions/independent fields merge.
  Edit the same text on two devices: Yours/Family appears beside that item, with
  Keep mine and Use family change. Other items must still save. Test deleting an
  item while someone has its editor open, plus competing ordering changes.
- Hold a slow save and edit again: the older response must not erase the newer
  edit. Switch to captions, Settings and meals while the save is pending. Caption
  Stop and navigation remain usable. Only active dragging temporarily blocks
  navigation. Test two tabs with pending edits and an unapplied editor draft.
- Block IndexedDB and network: retain memory state, show a device-storage warning,
  allow Settings navigation and block Update app until a network save succeeds.
  Where supported, page exit warns for memory-only edits. With working storage,
  pending edits survive normal reload; clearing site data can erase them.
- Check full view and the side-by-side split at 768px and wider, scrolling, keyboard focus
  and VoiceOver labels on an actual iPad/phone. At 320px all toolbar
  actions remain reachable with no horizontal overflow. Physical checks pending.

## Update app

- On an Apple tablet, record iPadOS/browser version and test both Safari and the
  installed Home Screen app. Open a deployed release, then publish a newer one.
  In Settings tap Update app; verify the new UI appears without clearing browser
  data, remembered GitHub access and reading preferences remain, and the shell
  subsequently reopens offline. Current captions clear on reload.
- Keep another app tab open; updating must not force that tab to reload. Check
  that Update app is disabled while listening and during GitHub connection.
  Open Settings directly from Meals or Shopping: no separate planner close is
  needed. Verify durable pending meal/shopping edits survive reload, including
  expired access. If device storage also fails, prevent the update until GitHub
  saves succeed. Pending changes must remain recoverable after token renewal.
- Try offline and interrupted downloads. Show an error and let the user retry
  without losing the working app. Test a second press when already up to date.
- For older versions, open online to download the release, then close all its
  tabs/windows and reopen to activate the button. Physical checks remain pending.

## Meal planner

- Scroll through long meals in full and split layouts: Breakfast/Lunch/Dinner
  stay beneath the title/date without overlapping it, including with larger text.
  On narrow stacked cards, each label sticks within its own meal text. Short
  meals start at the top of tall rows; Weekly default tags align to card bottoms.
- Add a meal with Apply to set to Every Monday breakfast (or another slot).
  Confirm Weekly default appears in other weeks and on a second reading device.
  Override one date, skip another and restore it with Use weekly default. Change
  and remove the weekly default: dated overrides and skipped dates must survive.
  Try competing default edits and a failed save; keep the local value and resolve
  only the affected default.
- Open the cutlery icon on a tablet/phone. Check Monday–Sunday, three slots per
  day, today's marker, week arrows, scrolling and legible meal text.
- Connect a repository-restricted owner token via Settings → Planner editing. Add/change/
  remove a meal. Read it from a second device with no GitHub login; use Refresh
  if needed. Do not use real credentials in screenshots or test logs.
- Edit the same meal on two devices: the second save must report a conflict,
  keep the applied local value and allow reviewing the first change. Different meals
  should merge. Successful connections should be remembered automatically.
- Connect, reload and close/reopen the browser/app: editing
  should remain available. Repeat on each target phone/tablet and installed-app
  mode. Disconnect, reload and confirm editing is disabled, including another
  open tab; reading preferences must remain. Revoke a test token and confirm the
  error explains reconnection. Record the actual devices tested.
- Verify the token entry, Change token and Disconnect controls appear only in
  Settings, and that the planner remains focused on meals. While connecting,
  Settings should remain open until the request finishes or reports an error.
- During Listen, open and close meals, then Clear captions: listening continues
  and the meal plan is retained. Test offline/save failure without losing drafts.
- At 768px and wider, use the footer Split view toggle immediately left of
  Settings: captions stay on the left and the selected app on the right. Test on
  tablet-sized screens and desktops. Toggle off for the full planner and on again;
  selected week, draft, focus and caption session must survive. No top/bottom
  button or layout should appear. Check both panes scroll independently and
  Listen/Stop/Clear remain reachable while split, including with large text.
- Resize from 768px to 767px with a draft: the toggle disappears and the selected
  app becomes full screen. Widen again: the preferred split returns with the draft
  and week intact. If explicitly switched off, it must stay off after resizing.
  Check real device rotation and the software keyboard separately.
- From Meals, Shopping and Settings, use the speech-bubble Speech to text icon.
  It selects full captions, highlights itself and preserves listening and existing
  text. Pending completed edits persist locally first; a failed network save must
  not keep the list open.
  Check all footer targets remain reachable at 320px and 390px.
- In full and split views, the active footer icon hides the app and restores focus
  without stopping captions. Other icons switch the main screen. No Back/Close
  buttons should appear; Escape and outside clicks must not dismiss screens.
  Open/toggle Settings without losing drafts or layout. Check the footer stays
  visible above the device safe area while content scrolls and with large text.
  Read earlier captions, switch screens, then return: reading position survives.
- With a keyboard, save/cancel a meal and confirm focus returns to its slot.
  Keep a draft open during an automatic refresh; its text must remain unchanged.
  Leave the planner open across Monday and check This week selects the new week.

## Planner switching

- Confirm the toolbar has Listen/Stop, Clear, meals, shopping and Settings, with
  no task planner. Settings access/disconnect text should mention meals and shopping.
- In split view, tap the active cutlery/cart icon to close its pane:
  captions expand, listening continues, focus returns to the icon and it reports
  collapsed. Reopen with the same split, then switch to the other pane.
- Keep drafts in meals and shopping while switching; exactly one pane is visible
  and both drafts survive. Stop/Clear remain usable during saves, while planner
  switching and closing wait for saving. Hidden panes must not poll.
- After updating an older installed app, check the task icon disappears and
  remembered editing access and reading preferences remain. Existing task files
  must not be requested, changed or deleted by the updated app.

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
   language while active, then toggle Settings off using its footer icon.
   Stop, change language, reload and verify size/language remain.
6. Check green Listening, amber startup/restart, neutral Stopping and no indicator
   after Stop. Enable reduced motion: the green dot should remain steady.
7. Without starting Listen, leave the app visible longer than Auto-Lock while
   Settings reports Keeping screen awake. Repeat while listening and after Stop,
   reading meals and editing shopping: the lock should remain while visible.
   Switch apps/lock manually: capture must stop and normal sleep must resume;
   returning requests a new screen lock but must not restart the microphone.
8. Deny microphone access and disconnect the network: keep the UI usable and show
   actionable errors. Offline shell does not imply offline speech recognition.
9. Test enlarged browser text, portrait/landscape and keyboard/screen reader focus.
   No horizontal overflow, clipped controls or repeated status announcements.
10. On an upgrade test device, verify old model caches/voiceprint DB are removed
    after old tabs close, while reading preferences and sibling-site data survive.

Physical target-user wake-lock and accessibility acceptance remain pending unless
explicitly recorded in feasibility notes. Do not silently mark these as passed.

## Editing and microphone contention (ADR 0073)

- While listening, open Add item, edit an existing shopping item and edit a meal.
  In full and split views, verify capture stops before typing, old confirmed
  captions remain and speaking does not insert text into the editor. Repeat with
  keyboard focus and while microphone permission is pending. Save/Cancel must
  leave Listen off. Tap Listen explicitly when finished.
- Return to an unsaved editor after restarting Listen elsewhere; verify it stops
  again before the restored field receives focus. Focus the pairing/token field
  in Settings and check the same protection. Simply browsing panels can keep
  listening active.
- With another app using the microphone, tap Listen. If the OS denies capture,
  verify the recovery message, stop microphone use in the other app, and retry
  Listen. No automatic priority/takeover can be promised by browser code.
- Record keyboard dictation settings as well as device/OS/browser: system
  dictation is separate from this app's speech-recognition session.

## Token replacement

- Verify there is no Remember checkbox. Connect once and reload; editing remains
  available. Block storage and confirm the session still works with an accurate
  notice that access could not be remembered.
- With a rejected/expired token, open Settings and enter a new one directly.
  No manual Disconnect or confirmation is required. Try an invalid replacement:
  the input and previous stored connection remain. Submit a valid replacement:
  it is saved and editing resumes, including after reload and in another tab.
- Expire access while shopping has pending changes. Settings must remain reachable;
  replacing the token and returning to Shopping saves the retained batch once.
  Network failures/rate limits should offer retry rather than token replacement.
- Change a working token while a meal draft is open. Return and save the same
  draft. Explicit Disconnect still confirms removal and affects other open tabs.

## Meal header and shared refresh

- On a phone and tablet, swipe left/right across the Meals header or a card to
  advance/return one week. Try full view, split view and a scrolled-down planner.
  Return to a week with a draft and verify its text is kept. Tapping a meal still
  opens its editor; swiping a card must not open it. Swiping inside the editor,
  vertical scrolling, short/diagonal gestures, pinch and cancelled gestures must
  not change weeks. Check pull-to-refresh separately. Test Safari both in a tab
  and installed mode, including swipes near screen edges.

- On a touch phone/tablet, scroll each planner to the top and pull down from its
  header. A short pull shows a prompt; a longer pull asks to release. Releasing
  syncs completed changes and fetches both planners/defaults/catalogue without
  reloading. Check full and split views; keep an editor draft and captions visible.
- Check short, sideways, reversed and interrupted pulls do not refresh. Starting
  below the top should scroll normally. Shopping row swipes/holds still scroll or
  reorder; input gestures and pinch zoom remain available. Repeat offline: edits
  stay queued and the existing sync feedback reports the failed connection.
- Physical Android Chrome and iOS Safari/PWA gesture behaviour remains a manual
  check; automated WebKit events do not establish native Safari overscroll behaviour.

- Check Previous week and Next week flank Meal planner, with the selected dates
  stacked beneath the title inside the header. Shopping has no week arrows or dates. Refresh and Split view
  belong to the footer; Split view is immediately left of Settings at 768px+.
  Refresh appears only at 1024px+ with a hover-capable fine primary pointer.
  Check phones and touch tablets (including landscape) have no Refresh icon,
  keyboard focus stop or empty footer column; use the pull gesture instead.
- Change meals/defaults and shopping/catalogue on another device. Use desktop
  footer Refresh or pull down in either app and verify both data sets update, including the hidden
  one. Repeat without changes: no list jump or draft loss, and no writes.
- Keep editors open while refreshing. Pending applied shopping changes must save
  before replacement reads; failures must retain them. Check 320px/390px phones,
  tablet split view, larger text and software keyboards with 48px icon targets.

## Settings split view

- At 768px and wider, open Settings from captions and toggle Split view. Captions
  remain on the left, Settings on the right, with independent scrolling and footer
  controls reachable. Text-size changes should update the visible captions.
- Type an unfinished token, toggle split off/on, resize to phone width then back:
  retain the input and split preference. Narrow Settings panes stack text size
  above language without horizontal overflow. Below 768px hide Split view.
- Open Settings from Shopping/Meals, then tap its active footer icon: show full
  captions, not the previous planner. Reopen the planner through its own icon and
  confirm its editor draft remains. Listening continues throughout. Existing
  connection/update guards still apply.
