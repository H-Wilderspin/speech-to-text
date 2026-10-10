# Manual validation and acceptance gates

On 2026-10-10 the user reported that speech appears and Stop releases the microphone on their physical Pixel 8 using the deployed HTTPS app. This is a basic user-reported Listen/Stop pass, not completion of the full device matrix. Android/browser versions and tab/installed mode were not supplied. Desktop WebKit with an iPhone viewport is not iOS Safari.

The user also reported successful Pixel 8 speaker-profile saving, persistence after reload and deletion. This is a basic enrolment/storage pass. Model load/processing times, similarity scores, cancellation/interruption behaviour and deletion persistence after another reload have not been reported.

## Required device matrix

| Configuration | Device / OS / browser version | Result |
|---|---|---|
| iPhone Safari tab over HTTPS | iPhone model and iOS version to confirm | Pending — user reports iPhone unavailable |
| iPhone installed PWA | Same iPhone; model/version to confirm | Pending — device unavailable |
| Android Chrome tab over HTTPS (target) | Pixel 8; actual browser/version and tab/installed mode to confirm | Basic Listen/Stop and profile save/reload/delete passed by user report; remaining checks pending |
| Android installed PWA | Pixel 8; Android/Chrome versions to confirm | Pending |

Targets supplied by the user on 2026-10-10. On Pixel 8, find Android version in Settings → About phone → Android version; Chrome version in Chrome Settings → About Chrome. On iPhone, find model and iOS version in Settings → General → About when that device becomes available.

Use a consented speaker and non-identifying phrases. Record only aggregate observations, not identifiable transcript text or audio. The verified live test address is `https://h-wilderspin.github.io/speech-to-text/`.

On 2026-10-10 the user reported that the LAN benchmark URL could not open on the phone. The cause is undiagnosed; this is not an inference failure or a device test pass. Use the deployed HTTPS app for M1 tests. The research benchmark is currently excluded from that deployment, so its previous development URL is not a Pages test link.

## M1 workflow

1. Open fresh site data. Confirm Listen is available without enrolment or accounts and the processing disclosure is visible before microphone access. Opening the page alone must not activate the microphone.
2. Tap Listen. Grant permission; speak at least 10 short phrases including corrections/repetitions. Observe interim replacements, stable confirmed text, and no duplicated phrase when a result finalises. Measure approximate first-word latency for each phrase; record median/range without promising a one-second result.
3. Tap Stop while speaking. Verify the browser/OS microphone indicator ends and no new capture continues. Repeat Listen/Stop 10 times, including cancelling a pending permission prompt. Confirm existing final text remains readable.
4. Deny permission, then allow it in site settings and retry. Test disabled device speech service, microphone unavailable, silence, network loss and recovery. Messages should give a useful next action. Offline opening must not be described as guaranteed offline transcription.
5. Listen, background the app, lock/unlock the phone, receive an incoming call where practical, and return. Confirm capture ends and requires another Listen gesture. Unconfirmed text may be discarded; confirmed text stays while the page remains alive. Reload or OS eviction intentionally loses in-memory text.
6. Run for 15 minutes, including pauses and multiple voices. All voices remain Unknown in M1. Read old text while new text arrives: scroll position should be preserved; Newest speech should return to the end. The app bounds a session at 100,000 characters and requests Clear before continuing.
7. Clear while stopped and reload. Check no transcript survives and no recordings or localStorage profiles have been created by the app. Anonymous listening alone does not open IndexedDB; opening Speakers opens its local profile store. Browser-provider audio handling is outside app storage controls.

## M2 enrolment (experimental)

1. Open Speakers while listening: live captions must stop before Record becomes enabled. Opening Speakers alone must not ask for microphone access or download the large voice model.
2. Enter a non-identifying test name and review the consent wording with the speaker. Prepare the voice model (about 39 MB); measure cold/warm load time. Check download failure and Cancel, then retry. Record must require both name and consent.
3. Record eight seconds of one consented person speaking naturally. Verify microphone release before local processing and a saved profile only after successful processing/storage. Measure recording-to-save time; record device model, OS/browser version, tab/PWA mode and sample count. Silence and strong clipping should request another recording; these checks are not speech detection.
4. Cancel during permission, recording and processing; close the dialog, background the app and lock the screen. Check the microphone indicator ends and no unfinished profile appears. If permission is granted after cancellation, capture must stop immediately. Reopen and verify the saved list.
5. Reload and check the saved name persists. Delete one profile, reload, and confirm removal. Create multiple profiles, use Delete all → Keep profiles, then Delete all → Confirm delete all and reload. No voiceprints should remain. Denied storage or full storage must give an error, never a false saved confirmation.
6. Confirm network activity contains only public application/model downloads; neither microphone audio nor embeddings may be uploaded by enrolment. Inspect local storage: only explicit schema/model/consent metadata and embeddings belong in the profile store. Do not export or commit those values. Transcripts and raw audio must not persist.
7. Reload a saved profile, open **Compare recordings**, select it and declare **The same person** or **A different person** before the new speaker consents. Prepare comparison, then record a fresh eight-second passage that differs from enrolment. Verify that missing consent/reference/relationship prevents Record. A completed comparison shows similarity and processing time, never a confirmed match. Record the score, declared relationship, anonymous reference/participant IDs, model version, device, session and microphone conditions. Do not copy voiceprint values or personal audio.
8. Repeat for consented same/different people, near/far positions and quiet/noisy rooms across separate sessions. Follow the participant/session protocol in [feasibility](feasibility.md); the UI accepts at most 20 temporary comparisons before Clear. Do not interpret similarity as a percentage or choose a threshold from one successful test. Raw score distributions must precede a held-out false-match evaluation.
9. Cancel comparison during permission/recording/processing, use Back, background the app and reload. Check microphone release, disappearance of temporary results, and persistence of the original profile. Clear comparison results must not delete the reference profile. A reference deleted in another tab before its read must produce an error. Switching between enrolment and comparison should require preparing the selected mode and should never leave two microphones/workers running.
10. Captions must continue showing Unknown even with profiles and comparison results. This is intentional until held-out speaker matching and compatible timestamped ASR are evaluated. Phone performance, human similarity distributions and identity calibration remain unverified.

## Accessibility

- Test system text scaling, browser zoom to 200%, and the app's 28–56 px relative text controls. Confirm horizontal overflow does not hide controls at 320 CSS px.
- With VoiceOver and TalkBack, find Listen/Stop, current status, speech language, text size, transcript and Clear. Interim words should not continuously interrupt announcements. Confirm named/Unknown labels are text, not color alone.
- Navigate entirely by keyboard where available. Check visible focus, Skip to captions, dialog focus entry/trap, Escape/Back to captions and focus restoration to Speakers.
- Check contrast in actual light/dark ambient conditions, reduced-motion mode, orientation changes, phone safe areas and large tap targets.

## Installation and static hosting

1. Confirm manifest and all PNG icons load from the deployed subdirectory. Install with Safari Share → Add to Home Screen / Chrome Install app. Check name, icon, launch URL, standalone display and safe-area layout.
2. Open online once, close/reopen, then go offline. The shell should open and explain the speech-service connection limit. Clear site storage while offline: fresh uncached opening is not expected to work.
3. Deploy a new build with changed visible text, with old app windows open. Confirm no active session is reloaded. Close all windows and reopen to activate the update. Ensure unrelated origin caches remain intact.
4. Reject/disable site storage and retry online: live captions should still work even if offline installation fails.

## Recording results

For every run record date, device model, OS/browser versions, tab/PWA mode, language, network condition, permission state, observations, latency sample count, and pass/fail for each step. Open a reproducible issue for any failure. M1's family-device gate, M2 enrolment and M3 attribution remain pending until the corresponding evidence exists.
