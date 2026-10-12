# Manual validation and acceptance gates

## Speaker activity and empty Who said what retest

1. Close every app copy and reopen the published site with a saved English profile.
   In Settings its eye button should be on. Speak a few distinct full sentences,
   pausing between them. Check for delayed upper text while Listen is still active,
   a single updating sentence below, and retained opening words after pauses.
2. Toggle the matching person's eye off while listening. Their existing and new
   assigned speech should disappear above, while lower text and capture continue.
   Toggle on to restore retained upper text. Reload and verify the choice persists.
   Include another speaker when available to ensure only the selected person hides.
3. If the upper pane stays empty during listening and after Stop, open Settings
   and report the short matching status verbatim. It distinguishes no local words,
   no voice match, and a matched voice with no matching phrase. Do not send private
   audio or transcript content. Also note Android/Chrome versions if available.
4. Check spoken and button Stop release the microphone. Test the three pill buttons
   with enlarged text/TalkBack or VoiceOver; delete must still require confirmation.

The current report is empty after Stop with no message. Desktop/generated tests
cannot confirm the complete cause or resolution on the physical Pixel 8.

## Current retest: transcription first, delayed estimates

The user reports the larger local ASR is still inaccurate. Close all copies and
reopen the published site. Listen now uses browser recognition immediately, with
the existing pause/repetition fixes. First check ordinary words, proper nouns,
pauses and spoken/button Stop. Saved voiceprints now prepare names automatically
(cached models are reused); no checkbox or separate preparation action is needed. Return to
captions and repeat. Browser wording must stay intact below while name/colour estimates
arrive above later, possibly after a pause or Stop. Short, repeated, mismatched or
uncertain phrases remain only in the lower live pane. Check that both microphone clients stop,
and report any capture conflict or local-processing message. With a consenting
second person, compare turn-taking/name errors separately from word errors. Do not
upload private speech or voiceprints. Browser-provider processing is disclosed;
this mode no longer promises offline transcription. Record phone versions and
approximate name delay if available. Earlier local-only steps below are historical.

### Current Settings checks

1. Open Settings at phone size and with enlarged text. It should fill the screen,
   scroll vertically, and keep a return icon beside the title. Return/Escape goes
   straight to captions and restores focus to Settings without clearing text.
2. Text controls, People & colours and Add a speaker are on the same page. Each
   profile has exactly three pill buttons (activity, colour and delete). Change its colour, reload and confirm it
   persists. Tap delete then Cancel: the profile must remain. Only confirming
   deletion removes it. Check with TalkBack/VoiceOver when a device is available.
3. With an existing English voiceprint, reopen the app and Listen. Names should
   arrive only above; lower text stays grey and label-free. Unknown words must
   remain below only. Test cold preparation finishing while already listening,
   and Stop before preparation finishes: no late microphone may start after Stop.
4. Open/close Settings during preparation and live listening. Captions must remain
   intact. With no profiles, page load/Listen must fetch no name-model assets.
   With cached profiles/models, no repeat model download should be necessary.
   Record errors and phone/browser versions; do not equate a displayed name with
   correct identity without checking who actually spoke.

On 2026-10-10 the user reported that speech appears and Stop releases the microphone on their physical Pixel 8 using the deployed HTTPS app. This is a basic user-reported Listen/Stop pass, not completion of the full device matrix. Android/browser versions and tab/installed mode were not supplied. Desktop WebKit with an iPhone viewport is not iOS Safari.

The user also reported successful Pixel 8 speaker-profile saving, persistence after reload and deletion. Three same-person comparison scores were all approximately 0.8; only the latest processing time was reported, approximately 0.9 seconds. Another person is unavailable, so different-person scores remain pending. Model load times, cancellation/interruption behaviour and deletion persistence after another reload have not been reported. These initial comparisons do not establish accuracy or a threshold.

After the listening update, the user reported that “command stop worked and the text only writes once”. Record spoken stop and the repetition fix as basic user-reported Pixel 8 passes. The reply did not explicitly confirm continuation after the requested 15-second pause or separately describe the microphone indicator. The user also observed Unknown despite saved/tested profiles: live matching is not implemented, so that label is expected and is not a failed voice comparison.

## Required device matrix

| Configuration | Device / OS / browser version | Result |
|---|---|---|
| iPhone Safari tab over HTTPS | iPhone model and iOS version to confirm | Pending — user reports iPhone unavailable |
| iPhone installed PWA | Same iPhone; model/version to confirm | Pending — device unavailable |
| Android Chrome tab over HTTPS (target) | Pixel 8; actual browser/version and tab/installed mode to confirm | Basic Listen/Stop, spoken stop, repetition fix and profile save/reload/delete passed by user report; remaining checks pending |
| Android installed PWA | Pixel 8; Android/Chrome versions to confirm | Pending |

Targets supplied by the user on 2026-10-10. On Pixel 8, find Android version in Settings → About phone → Android version; Chrome version in Chrome Settings → About Chrome. On iPhone, find model and iOS version in Settings → General → About when that device becomes available.

Use a consented speaker and non-identifying phrases. Record only aggregate observations, not identifiable transcript text or audio. The verified live test address is `https://h-wilderspin.github.io/speech-to-text/`.

On 2026-10-10 the user reported that the LAN benchmark URL could not open on the phone. The cause is undiagnosed; this is not an inference failure or a device test pass. Use the deployed HTTPS app for M1 tests. The research benchmark is currently excluded from that deployment, so its previous development URL is not a Pages test link.

## M1 workflow

2026-10-11 Android follow-up: the continuous-mode retest failed with repeated-line
spam. With the Android compatibility update, close every app copy and reopen.
Speak a whole sentence, pause, then speak a second sentence. Each current phrase
should update in place, including word corrections; it becomes confirmed when
the provider completes it. Also say "very very good" and intentionally repeat a
sentence after a completed phrase: those repetitions should remain. Say "command
stop" and pause briefly for provider completion, then verify microphone release.
Check button Stop separately. Record any missing previous sentence or ongoing
repeat spam; do not report the repetition or pause gate passed until retested.

2026-10-11 pause regression retest: close all copies of the deployed app and reopen
to activate the update. Say a short sentence, pause for 2, 5 and 15 seconds in
separate trials, then say a complete second sentence. Check its opening words
remain. Include two sentences with the same opening to detect over-deduplication.
Finish with "command stop" and verify microphone release. The user confirmed the
previous word loss occurs after pauses; this new continuous-mode fix has not yet
passed a physical Pixel 8 retest. Speaker identification remains unavailable.

1. Open fresh site data. Confirm the normal page has only Listen, Clear and Settings above the transcript. Listen is available without enrolment or accounts. Open Settings and verify the browser-provider processing disclosure is available without requesting microphone access. Opening the page alone must not activate the microphone.
2. Tap Listen. Grant permission; speak at least 10 short phrases including corrections/repetitions. Observe interim replacements, stable confirmed text, and no duplicated phrase when a result finalises. Pause for at least 15 seconds, then speak without tapping Listen: Stop should remain available and captions should resume. Check “very very good” and deliberately repeating a phrase after a pause are preserved. Measure approximate first-word latency for each phrase; record median/range without promising a one-second result.
3. Tap Stop while speaking. Verify the browser/OS microphone indicator ends and no new capture continues. Repeat Listen/Stop 10 times, including cancelling a pending permission prompt. Confirm existing final text remains readable.
4. Deny permission, then allow it in site settings and retry. Test disabled device speech service, microphone unavailable, silence, network loss and recovery. Messages should give a useful next action. Offline opening must not be described as guaranteed offline transcription.
5. Listen, background the app, lock/unlock the phone, receive an incoming call where practical, and return. Confirm capture ends and requires another Listen gesture. Unconfirmed text may be discarded; confirmed text stays while the page remains alive. Reload or OS eviction intentionally loses in-memory text.
6. Run for 15 minutes, including pauses and multiple voices. All voices remain anonymous in M1. Read old text while new text arrives: scroll position should be preserved; Scroll back to the bottom to resume following new speech. The app retains the newest 100,000 characters, removing older text without stopping capture. Record capture gaps or permission prompts between native recognition cycles as device limitations.
7. Clear while stopped and reload. Check no transcript survives and no recordings or localStorage profiles have been created by the app. Anonymous listening alone does not open IndexedDB; opening Speakers opens its local profile store. Browser-provider audio handling is outside app storage controls.

8. While listening, say “command stop”. Confirm listening ends, the microphone indicator turns off, preceding speech remains and the command is omitted. Repeat with a pause between “command” and “stop”. Say “stop” alone and “command stopping” to check that neither ends listening. Check both the button and spoken command after an automatic restart. Commands act only when confirmed by the provider; record any recognition failure or delay.

## Experimental live name suggestions (2026-10-11; physical retest pending)

**Upgrade retest:** the original small recognizer failed user-reported clear,
one-at-a-time speech. The replacement requires one explicit ~190 MB model upgrade
(up to 205 MB for a fresh setup), reusing saved voiceprints and shared files. Test
word correctness separately from name correctness. Confirm ordinary sentence case,
opening words both immediately after Listen and after pauses, and no overload/error.
The heavier model's phone memory, latency and battery are not yet measured.

1. Close all app tabs and reopen the published site. Save a consented voiceprint or keep an existing compatible one. In Settings, choose **Prepare name suggestions**. Confirm the model-size/local-processing disclosure; no microphone should open during preparation. Only missing public model files should download. Return to captions.
2. Tap Listen, speak several different English sentences, pause 5–15 seconds, and continue. Check exact text once, retained opening words, **Name (estimate)** labels and corresponding text colour. Names can arrive several seconds after words; first/short/uncertain words may stay Unknown. Record model/device/browser, errors, approximate delay and whether processing keeps up. Do not treat an estimate as a confirmed identity.
3. Say “command stop”, pause and check that capture ends and the command disappears. Repeat with button Stop. Start a second session without downloading again. Test permission denial/cancellation, backgrounding, lock and returning. Errors should release capture; prepare cached models again after an interruption, or disable experimental names for browser captions.
4. Reload, including offline after installation: the remembered enabled mode should automatically load verified models without a new download. Captions must disappear; consented profiles should remain. Changing mode clears captions. Test missing/corrupt cache, explicit retry and Cancel. Browser cache eviction can require downloading missing files again.
5. Delete a profile in Speakers and retry listening. A stale/deleted profile must not be used. During local capture in one tab, delete its profile from a second tab; the active session should stop and discard temporary matching references. No raw audio, temporary live embedding or transcript should be in storage or network requests.
6. With another consenting person when available, test the enrolled person, unenrolled person, two enrolled voices, rapid turns and equal/unequal-volume overlap using different phrases from enrolment. Report wrong name and Unknown separately, without sending personal recordings/embeddings. Current generated-voice checks do not establish human accuracy. iPhone and these different-person checks remain pending.

## M2 enrolment (experimental)

1. Open Settings → Speakers while listening: live captions must stop before Record becomes enabled. Opening Speakers alone must not ask for microphone access or download the large voice model.
2. Enter a non-identifying test name and review the consent wording with the speaker. Prepare the voice model once (about 39 MB); measure cold/warm load time. Close/reopen Speakers and reload the app: Record should appear automatically after loading the saved model, with no Prepare action or model requests. Repeat offline after the app shell has installed. Check download failure, cache eviction/corruption and Cancel, then retry explicitly online; only missing/damaged assets should download. Record must still require both name and consent.
3. Record eight seconds of one consented person speaking naturally. Verify microphone release before local processing and a saved profile only after successful processing/storage. Measure recording-to-save time; record device model, OS/browser version, tab/PWA mode and sample count. Silence and strong clipping should request another recording; these checks are not speech detection.
4. Cancel during permission, recording and processing; close the dialog, background the app and lock the screen. Check the microphone indicator ends and no unfinished profile appears. If permission is granted after cancellation, capture must stop immediately. Reopen and verify the saved list.
5. Reload and check the saved name persists. Delete one profile, reload, and confirm removal. Create multiple profiles, use Delete all → Keep profiles, then Delete all → Confirm delete all and reload. No voiceprints should remain. Denied storage or full storage must give an error, never a false saved confirmation.
6. Confirm network activity contains only public application/model downloads; neither microphone audio nor embeddings may be uploaded by enrolment. Inspect local storage: only explicit schema/model/consent metadata and embeddings belong in the profile store. Do not export or commit those values. Transcripts and raw audio must not persist.
7. Reload a saved profile, open **Compare recordings**, select it and declare **The same person** or **A different person** before the new speaker consents. A cached model loads automatically; prepare comparison only if it is missing. Record a fresh eight-second passage that differs from enrolment. Verify that missing consent/reference/relationship prevents Record. A completed comparison shows similarity and processing time, never a confirmed match. Record the score, declared relationship, anonymous reference/participant IDs, model version, device, session and microphone conditions. Do not copy voiceprint values or personal audio.
8. Repeat for consented same/different people, near/far positions and quiet/noisy rooms across separate sessions. Follow the participant/session protocol in [feasibility](feasibility.md); the UI accepts at most 20 temporary comparisons before Clear. Do not interpret similarity as a percentage or choose a threshold from one successful test. Raw score distributions must precede a held-out false-match evaluation.
9. Cancel comparison during permission/recording/processing, use Back, background the app and reload. Check microphone release, disappearance of temporary results, and persistence of the original profile. Clear comparison results must not delete the reference profile. A reference deleted in another tab before its read must produce an error. Switching between enrolment and comparison should require preparing the selected mode and should never leave two microphones/workers running.
10. Captions must remain anonymous even with profiles and comparison results; Settings must explain that saved profiles do not identify live speech. This is intentional until held-out speaker matching and compatible timestamped ASR are evaluated. Phone performance, human similarity distributions and identity calibration remain unverified.

## Accessibility

- Test system text scaling, browser zoom to 200%, and the app's 28–56 px relative text controls. Confirm horizontal overflow does not hide controls at 320 CSS px.
- With VoiceOver and TalkBack, find Listen/Stop, current status, speech language, text size, transcript and Clear. Interim words should not continuously interrupt announcements. Confirm Settings explains that captions are anonymous and saved profiles do not label live speech.
- Navigate entirely by keyboard where available. Check visible focus, Skip to captions, dialog focus entry/trap, Escape/Back to settings from Speakers, focus restoration to Speakers inside Settings, then Escape/Back to captions restoring focus to Settings in the top bar.
- Check contrast in actual light/dark ambient conditions, reduced-motion mode, orientation changes, phone safe areas and large tap targets.

## Installation and static hosting

1. Confirm manifest and all PNG icons load from the deployed subdirectory. Install with Safari Share → Add to Home Screen / Chrome Install app. Check name, icon, launch URL, standalone display and safe-area layout.
2. Open online once, close/reopen, then go offline. The shell should open and explain the speech-service connection limit. Clear site storage while offline: fresh uncached opening is not expected to work.
3. Deploy a new build with changed visible text, with old app windows open. Confirm no active session is reloaded. Close all windows and reopen to activate the update. Ensure unrelated origin caches remain intact.
4. Reject/disable site storage and retry online: live captions should still work even if offline installation fails.

## Recording results

For every run record date, device model, OS/browser versions, tab/PWA mode, language, network condition, permission state, observations, latency sample count, and pass/fail for each step. Open a reproducible issue for any failure. M1's family-device gate, M2 enrolment and M3 attribution remain pending until the corresponding evidence exists.


## 2026-10-12 — Two-pane family interface

- On Pixel 8 and iPhone, reopen the app: three top controls, dark background and two equally sized caption panes.
- Speak with names disabled: every word appears in light grey below; the upper pane stays empty. Check pauses, deliberate repetition and command stop.
- In Settings, save a name and record eight seconds without a consent checkbox. Pick a colour in Speakers; change text size/language. Reload and verify all choices and older profiles survive.
- Prepare name suggestions in Settings, reusing cached files. With known and unknown voices, check only final assigned speech appears above, with the chosen name/text colour. Unknown speech stays below. Delayed labels must not change lower-pane words or paragraph breaks. This is experimental, not proof of identity.
- Scroll each pane independently; check enlarged text, focus, TalkBack/VoiceOver and no horizontal overflow. Verify Clear, profile deletion and microphone stop.
- Report actual devices/versions, recognition errors, mistaken names and observed delay separately from layout acceptance.
