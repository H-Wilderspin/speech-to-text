# MVP manual acceptance

Current scope: live captions and shared meals (ADRs 0046–0047). Record device model, OS version,
browser version and Safari tab/Home Screen mode for each physical run. Automated
recognition fixtures are not physical acceptance evidence.

## Meal planner

- Add a meal with Apply to set to Every Monday breakfast (or another slot).
  Confirm Weekly default appears in other weeks and on a second reading device.
  Override one date, skip another and restore it with Use weekly default. Change
  and remove the weekly default: dated overrides and skipped dates must survive.
  Try competing default edits and a failed save; keep the unsaved draft.
- Open the cutlery icon on a tablet/phone. Check Monday–Sunday, three slots per
  day, today's marker, week arrows, scrolling and legible meal text.
- Connect a repository-restricted owner token via Settings → Meal editing. Add/change/
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
- With a keyboard, save/cancel a meal and confirm focus returns to its slot.
  Keep a draft open during an automatic refresh; its text must remain unchanged.
  Leave the planner open across Monday and check This week selects the new week.

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
