# Project-plan acceptance audit — 2026-10-10

This audit preserves the README's complete scope. Implemented code and passing desktop tests do not satisfy physical-device or human-speaker gates. The goal is not complete.

| Requirement | Current evidence | Remaining proof |
|---|---|---|
| FR-01 Listen/Stop | Browser adapter lifecycle unit tests; simulated-recognition app tests; actual capture lifecycle in research | Real speech appears and microphone ends on Pixel 8 and iPhone |
| FR-02 Interim/final rendering | Reconciliation unit tests and app browser tests cover replacement and stable finals | Confirm actual provider behaviour on both phones |
| FR-03 Accessible display | Large relative text, focus/scroll controls; 320 px and enlarged-text browser checks | VoiceOver, TalkBack, phone text scaling, contrast/readability observations |
| FR-04 Immediate anonymous use | `main.tsx` composes browser ASR without loading speaker services; app tests enter listening without profiles | Family member opens the deployed URL and reads live speech |
| FR-05 Consented enrolment | Real Chromium embedding/IndexedDB enrolment, comparison, deletion; consent/storage/lifecycle unit tests | Creation/deletion, microphone handling and performance on both phones |
| FR-06 Enrolled identity | Conservative research matcher requires calibration; production captions stay Unknown | Consented held-out human scores, acceptance threshold evidence, compatible live alignment and device results |
| FR-07 Speaker grouping | Research alignment rejects ambiguous spans; candidate turn/overlap errors documented | Reliable live grouping and clear transitions on two-person device tests; currently absent from production |
| FR-08 Graceful degradation | Unsupported recognizer/audio/storage/model failure and cancellation paths have browser coverage; enrolment failure preserves captions | Target-device failure/recovery observations |
| FR-09 Installable cross-platform PWA | Manifest/icons, scoped service worker, root/project-path offline browser tests; Pages workflow configured | First successful hosted deployment, iOS and Android tab/installed-PWA checks |
| FR-10 Data minimisation | Browser-provider disclosure; local enrolment and temporary comparisons; no app audio/transcript persistence; tested cleanup | Observe phone network/storage behaviour for the selected processing path |
| NFR-01 Static TypeScript app | Typecheck and Vite static build; Actions checks/build/deploy workflow | Successful first remote workflow and published-site verification |
| NFR-02 Local storage/processing | Versioned local IndexedDB voiceprints, lazy local WASM, in-memory transcript | Physical storage/reload/deletion behaviour |
| NFR-03 Perceived responsiveness | Desktop processing/timing measurements are recorded; browser-provider acoustic delay unmeasured | Speech-to-caption latency and cold/warm model timings on both phones |
| NFR-04 Privacy/security | Consent, versioned profiles, deletion, pinned local model assets and no private client API credentials | HTTPS deployment verification and device permission/deletion checks |

FR-06/07 are explicitly research-dependent in the specification. The Unknown fallback is implemented, but this audit does not treat it as proof of the M3 attribution gate or silently remove that gate.

## Milestones and validation checklist

- **M1:** implementation and automated checks exist; family-use, Safari/Chrome and installed-PWA acceptance remain pending.
- **M2:** enrolment and same/different comparison UI exist. Target-device performance, realistic microphone conditions, separate-session human trials and false-match measurement remain pending.
- **M3:** common-clock capture/ASR and conservative alignment experiments exist. The evaluated turn detector fails synthetic counterexamples; human calibration, reliable grouping, live integration and two-person target-device acceptance remain pending. No identities are enabled.
- **Interruptions and conditions:** desktop tests cover denial, silence, late permission, pagehide, model failure and bounded overruns. Real noisy-room behaviour, switching/unknown/overlapping human voices, phone network loss, incoming calls, lock screen and return remain unverified.
- **Long sessions/resources:** accelerated fifteen-minute generated input passed with stable observed WASM memory. Fifteen minutes of actual live phone capture, thermals, battery and peak device memory are unverified.
- **Accessibility:** desktop layout/keyboard/focus tests exist; VoiceOver/TalkBack and physical readability checks remain pending.
- **Required local commands:** `npm run check` covers typecheck, lint, unit tests, asset hashes and build. Production `test:e2e` last passed 28 checks with four Windows WebKit audio skips. Research model browser tests separately ran actual inference in Chromium/WebKit; neither is a phone pass.

## Evidence needed next

The user subsequently authorized the push, and GitHub now has `main`. Actions runs automatically; publication remains gated on successful checks. Once deployed, open `https://h-wilderspin.github.io/speech-to-text/` on Pixel 8. Start with Listen/Stop and report the result plus Android/Chrome versions. Repeat on iPhone, identifying its model/iOS version, then follow the tab/PWA, accessibility and enrolment steps in [manual testing](manual-testing.md).

Use Speakers → Compare recordings with consent for realistic same/different-person trials. Follow the held-out protocol in [feasibility](feasibility.md); retain anonymous score/timing observations, not personal audio or voiceprints. Synthetic signals and two generated voices cannot replace this evidence. Additional production attribution work should be based on those results rather than a guessed threshold.

Authoritative code/tests: [application composition](../src/main.tsx), [browser adapter](../src/transcription/browser.ts), [transcript](../src/features/listening/Transcript.tsx), [speaker services](../src/app/speaker-services.ts), [app browser tests](../tests/app.spec.ts), [speaker browser tests](../tests/speakers.spec.ts), [Pages workflow](../.github/workflows/pages.yml). Detailed measurements and limitations are in [feasibility](feasibility.md).
