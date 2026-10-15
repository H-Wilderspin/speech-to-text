# MVP manual acceptance

Current scope: live captions only (ADR 0046). Record device model, OS version,
browser version and Safari tab/Home Screen mode for each physical run. Automated
recognition fixtures are not physical acceptance evidence.

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
