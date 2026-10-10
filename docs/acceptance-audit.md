# Project-plan acceptance audit — 2026-10-10

This audit preserves the README's complete scope. Implemented code and passing desktop tests do not satisfy physical-device or human-speaker gates. The goal is not complete.

Latest increment: persistent verified model reuse passes offline real-inference
browser checks; name/colour rendering is supported but the production adapter
still emits Unknown. The direct-reference research prototype names most token
points in generated turn-taking speech, while unequal overlap remains unresolved.
See [ADR 0016](decisions/0016-reuse-cached-voice-model.md) and
[ADR 0017](decisions/0017-direct-live-attribution-prototype.md). Current local checks:
130 unit tests and 32 available Windows browser tests passed, with four existing
WebKit audio skips. This does not close M3 or replace human calibration.

| Requirement | Current evidence | Remaining proof |
|---|---|---|
| FR-01 Listen/Stop | Automated lifecycle/restart/voice-command tests plus user-reported Pixel 8 button Stop and spoken stop working | Explicit pause-continuation result; iPhone result, versions and operating mode |
| FR-02 Interim/final rendering | Regression fixtures plus user-reported Pixel 8 fix: text now appears once | Wider corrections/repetition cases and actual provider behaviour on iPhone |
| FR-03 Accessible display | Large relative text, focus/scroll controls; 320 px and enlarged-text browser checks | VoiceOver, TalkBack, phone text scaling, contrast/readability observations |
| FR-04 Immediate anonymous use | Browser ASR composition/tests plus user-reported speech appearing on the deployed app on Pixel 8 | Confirm fresh-site/no-enrolment conditions and iPhone behaviour |
| FR-05 Consented enrolment | Automated enrolment/storage tests plus user-reported Pixel 8 profile save, reload persistence and deletion | iPhone flow; phone interruption/cancellation and performance measurements |
| FR-06 Enrolled identity | Conservative research matcher requires calibration; production captions remain anonymous | Consented held-out human scores, acceptance threshold evidence, compatible live alignment and device results |
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
- **Required commands:** `npm run check` passed typecheck, lint, 112 unit tests, asset hashes and build. After the three-button layout and synthetic-source correction, [Linux CI](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38056062154) passed all 36 browser tests and deployed successfully. Published layout, Settings/Speakers navigation and repetition/restart/voice-command checks passed in Windows Chromium/WebKit using simulated recognition; none is a phone pass. See feasibility/troubleshooting for the preceding WebKit fixture failures and the revised test boundary.

## Evidence needed next

The user authorized the push; GitHub now has `main`, and the [first successful deployment](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38051991375) is verified. Initial Pixel 8 storage/comparison observations and user-reported spoken stop/repetition-fix passes are recorded. Pause continuation was not explicitly confirmed; tab/PWA/accessibility results and Android/browser versions remain pending. Both the iPhone and another participant were reported unavailable; their tests remain pending until access is possible. Follow [manual testing](manual-testing.md). The user's observation of Unknown with saved profiles confirms the current fallback display, not a matching failure: live identification remains unimplemented.

Use Settings → Speakers → Compare recordings with consent for realistic same/different-person trials. Follow the held-out protocol in [feasibility](feasibility.md); retain anonymous score/timing observations, not personal audio or voiceprints. Synthetic signals and two generated voices cannot replace this evidence. Additional production attribution work should be based on those results rather than a guessed threshold.

Authoritative code/tests: [application composition](../src/main.tsx), [browser adapter](../src/transcription/browser.ts), [transcript](../src/features/listening/Transcript.tsx), [speaker services](../src/app/speaker-services.ts), [app browser tests](../tests/app.spec.ts), [speaker browser tests](../tests/speakers.spec.ts), [Pages workflow](../.github/workflows/pages.yml). Detailed measurements and limitations are in [feasibility](feasibility.md).
