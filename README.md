# Speech-to-Text PWA

**Separate PC comparison (2026-10-13):** the published
[comparison page](https://h-wilderspin.github.io/speech-to-text/compare.html) keeps the native live
captions below and uses the new Python pipeline for delayed names above. It shares
saved profiles/settings with the original app. The user chose PC hosting through
a temporary HTTPS link; no hosting subscription is enabled. See
[start/stop and test instructions](service/README.md) and
[ADR 0035](docs/decisions/0035-separate-pc-comparison-endpoint.md).
The original page and listening engines remain available unchanged. The page is
deployed; phone access to the PC service is blocked by tunnel DNS discovery,
including the reported normal-terminal launch. Public connectivity and physical-device acceptance are tracked in
the feasibility notes.

**Local comparison (2026-10-13):** delayed Whisper, Community-1 speech turns,
per-turn identity matching and word alignment correctly name 120/123 known words,
with zero false names on 41 unknown words and 9/11 complete utterances in generated
speech. The separate service reproduces those results; human validation remains outstanding. See the
[measured comparison and recommended next step](docs/community-benchmark.md).
The original app's live captions are unchanged.

## Implementation status — 2026-10-12

**Latest attribution trace:** three locally named spans now reach the upper pane;
the user confirms the excluded middle passages were a recorded audiobook. Two of
the user's sentences still have unnamed tails locally, after weaker voice windows
at their endings. The user explicitly retains strict word-by-word matching rather
than whole-phrase estimates. Capture drains normally. See
[current evidence](docs/feasibility.md); boundary coverage and live different-person
accuracy remain unresolved. Repeated wording can use matched surrounding context
as described in [ADR 0031](docs/decisions/0031-context-for-repeated-wording.md).
A separate registration cleanup error is fixed. Console
output now uses complete numeric JSON lines so copied scores are not hidden inside
collapsed object previews. Open [the debug URL](https://h-wilderspin.github.io/speech-to-text/?debugSpeakers=1)
and filter `who-said-what`. See [diagnostic instructions](docs/speaker-diagnostics.md)
and [current evidence](docs/feasibility.md). No identity cutoff was changed.

**Longer guided voice registration:** Settings now provides a passage to read for
20 seconds, up from eight. Under **Voice to record**, select your saved name and
choose **Update voice (20 seconds)** to replace its voiceprint while keeping its
colour and visibility. The old profile remains until the new one saves successfully.
Existing profiles continue to work. This supplies more registration speech; improved
human matching is not yet verified. See [ADR 0029](docs/decisions/0029-guided-longer-voice-registration.md).

**Earlier empty upper-pane report:** the preceding Pixel 8 retest reported
excellent live captions but no upper text after Stop, with "Speech received; no
saved voice matched yet." A reproduced timing defect discarded voice decisions
before delayed local words arrived; decisions now retain a 30-second history.
Settings distinguishes weak/ambiguous matches from word-attribution failures using
session counts and similarity. Browser captions and matching thresholds are
unchanged. This correction still needs physical verification; see
[ADR 0028](docs/decisions/0028-retain-delayed-voice-evidence.md).

**Speaker activity and upper-pane update:** each registered person has an eye
button in Settings. Turning it off hides their speech from Who said what, including
existing text; turning it back on restores it. The choice survives reloads. Their
voiceprint remains in matching and all speech remains visible below. Completed
speaker evidence can now appear above before Android finalizes its live sentence,
and matching tolerates one differing word between two unique three-word anchors.
Settings shows a matching status for diagnosing an empty pane. The subsequent
phone retest still failed, as recorded above; see [ADR 0027](docs/decisions/0027-speaker-visibility-and-provisional-attribution.md).

**Single-pane Settings:** full-viewport scrolling with a return icon beside the
title. Registration, text options and speaker colours are on the same page.
Registered people appear as pills with activity, colour and protected-delete buttons.
Names prepare automatically for saved profiles; there is no enable checkbox.
See [ADR 0026](docs/decisions/0026-single-pane-settings-automatic-names.md).

**Two-pane family interface:** dark mode with immediate light-grey captions below and completed speech matched to saved people above. Unknown speech is omitted only from the upper pane. Settings contains text size/language, speaker registration and eight high-contrast colours. Choices persist across reloads. Registration needs a name and Record action; existing profiles still work. See [ADR 0025](docs/decisions/0025-dark-two-pane-family-interface.md).

**Transcription first:** the user reports that the larger local model still makes
too many mistakes and prefers delayed speaker detection. Browser recognition now
supplies the displayed words. Optional speaker estimates arrive later without
replacing those words. On reopening, Listen works immediately; saved voiceprints
automatically enable delayed estimates. Existing cached models
and voiceprints are reused. No new model is introduced. See [ADR 0023](docs/decisions/0023-browser-first-delayed-names.md).

**Android browser captions:** cumulative hypotheses replace one line per native recognition cycle, including equal repeats and corrected wording, then commit once on normal completion. Continuous capture and prompt restart remain enabled; earlier completed cycles retain deliberate repetition. Spoken Stop waits for provider completion, which may require a pause. Latest user feedback confirms that opening words are no longer lost; wider physical retesting remains pending. See [ADR 0020](docs/decisions/0020-android-cumulative-recognition.md). Optional speaker processing adds delayed estimates to those captions as described below.

The main page contains only **Listen**, **Clear** and **Settings** above two independently scrolling caption panes. Listen becomes Stop. Saved names and assigned speech use the chosen profile colour; the live pane stays light grey, without labels. Unknown speech never appears in the upper pane. Browser recognition supplies no identity itself; optional local processing adds delayed estimates. Both panes preserve browser wording. [ADR 0025](docs/decisions/0025-dark-two-pane-family-interface.md) supersedes the earlier single-pane layout.

M1's application is implemented: accessible anonymous captions, replaceable interim text, stable final text, explicit Listen/Stop and interruption recovery, adjustable text size, processing disclosure, and a static installable PWA shell. Automated verification and limitations are recorded in [feasibility](docs/feasibility.md).

The user reports that captions appear and Stop releases the microphone on a physical Pixel 8. This basic Listen/Stop check passed; browser/OS versions, installed-PWA behaviour and the wider device checks remain unconfirmed. The iPhone is currently unavailable for testing.

Pixel 8 speaker enrolment also passed a user-reported check: a profile saved, survived reloading and was deleted successfully. Three initial same-person comparisons were reported as approximately 0.8 similarity; the latest showed approximately 0.9 seconds of voice processing. The user subsequently tested local captions with another person and reported poor transcription; per-speaker counts and different-person comparison scores remain unavailable. These observations do not establish identification accuracy or a matching threshold.

Listening now restarts across pauses and normal browser recognition endings. Tap Stop or say **“command stop”** to finish; the confirmed command is removed from captions. Keep the app open: leaving it or a microphone/provider failure still interrupts capture. The newest 100,000 characters are retained without stopping a long session. Growing cumulative hypotheses within one native utterance are displayed once; repeated phrases in separate utterances remain. The user has confirmed on Pixel 8 that the command works and text appears once; continuation after the requested 15-second pause was not explicitly reported. See [ADR 0014](docs/decisions/0014-persistent-listening-and-voice-stop.md).

**The full project plan is not complete.** Experimental M2 enrolment is implemented: guided twenty-second recordings produce local English-model voiceprints with versioned IndexedDB storage, listing and deletion. The first Prepare downloads about 39 MB of public model/runtime files; subsequent enrolments and comparisons automatically reuse the verified cached model, including after reloading offline. Only missing/damaged assets are fetched again; browsers can evict stored files. Raw audio is discarded. Broader physical-device performance and speaker accuracy remain unverified. See [ADR 0006](docs/decisions/0006-experimental-local-enrolment.md), [cache policy](docs/decisions/0016-reuse-cached-voice-model.md), [model assets and licences](docs/speaker-assets.md), and the [device test matrix](docs/manual-testing.md).

**Experimental delayed names:** saved voiceprints automatically prepare the existing models, fetching only missing or damaged assets. Tap Listen for immediate browser words; prepared local processing starts alongside them or joins when ready. Names and matching text colours arrive only in the upper pane, sometimes after a pause or Stop. The lower pane never shows labels. Short, repeated, mismatched or uncertain words remain below only. Estimates may be wrong and do not establish reliable diarization. English is currently required for names; other languages retain browser captions. Failed preparation offers **Retry names** in Settings. The combined cache is about 205 MB; no models download without a compatible saved profile. The Android pause/repetition fixes remain in use.

Delayed estimates reuse up to **205 MB** of speech models/runtime and the existing voice model (27 MB if missing). Only absent/damaged files download. Browser transcription may send audio to its provider and need a connection; voiceprints and speaker processing remain on-device. The app saves neither audio nor transcripts. Stop and “command stop” stop both captures, then pending estimates can finish. A local-processing failure leaves browser captions running. Concurrent browser/local microphone operation and accuracy on Pixel 8/iPhone require retesting. See [ADR 0023](docs/decisions/0023-browser-first-delayed-names.md) and [local model provenance](docs/local-speech-assets.md).

**Settings → More → Compare recordings** supports local same-person/different-person evaluation against a saved profile. It requires a declared relationship, displays cosine similarity and processing time, and retains at most 20 temporary results until you clear them, close comparison or interrupt the app. The test recording and voiceprint are discarded; saved profiles are unchanged. Scores are measurements, not probabilities or confirmed identities. See [ADR 0011](docs/decisions/0011-local-voice-comparison.md).

M3's shared-clock ASR/voice-window pipeline now powers the automatic estimates above. Continuous capture feeds numbered AudioWorklet frames to streaming ASR and speaker processing, so token points share the input sample clock. Human calibration, accurate speaker turns and physical-device throughput remain unfinished. Browser ASR remains the default. The earlier experiments are recorded in [ADR 0007](docs/decisions/0007-streaming-asr-clock-experiment.md), [ADR 0009](docs/decisions/0009-continuous-audio-clock.md) and [ADR 0010](docs/decisions/0010-shared-speech-and-speaker-windows.md).

A separate offline speaker-turn candidate now runs in Node, Chromium and WebKit. Two generated voices expose incorrect cluster assignments despite a correct speaker count; processing approximately 24 seconds takes 9–11 seconds on the tested desktop. It is not enabled for live captions. See [ADR 0013](docs/decisions/0013-offline-diarization-candidate.md) and [reproduction instructions](research/README.md).

The [acceptance audit](docs/acceptance-audit.md) maps every requirement to current evidence and the remaining device/human-speaker checks. Ten-second segmentation isolation is faster but still merges the two alternating generated voices; it does not resolve the attribution gate.

A newer direct-reference prototype bypasses those cluster IDs: local ASR token points and overlapping voice windows share the same audio clock. In generated A/B/A speech, 81 of 93 token points received the correct reference label and 12 remained Unknown; unequal-volume overlap still exposed ambiguous attribution. These are synthetic mechanics tests, not human accuracy. The production integration path and remaining calibration/overlap requirements are in [ADR 0017](docs/decisions/0017-direct-live-attribution-prototype.md).

### Run locally

Use Node 22.12+ (tested: 22.20.0):

```sh
cd speech-to-text
npm ci
npm run dev
```

Open the printed localhost URL. Listen uses the browser's speech service, which may send audio to its provider and require a connection. Optional delayed speaker processing runs on-device using cached models. The app saves neither recordings nor transcripts. Remote-device microphone testing requires HTTPS; an ordinary LAN HTTP address is insufficient. Offline model availability does not imply offline browser transcription.

### Verify and deploy

```sh
npm run check
npx playwright install chromium webkit
npm run test:e2e
npm run preview
```

`check` runs TypeScript, ESLint, unit tests, speaker-asset checksum verification and a production build. Browser tests use simulated recognition and synthetic microphone input; enrolment tests exercise real local inference and storage, but do not verify acoustic accuracy or phone microphones. For certificate or sandbox issues see [troubleshooting](docs/troubleshooting.md).

### GitHub Pages under H-Wilderspin

The public repository [H-Wilderspin/speech-to-text](https://github.com/H-Wilderspin/speech-to-text) is created and the source has been pushed. GitHub Pages is configured to deploy through Actions, and the `github-pages` environment permits deployment from `main`. Local `main` tracks `origin/main`.

From this directory, publish subsequent committed changes with:

```sh
git push
```

Every subsequent push to `main` runs [.github/workflows/pages.yml](.github/workflows/pages.yml): install dependencies, typecheck, lint, unit tests, production build, Chromium/WebKit tests, then publish `dist/`. Pull requests run checks without publishing. Follow progress in [GitHub Actions](https://github.com/H-Wilderspin/speech-to-text/actions).

The live address is **https://h-wilderspin.github.io/speech-to-text/**. The first successful [deployment](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38051991375) passed all 32 Linux Chromium/WebKit browser tests. The published HTTPS page, manifest/icons, scoped service worker and offline shell were verified in desktop Chromium/WebKit; Chromium also prepared the hosted voice model without requesting a microphone. The user has since reported a basic Pixel 8 Listen/Stop pass. Continue with [manual testing](docs/manual-testing.md); iPhone checks await device availability.

The one-time account setup is reproducible with `./scripts/setup-github-pages.ps1` in PowerShell using Git Credential Manager's existing sign-in. It creates the public repository if absent and configures Pages and its deployment environment. It does not push code or store credentials in project files. It has already been run for this repository.

The workflow assumes this app is the repository root, rather than a subfolder of a larger repository. GitHub Pages supports public repositories on GitHub Free; private repository hosting depends on the account plan. See [GitHub's Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [ADR 0005](docs/decisions/0005-github-pages-hosting.md).

Relative assets, manifest scope and service-worker scope support both a project directory ending in `/` and a root/custom-domain site. No backend, secret tokens or runtime configuration are needed. GitHub manages cache headers; no custom headers file is required. Close all app windows and reopen to apply a waiting update. The app includes browser captions, experimental local enrolment, temporary voice comparisons and optional estimated live names. Include the public files documented in [speaker assets](docs/speaker-assets.md) and [local speech assets](docs/local-speech-assets.md) in the repository; development-only benchmarks and generated test fixtures are not published.

For another static HTTPS host, deploy the contents of `dist/`. Where headers are configurable, serve `index.html`, `manifest.webmanifest` and `sw.js` with revalidation (`Cache-Control: no-cache`); hashed `assets/` can use immutable caching. Serve `.webmanifest` as `application/manifest+json` and `.js` as JavaScript. Do not rewrite missing JS/image files to HTML.

The development-only `research/` directory contains conservative matching/alignment experiments and a read-only audit:

```sh
npm run spike -- /path/to/sherpa-onnx-wasm-main-speaker-diarization.js
```

It expects the matching `.wasm` and `.data` beside the JS file. No speech is captured and no model inference is run. These tools are excluded from the application bundle. See [feasibility](docs/feasibility.md) for the inspected artifact checksum, measurements and next experiment.

The subsequent **real inference** experiment is available at `/research/speaker-benchmark.html` on the development server after preparing its assets. `npm run spike:infer` runs it in Node; `npm run spike:browser` runs Chromium/WebKit plus cancellation and model-fetch failure checks. These use a synthetic signal, load assets only after an explicit action, and save no audio or embeddings. See [research instructions](research/README.md). This page and its model assets are deliberately absent from `dist/`.

---

An accessibility-first, mobile-friendly speech-to-text proof of concept (PoC) that transcribes speech live and, when speaker recognition is enabled, attributes speech to enrolled speakers.

This README is the **product specification and development guide** for Codex. `AGENTS.md` defines the implementation workflow and repository conventions. Where implementation details are undecided, investigate, record a decision, and choose the smallest reversible solution that satisfies the requirements.

## 1. Product goals

1. **See speech as it happens:** A person taps **Listen** and sees large, legible transcription occupying the available screen.
2. **Works without setup:** The default **anonymous mode** needs no account, registration, speaker enrolment, or configuration.
3. **Know who spoke:** Users can enrol known voices, then see attributed speech when different people speak.
4. **Run on family devices:** Installable PWA usable on current iOS Safari and Android Chrome.
5. **Stay simple and cheap:** Static frontend hosting, TypeScript, free browser/on-device facilities first, and only genuinely necessary third-party services. No dedicated backend is part of the default design.

### Non-goals for the PoC

- Accounts, multi-device synchronisation, cloud-stored transcripts, transcript history, message export, or social sharing.
- Continuous dictation with the phone locked or while the PWA is backgrounded.
- System-wide dictation or replacement of the iOS/Android keyboard.
- Guaranteed transcription of overlapping speech or perfect identification of a speaker.
- A paid transcription service or a permanently running application server.

## 2. User experience

### Anonymous listening (default)

1. Open the PWA; arrive directly at the transcription screen. No registration or onboarding gate.
2. Tap **Listen**, grant microphone access when prompted, and begin speaking.
3. Interim words appear promptly and are clearly distinguished from confirmed text; interim revisions must **replace**, not duplicate, text.
4. Finalised text stays readable as further speech arrives. The screen uses nearly all available display area for transcription.
5. Listening continues across pauses while the app stays open. Tap **Stop** or say **“command stop”** to end microphone capture. Clear errors and actionable recovery prompts are shown if permission is denied or recognition fails.

### Enrolled speakers

1. Open **Settings**, enter a display name under Add a speaker, and record a short sample using the explicit Record action. Registered people appear above as pills with activity, colour and protected-delete buttons.
2. Generate and store a reusable voice embedding / voiceprint **on the device when technically feasible**. Let users inspect and delete individual profiles.
3. During listening, show final assigned speech with names and colours in the upper pane. Unassigned speech appears only in the live pane below, without a speaker label.
4. When possible, distinguish different unknown voices as **Speaker 1**, **Speaker 2**, etc. within the current session; these ephemeral labels are not identities.
5. Communicate uncertainty without falsely presenting a guess as a confirmed identity. Preserve readable text even if speaker recognition is unavailable.

### Accessibility baseline

- Large text by default (starting point: 28–36 CSS px on phones), responsive sizing and user-adjustable text size.
- Strong contrast, uncluttered full-screen layout, obvious controls with generous tap targets.
- Do not convey speaker identity by colour alone: show names/labels in text.
- Support system zoom and dynamic text settings; avoid disabling viewport scaling.
- Accessible status feedback for listening, paused/stopped, and errors; avoid announcing every unstable interim word to screen readers.
- Respect reduced-motion settings; handle scrolling without repeatedly stealing focus from the reader. Provide an obvious way to return to the newest speech when scrolled back.
- Aim for WCAG 2.2 AA as a practical target; verify key workflows with device accessibility features.

## 3. Requirements and acceptance criteria

| ID | Priority | Requirement | Demonstration / acceptance |
|---|---|---|---|
| FR-01 | Must | Persistent live transcription with **Listen**, **Stop** and spoken **“command stop”** | Tap Listen; speech appears once; pauses resume automatically; button or confirmed spoken command ends mic use. |
| FR-02 | Must | Interim and final transcription rendering | Interim revisions do not duplicate words; final segments remain stable. |
| FR-03 | Must | Readable, accessible full-screen display | Large text, text scaling, high contrast, accessible controls on phone sizes. |
| FR-04 | Must | Anonymous mode works immediately | No speaker profiles, account, or cloud service required to enter listening mode. |
| FR-05 | Must | Enrol named speaker with voice samples | Name and Record action create a profile; choose its colour or delete it in Settings. Browser microphone permission still applies. |
| FR-06 | Must* | Identify enrolled speakers | Show assigned final speech above; keep unknown speech only in the live pane below. |
| FR-07 | Must* | Show who said what across speakers | Transcript groups segments by speaker; changes remain visually clear. |
| FR-08 | Must | Graceful degradation | Unavailable recogniser / diarisation never blocks basic listening if STT works. |
| FR-09 | Must | Cross-platform installable PWA | HTTPS; manifest; iOS Safari and Android Chrome device checks. |
| FR-10 | Must | Data minimisation | No audio or transcript upload/storage without an explicit selected processing path. |
| NFR-01 | Must | TypeScript frontend; static deploy | Build outputs static assets; no always-on backend required. |
| NFR-02 | Must | Local-first storage and processing | Profile embeddings stored locally where feasible; transcript stays in memory. |
| NFR-03 | Target | Prompt perceived responsiveness | Interim text should normally appear within ~1 second where the selected engine permits; measure rather than promise. |
| NFR-04 | Must | Privacy and security | HTTPS, explicit microphone consent, no hard-coded secret API keys, delete enrolments. |

\* Speaker identification and diarisation are **research-dependent feasibility goals**. Do not pretend they are solved by the browser SpeechRecognition API. Document measured limits and leave unreliable matches unassigned in the live pane.

## 4. Technical approach

### Frontend

- **React + TypeScript + Vite**, installable **PWA** with a web app manifest and service worker.
- Static hosting over HTTPS (for example Cloudflare Pages, GitHub Pages, Netlify, or an S3 + CDN setup).
- Mobile-first and usable in Safari on iOS and Chrome on Android. Browser / OS support is tested on actual family devices; desktop emulation alone is insufficient.
- Device-only IndexedDB for enrolled speaker metadata and embeddings; no persistent transcript requirement.

### Audio and inference — separate concerns

Treat these as distinct modules with replaceable implementations:

1. **Capture:** Microphone permission, audio frames, sample-rate handling, session lifecycle, and interruption handling. Use `getUserMedia` and an `AudioWorklet` for frame-level processing where needed.
2. **Speech-to-text (ASR):** Convert audio/speech to timestamped partial and final text. A Web Speech API adapter is suitable for initial anonymous-mode validation, but its availability, behaviour and recognition service dependence vary by browser.
3. **Speaker diarisation:** Determine *when the speaker changes*. Needed for reliable attribution of multi-speaker audio.
4. **Speaker identification:** Compare voice embeddings from utterances to consented, enrolled embeddings using a conservative confidence threshold.
5. **Alignment:** Associate transcript segments with speaker segments using real timing evidence; do **not** infer identities from text alone or invent timestamps absent from a recogniser.
6. **Presentation:** Render stable final text, provisional interim text, speaker labels and state/accessibility feedback.

**Key technical risk:** Browser speech recognition may not expose raw audio, reliable timestamps, or the data needed for alignment. The speaker-aware path will likely require a unified captured audio stream and a separately evaluated ASR/diarisation/embedding pipeline. Do not build speaker identification on unsupported assumptions about the Web Speech API.

### Processing and provider strategy

Order of preference:

1. Browser-native capability where sufficient.
2. On-device models via browser-supported inference runtimes (e.g., ONNX Runtime Web or Transformers.js), **subject to real iOS/Android benchmarks** for model size, memory, latency, thermals and battery.
3. Free-tier external inference **only after** documenting privacy, usage limits, latency, platform availability, CORS and sustainability. Never embed a private API token in browser assets; if the provider requires a secret, it is incompatible with a purely static client without a trusted intermediary.

There is **no assumption that a free, static-only, real-time speaker-ID solution already exists**. Feasibility findings may require relaxing a constraint; record and surface that trade-off before adding infrastructure or paid services.

### Suggested TypeScript interfaces (adapt as discovery dictates)

```ts
type TranscriptSegment = {
  id: string;
  text: string;
  isFinal: boolean;
  startMs?: number; // only if measured/provided by the engine
  endMs?: number;
  speakerId?: string; // omitted if unknown / not confidently assigned
};

type SpeakerProfile = {
  id: string;
  displayName: string;
  embeddingVersion: string;
  createdAt: string;
};

interface TranscriptionEngine {
  start(): Promise<void>;
  stop(): Promise<void>;
  onSegment(callback: (segment: TranscriptSegment) => void): () => void;
}
```

Treat identity, time alignment and partial-result reconciliation as separate testable concerns. Avoid pretending that optional timestamps exist.

## 5. Delivery milestones

### M1 — Anonymous transcription and accessible interface

- PWA scaffold, basic responsive accessible screen, Listen/Stop, state transitions and permissions.
- Browser ASR adapter with correct handling of interim/final results and recovery from recogniser interruptions.
- Verify manually on iOS Safari (including installed PWA) and Android Chrome.
- **Gate:** A family member can open the URL and read their live speech without enrolling.

### M2 — Speaker enrolment

- User interface to add/list/delete named speakers and choose high-contrast colours; use an explicit Record action without consent checkboxes for this family project.
- Select and benchmark an on-device embedding approach; store versioned embeddings in IndexedDB (not raw recordings by default).
- Prototype same-speaker/different-speaker comparisons across sessions and realistic microphone conditions.
- **Gate:** Profiles are created/deleted successfully, and performance / false matches are measured on target devices.

### M3 — Multi-speaker live attribution

- Evaluate diarisation / speaker-turn segmentation and a compatible streaming ASR path using the **same audio timing reference**.
- Associate utterances with enrolled voiceprints; use Unknown for low confidence.
- Distinguish diarisation speaker labels from verified enrolled identities; ensure clear visual transitions.
- Measure latency, accuracy, interruptions and overlap. Keep anonymous mode working if this milestone is infeasible within static/on-device limits.
- **Gate:** Clearly separated speech from two people produces appropriately grouped, attributed text on test devices, with known limits recorded.

## 6. Validation checklist

- Test: iPhone Safari tab, installed iOS PWA, Android Chrome tab, installed Android PWA.
- Confirm microphone permission prompts and denial/recovery behaviour.
- Verify silence, speech restarts, noisy room, switching speakers, unknown speakers, speaker overlap and network loss (where relevant).
- Verify long sessions, app backgrounding, lock-screen interruption, incoming calls and app return; clearly document unsupported continuity.
- Check accessibility with text scaling, VoiceOver/TalkBack, contrast and screen sizes.
- Benchmark speaker embedding/diarisation memory usage, latency and battery effects on a real iPhone and Android phone.
- Add unit tests for transcript reconciliation, speaker-confidence thresholds, alignment rules and session transitions.
- Run project typecheck, lint, tests and production build before merging changes.

## 7. Repository layout

The structure below is a target, not an instruction to create empty folders. See `AGENTS.md` for boundaries and rules.

```text
/
├── README.md                  # Product intent, requirements and delivery plan
├── AGENTS.md                  # Codex instructions and engineering guardrails
├── docs/
│   ├── decisions/             # ADRs: why decisions were made
│   ├── troubleshooting.md     # Reproducible problems and verified fixes
│   └── feasibility.md         # On-device model and platform benchmark results
├── public/                    # Icons, manifest-related static assets
├── src/
│   ├── app/                   # Application setup, routing, state composition
│   ├── features/
│   │   ├── listening/         # Listening UI and session orchestration
│   │   └── speakers/          # Enrolment and speaker management UI
│   ├── audio/                 # Capture, microphone and audio framing
│   ├── transcription/         # ASR contracts, adapters, result reconciliation
│   ├── diarization/           # Speaker turns and alignment logic
│   ├── identification/        # Voice embeddings, matching and thresholds
│   ├── storage/               # IndexedDB and local data versioning
│   └── shared/                # Small truly shared components/utilities/types
├── tests/                     # Cross-feature / integration tests
└── package.json
```

## 8. Decisions to validate before extending scope

- Actual browser recognition behaviour and permission UX on the family devices.
- Whether browser-side models can perform usable live diarisation and speaker embeddings, rather than only offline analysis.
- Whether local-only recognition supports the required language/accent and acceptable responsiveness.
- Whether enabling speaker attribution necessitates a separate ASR implementation.
- How false-positive speaker identification is controlled and communicated.

**Development instruction:** Build M1 first, then run a narrow technical spike for M2/M3. Keep work aligned with these requirements and use `AGENTS.md` to record what was learned as implementation progresses.
