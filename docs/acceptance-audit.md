# Project-plan acceptance audit — 2026-10-10

This audit preserves the README's complete scope. Implemented code and passing desktop tests do not satisfy physical-device or human-speaker gates. The goal is not complete.

| Requirement | Current evidence | Remaining proof |
|---|---|---|
| FR-01 Listen/Stop | Automated lifecycle/restart/voice-command tests plus earlier user-reported Pixel 8 captions and button Stop | Physical retest of automatic continuation and spoken stop; iPhone result, versions and operating mode |
| FR-02 Interim/final rendering | Regression fixtures cover cumulative phrase extensions as well as interim replacement | User reported repeated growing text; confirm the fix on Pixel 8 and actual provider behaviour on iPhone |
| FR-03 Accessible display | Large relative text, focus/scroll controls; 320 px and enlarged-text browser checks | VoiceOver, TalkBack, phone text scaling, contrast/readability observations |
| FR-04 Immediate anonymous use | Browser ASR composition/tests plus user-reported speech appearing on the deployed app on Pixel 8 | Confirm fresh-site/no-enrolment conditions and iPhone behaviour |
| FR-05 Consented enrolment | Automated enrolment/storage tests plus user-reported Pixel 8 profile save, reload persistence and deletion | iPhone flow; phone interruption/cancellation and performance measurements |
| FR-06 Enrolled identity | Conservative research matcher requires calibration; production captions stay Unknown | Consented held-out human scores, acceptance threshold evidence, compatible live alignment and device results |
| FR-07 Speaker grouping | Research alignment rejects ambiguous spans; candidate turn/overlap errors documented | Reliable live grouping and clear transitions on two-person device tests; currently absent from production |
| FR-08 Graceful degradation | Unsupported recognizer/audio/storage/model failure and cancellation paths have browser coverage; enrolment failure preserves captions | Target-device failure/recovery observations |
| FR-09 Installable cross-platform PWA | Successful Pages deployment; live HTTPS manifest/icons, scoped worker and offline shell verified in Chromium/WebKit | iOS and Android tab/installed-PWA checks |
| FR-10 Data minimisation | Browser-provider disclosure; local enrolment and temporary comparisons; no app audio/transcript persistence; tested cleanup | Observe phone network/storage behaviour for the selected processing path |
| NFR-01 Static TypeScript app | Typecheck/Vite static build, successful Actions deployment and published-site verification | Proven for the current static deployment |
| NFR-02 Local storage/processing | Versioned local IndexedDB voiceprints, lazy local WASM, in-memory transcript; Pixel 8 save/reload/delete reported successful | iPhone storage behaviour; phone storage-error and privacy observations |
| NFR-03 Perceived responsiveness | Desktop measurements plus latest Pixel 8 comparison processing reported as approximately 0.9 s; acoustic caption delay unmeasured | Repeated phone timings, speech-to-caption latency and cold/warm model loading |
| NFR-04 Privacy/security | Verified HTTPS deployment, consent, versioned profiles, pinned model assets and no private client API credentials; Pixel 8 profile deletion reported successful | Phone permission-recovery checks; deletion after another reload and iPhone verification |

FR-06/07 are explicitly research-dependent in the specification. The Unknown fallback is implemented, but this audit does not treat it as proof of the M3 attribution gate or silently remove that gate.

## Milestones and validation checklist

- **M1:** implementation and automated checks exist; a basic physical Pixel 8 Listen/Stop pass is now reported by the user. Full workflow/accessibility/installed-PWA checks remain pending. The user reports that the iPhone is unavailable.
- **M2:** enrolment and same/different comparison UI exist. The user reports successful Pixel 8 profile save/reload/delete, three same-person scores around 0.8 and approximately 0.9 s processing for the latest comparison. Another participant is unavailable. Different-person scores, repeated timings, separate-session human trials, false-match measurements and iPhone testing remain pending.
- **M3:** common-clock capture/ASR and conservative alignment experiments exist. The evaluated turn detector fails synthetic counterexamples; human calibration, reliable grouping, live integration and two-person target-device acceptance remain pending. No identities are enabled.
- **Interruptions and conditions:** desktop tests cover denial, silence, late permission, pagehide, model failure and bounded overruns. Real noisy-room behaviour, switching/unknown/overlapping human voices, phone network loss, incoming calls, lock screen and return remain unverified.
- **Long sessions/resources:** accelerated fifteen-minute generated input passed with stable observed WASM memory. Fifteen minutes of actual live phone capture, thermals, battery and peak device memory are unverified.
- **Accessibility:** desktop layout/keyboard/focus tests exist; VoiceOver/TalkBack and physical readability checks remain pending.
- **Required commands:** `npm run check` passed typecheck, lint, 112 unit tests, asset hashes and build after the listening changes. Local `test:e2e` passed 30 tests with four existing Windows WebKit audio skips; [Linux CI](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38054491286) passed all 34 browser tests. Live-site repetition/restart/voice-command checks also passed in Windows Chromium/WebKit using simulated recognition; none is a phone pass.

## Evidence needed next

The user authorized the push; GitHub now has `main`, and the [first successful deployment](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38051991375) is verified. Initial Pixel 8 storage and same-person comparison observations are recorded. Retest the reported caption repetition and the new persistent listening/voice stop, then collect the remaining tab/PWA/accessibility results and Android/browser versions. Both the iPhone and another participant are unavailable; their tests remain pending until access is possible. Follow [manual testing](manual-testing.md).

Use Speakers → Compare recordings with consent for realistic same/different-person trials. Follow the held-out protocol in [feasibility](feasibility.md); retain anonymous score/timing observations, not personal audio or voiceprints. Synthetic signals and two generated voices cannot replace this evidence. Additional production attribution work should be based on those results rather than a guessed threshold.

Authoritative code/tests: [application composition](../src/main.tsx), [browser adapter](../src/transcription/browser.ts), [transcript](../src/features/listening/Transcript.tsx), [speaker services](../src/app/speaker-services.ts), [app browser tests](../tests/app.spec.ts), [speaker browser tests](../tests/speakers.spec.ts), [Pages workflow](../.github/workflows/pages.yml). Detailed measurements and limitations are in [feasibility](feasibility.md).
