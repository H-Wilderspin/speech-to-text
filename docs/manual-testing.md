# Physical-device acceptance

Record device model, OS/browser version, Safari tab or installed-app mode, date
and result. Use disposable data/devices for writes. Never capture credentials
or personal speech in evidence. Automated fixtures do not prove physical speech,
keyboard, sleep, gesture or VoiceOver behaviour.

## Captions, editing and screen awake

- Test microphone permission allowed/denied, interim/final updates, pause lines,
  cumulative duplicates, late corrections and actionable errors.
- Clear while listening; speak after Reconnecting. Repeat with command clear.
  Stop/command stop release capture; old-session text must not return.
- Read earlier captions while speech arrives; retain scroll until returning to
  the bottom. Check text size/language persistence and reduced-motion indication.
- While listening, open Add item, edit an item/meal, restore a draft and focus
  pairing/token entry. Capture stops before typing; confirmed captions stay.
  Save/Cancel leaves Listen off. Browsing alone preserves listening. Repeat with
  keyboard focus and while microphone permission is pending.
- If speech enters an editor, record keyboard dictation/Voice Control settings.
  This app cannot stop independent OS dictation.
- With another app holding the microphone, test the recovery message, stop that
  capture and retry Listen. Automatic takeover is not promised.
- Stay visible longer than Auto-Lock while Settings reports Keeping screen awake:
  test idle, listening, after Stop, meals and editing. Switch apps/lock manually:
  capture stops; returning requests a lock without restarting the mic. Repeat
  with power-saving settings.

## Navigation, layout and accessibility

- Check 320/390px phones, tablet rotation, large text and software keyboards:
  reachable footer targets, no horizontal overflow or clipped controls.
- At 768px+, split Meals, Shopping and Settings: captions left, independent scroll.
  Resize below/above 768px and retain week/drafts/preference. Narrow Settings
  panes stack caption size above language.
- Footer icons switch screens; the active icon and Speech to text return to
  captions. No modal Back/Close/outside dismissal. Restore focus/reading position.
  Pending network saves must not block navigation; active dragging can.
- Meal title/date stack between arrows; headings stick below the header.
  Text starts at the top; Weekly default tags sit at the bottom. Shopping Add
  item stays at the panel bottom and hides during editing.
- Test keyboard/VoiceOver labels, focus, reorder announcements and conflicts.
  Review all three themes with the user. Check small text, forced colours,
  and remembered choices after reopening.
  The footer divider should appear only when both Listening and saving status show.

## Touch gestures and refresh

- Swipe Meals left/right in full/split views and while scrolled: change one week,
  retain drafts on return, and do not open the swiped card's editor.
- Editor, vertical/diagonal/short/cancelled gestures and pinch do not change weeks.
  Test Safari edge gestures in tab and installed modes.
- At a planner's top, pull down from its header and release when prompted.
  Refresh both apps/defaults/catalogue without reloading or losing drafts/captions.
  Short/reversed/cancelled pulls do nothing; below the top, scrolling works.
- Refresh icon appears only at 1024px+ with a hover-capable fine pointer; touch
  layouts have no hidden focus stop/empty column. Unchanged data does not jump or
  write. Repeat offline with queued edits.

## Meals and shopping

- Pair a test device, reload/reopen and confirm editing remains. Read on a second
  unconnected device. Do not capture credentials in test evidence.
- Add/change/remove a meal. Set a default, override a date, skip another, restore
  inheritance and remove the default. Dated exceptions survive.
- Add/edit/tick/delete shopping items and toggle regular items, including bought
  ones. Preserve checkbox/tile focus and catalogue position.
- Undo a deletion before and after syncing. Restore bought state and placement
  without replacing a newer family row. Check Undo at large text sizes.
- Reorder by mouse, touch hold and keyboard Space/Enter/arrows/Home/End. Edge-drag
  a long list. Escape/outside drop/cancel/second finger leaves no stuck move.
  Immediate swipes scroll; embedded controls do not start dragging.
- Switch screens with drafts/slow saves. Drafts survive navigation and reloads;
  completed actions appear immediately. Hidden panes stop polling.
- Reopen with an unfinished meal in another week: restore its week, scope and
  text without submitting it. Verify Save/Cancel clears the recovered draft.
- Check saving status beside Listening on phones and split layouts, including
  offline edits, a family conflict and a draft that cannot be stored locally.

## Sync, conflicts and access

- Rapid changes save after about two idle seconds, at most ten seconds during
  continuous edits. Navigation can start earlier saves; clean/net-zero batches
  do not commit.
- On two devices, change independent meals/items/fields, then the same field.
  Independent changes merge; Yours/Family resolves only the affected key.
  Test delete/edit, competing order and add-then-move before saving.
- Hold an old save response, edit again, then release it: keep the newer edit.
  Test two tabs and an unapplied draft during refresh.
- Offline after loading, complete edits and reload: restore them. Reconnect and
  merge family changes. Block IndexedDB too: preserve memory, warn before exit,
  allow Settings/navigation and block Update app until remote saves succeed.
- Pause/resume the service and revoke a test device. Pauses keep connection/edits;
  invalid access offers pairing. Test expired/reused codes and replacement without
  dropping pending edits. Revoke test devices afterwards.
- Legacy builds: replacement validates before swapping. Invalid replacement keeps
  old access; blocked credential storage reports accurately. Disconnect initially
  focuses Keep connected; cancellation leaves access intact.

## Updates and offline shell

- On an older release, stop Listen and use Settings ? Update app. New assets
  appear; access/preferences, planner drafts and durable edits remain. Captions
  clear. Other tabs are not forced to reload.
- Block updates while listening/connecting or when edits are neither durable nor
  saved remotely. Update directly from Settings with a hidden planner.
- Test offline/interrupted update and repeat when up to date: retain a usable
  shell. Reopen offline; cached UI does not imply offline speech.
- On a prototype-upgrade device, obsolete model caches/voiceprint storage are
  removed, retaining sibling-site data/preferences. Retired task files are not
  fetched, modified or deleted.
