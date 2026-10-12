# Project-plan acceptance audit — 2026-10-12

**New trace after duplicate removal:** one reference, zero of three accepted voice
windows and zero ambiguity; reported best 0.59 is below the 0.60 minimum. Capture
and inference drained successfully. Independently, the current six-word alignment
rule excludes the user's isolated four-word utterance. These are unresolved
matching/short-phrase usability limits. Complete JSON console output improves
measurement; it does not claim to fix speaker recognition or relax identity gates.
Published as `7a55792` after [run 38289809827](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38289809827)
passed on its unchanged second attempt; the first hit the documented CI clock
interruption. 213 unit tests and published Chromium/WebKit JSON-log smoke checks
pass. The user confirms the rejected utterance was their own voice.

**Latest phone report:** one correctly transcribed and assigned statement appeared,
then no follow-up upper text. Sustained attribution remains unverified; the cause
is unresolved. [ADR 0030](decisions/0030-speaker-stage-console-diagnostics.md) adds
opt-in stage diagnostics and follow-up regression coverage. Published as `f41049c`
after [run 38281229875](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38281229875)
passed the full Linux workflow. 212 unit tests and published Chromium/WebKit console
opt-in smoke checks pass (no physical microphone used). This does not change
identity gates or establish human match accuracy. See [trace instructions](speaker-diagnostics.md).

This audit preserves the README's complete scope. Implemented code and passing desktop tests do not satisfy physical-device or human-speaker gates. The goal is not complete.

**Guided registration:** [ADR 0029](decisions/0029-guided-longer-voice-registration.md)
increases new/update recordings to twenty seconds with a reading passage. Existing
people can replace their voiceprint while retaining their ID, colour and visibility;
cancelled/failed attempts preserve the old profile. Checks/build and 205 unit tests
pass locally. Human matching improvement and phone recording remain unverified.

Published as `2082598`, [run 38270736803](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38270736803),
after the unchanged second CI attempt passed the full build/browser suite. The
first attempt had an unrelated paced audio-clock interruption, documented as
unresolved. Published Chromium/WebKit guided-reading, profile selection, persistence
and simulated-caption smoke checks passed with no page errors or microphone use.

**Earlier retest failed:** live listening is reported perfect, profile eye on, upper
pane empty after Stop. Status: "Speech received; no saved voice matched yet."
[ADR 0028](decisions/0028-retain-delayed-voice-evidence.md) fixes reproduced early
pruning of voice decisions before delayed tokens and adds diagnostic counts to
separate voice rejection from local word-attribution failure. 201 unit tests and
local check/build pass; physical resolution is unverified. See current feasibility.

Published correction: `a15394b`,
[run 38268575055](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38268575055).
Full Linux checks/deployment and published Chromium/WebKit UI/asset smoke passed.
The user confirms only their own profile is saved. Phone matching remains unresolved
until the new retention logic and diagnostic are tested on that device.

Latest user report: Who said what is empty even after Stop, without an error.
[ADR 0027](decisions/0027-speaker-visibility-and-provisional-attribution.md) adds
per-person upper-pane visibility, fixes browser-final gating of completed speaker
evidence and admits bounded phrase differences. New Settings diagnostics expose
the stage awaiting evidence. These address reproduced code paths; the user's
physical-device result remains unresolved until retested. See current feasibility.

Published as `e340de4`, [run 38266312236](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38266312236):
196 unit tests and all CI build/browser checks passed. Published Chromium/WebKit
activity/persistence/layout and simulated-caption smoke checks passed. Phone retest
requested; no new physical microphone or identity-accuracy pass is claimed.

Current increment: [ADR 0026](decisions/0026-single-pane-settings-automatic-names.md)
replaces nested Settings and the names toggle with one full-screen scrolling pane,
protected colour/delete pills and automatic model preparation for saved profiles.
Only assigned final speech has names above; live browser words remain label-free
below. It changes the workflow, not identity accuracy. Current validation and
publication evidence are recorded at the top of feasibility.

Published as `bf64ce9`, [run 38262304632](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38262304632):
191 unit tests, build checks and the full Linux browser suite passed. Fresh published
Chromium/WebKit layout, profile controls and simulated-caption smoke checks passed
with no microphone and no uncaught page errors. Physical-phone and human-speaker
acceptance remain pending.

Latest interface increment: [ADR 0025](decisions/0025-dark-two-pane-family-interface.md) adds dark two-pane captions, assigned speech only above, all live words below, persistent high-contrast colours/text preferences, and simplified personal registration. It changes presentation, not recognition accuracy or identity calibration. See the 2026-10-12 feasibility entry for checks.

Published as `f48e18d`, [run 38258052858](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38258052858): all build checks and the full Linux browser suite passed. Published Chromium/WebKit checks passed with simulated recognition and no microphone; phone acceptance remains pending.

Previous recognition increment: the larger local recognizer also failed the user's accuracy
retest. [ADR 0023](decisions/0023-browser-first-delayed-names.md) restores browser
words and adds optional delayed estimates without replacing text. Existing models
and voiceprints are reused. This is experimental phrase correspondence, not a
validated diarization/alignment system; phone accuracy and simultaneous microphone
operation remain unverified. See feasibility for current checks.

Published as `0082197`, [run 38136056686](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38136056686):
183 unit tests and all 52 Linux browser tests passed before deployment. Browser
speech results in those integration tests are simulated; actual generated local
inference is exercised. Phone accuracy and dual-microphone operation remain pending.

Previous increment: after trying estimated names with another person, the user
reported mostly wrong words and all-caps text during clear, one-at-a-time speech.
That local recognition test failed. ADR 0022 upgrades the ASR model and formats
sentence case; desktop clips improve, but Pixel 8 accuracy and throughput need
a fresh retest. This is not a confirmed phone fix or identity-accuracy result.

The upgrade deployed at `32d0494`: [run 38134351664](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38134351664)
passed 171 unit tests and all 50 Linux browser checks. Two prior runs failed the
Chromium estimated-label test; the final diagnostic-only change did not establish
a root cause. This intermittent CI issue remains recorded in troubleshooting.

The user previously authorized **experimental name suggestions**
while only one person was available. The optional English local engine uses shared
sample-clock ASR/reference windows and shows coloured **Name (estimate)** captions.
Browser captions remain anonymous. Generated known/other voices, offline model
reuse and paced AudioWorklet/Stop tests verify the integration; human calibration,
overlap handling and physical-device throughput remain unverified. See
[ADR 0021](decisions/0021-experimental-local-name-suggestions.md) and the latest
executed checks in [feasibility](feasibility.md). This does not close M3.

The experimental integration is published as app commit `096c184`: [run 38131541828](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38131541828)
passed 165 unit tests and all 50 Linux browser tests. Published Chromium/WebKit
model preparation, offline reuse and existing browser-result regressions passed.
These earlier checks do not validate the larger ASR upgrade or substitute for
physical device or human accuracy acceptance. See [ADR 0022](decisions/0022-upgrade-local-transcription.md)
and feasibility for the latest executed checks.

The initial publication attempt selected `labiraus` and was rejected with HTTP
403. The user subsequently signed in as `H-Wilderspin`; the owner account is now
available. A further WebKit cache-lifetime regression was fixed before retrying
publication; see [ADR 0018](decisions/0018-page-owned-public-model-cache.md).

Publication succeeded on 2026-10-11: [run 38125696202](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38125696202)
passed all 38 Linux browser tests without test skips and deployed code commit
`bc8991b`. The live site passed model preparation, offline reload/automatic reuse
and simulated listening/layout checks in desktop Chromium and WebKit. This
verification does not enable automatic identification or establish phone accuracy.

| Requirement | Current evidence | Remaining proof |
|---|---|---|
| FR-01 Listen/Stop | Automated lifecycle/restart/voice-command tests plus user-reported Pixel 8 button Stop and spoken stop working | Explicit pause-continuation result; iPhone result, versions and operating mode |
| FR-02 Interim/final rendering | Regression fixtures plus user-reported Pixel 8 fix: text now appears once | Wider corrections/repetition cases and actual provider behaviour on iPhone |
| FR-03 Accessible display | Large relative text, focus/scroll controls; 320 px and enlarged-text browser checks | VoiceOver, TalkBack, phone text scaling, contrast/readability observations |
| FR-04 Immediate anonymous use | Browser ASR composition/tests plus user-reported speech appearing on the deployed app on Pixel 8 | Confirm fresh-site/no-enrolment conditions and iPhone behaviour |
| FR-05 Consented enrolment | Automated enrolment/storage tests plus user-reported Pixel 8 profile save, reload persistence and deletion | iPhone flow; phone interruption/cancellation and performance measurements |
| FR-06 Enrolled identity | Optional estimates use existing profiles, a shared audio clock and explicitly uncalibrated baseline; generated known/other voices pass integration | Consented held-out human scores, validated threshold evidence and physical-device results |
| FR-07 Speaker grouping | Optional local captions group whole words by estimated name/colour; unknown/ambiguous evidence preserved | Reliable grouping, overlap rejection and clear transitions on two-person device tests |
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
- **M2:** enrolment and same/different comparison UI exist. The user reports successful Pixel 8 profile save/reload/delete, three same-person scores around 0.8 and approximately 0.9 s processing for the latest comparison. Another participant subsequently joined a local-caption test, which exposed poor transcription. Different-person scores, repeated timings, separate-session human trials, false-match measurements and iPhone testing remain pending.
- **M3:** common-clock capture/ASR now powers the user-authorized experimental estimates. Human calibration, reliable overlap/turn handling, phone throughput and two-person acceptance remain pending. Estimated labels do not satisfy confirmed identification accuracy.
- **Interruptions and conditions:** desktop tests cover denial, silence, late permission, pagehide, model failure and bounded overruns. Real noisy-room behaviour, switching/unknown/overlapping human voices, phone network loss, incoming calls, lock screen and return remain unverified.
- **Long sessions/resources:** accelerated fifteen-minute generated input passed with stable observed WASM memory. Fifteen minutes of actual live phone capture, thermals, battery and peak device memory are unverified.
- **Accessibility:** desktop layout/keyboard/focus tests exist; VoiceOver/TalkBack and physical readability checks remain pending.
- **Required commands:** `npm run check` passed typecheck, lint, 112 unit tests, asset hashes and build. After the three-button layout and synthetic-source correction, [Linux CI](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38056062154) passed all 36 browser tests and deployed successfully. Published layout, Settings/Speakers navigation and repetition/restart/voice-command checks passed in Windows Chromium/WebKit using simulated recognition; none is a phone pass. See feasibility/troubleshooting for the preceding WebKit fixture failures and the revised test boundary.

## Evidence needed next

The user authorized publication. Initial Pixel 8 storage/comparison observations and spoken stop/repetition fixes are recorded; opening words were reported retained. Both local recognizers subsequently failed the user's transcription-accuracy expectation. The current browser-first/delayed-name path needs a physical retest, especially simultaneous microphone access. Tab/PWA/accessibility results and Android/browser versions remain pending. iPhone remains unavailable; a second participant subsequently joined a test, but no identity-accuracy counts were reported. Follow [manual testing](manual-testing.md). The earlier all-Unknown report identified missing live integration, not a measured false-rejection rate.

Use Settings → More → Compare recordings with a willing participant for realistic same/different-person trials. Follow the held-out protocol in [feasibility](feasibility.md); retain anonymous score/timing observations, not personal audio or voiceprints. Synthetic voices cannot replace this evidence. The current upstream-example baseline is expressly uncalibrated and limited to estimated suggestions by the user's choice; future reliable identity work must be based on held-out evidence.

Authoritative code/tests: [application composition](../src/main.tsx), [browser adapter](../src/transcription/browser.ts), [transcript](../src/features/listening/Transcript.tsx), [speaker services](../src/app/speaker-services.ts), [app browser tests](../tests/app.spec.ts), [speaker browser tests](../tests/speakers.spec.ts), [Pages workflow](../.github/workflows/pages.yml). Detailed measurements and limitations are in [feasibility](feasibility.md).
