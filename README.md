# Speech-to-Text PWA

## Implementation status — 2026-10-10

M1's application is implemented: accessible anonymous captions, replaceable interim text, stable final text, explicit Listen/Stop and interruption recovery, adjustable text size, processing disclosure, and a static installable PWA shell. Automated verification and limitations are recorded in [feasibility](docs/feasibility.md).

**The full project plan is not complete.** Experimental M2 enrolment is implemented: consented eight-second recordings produce local English-model voiceprints with versioned IndexedDB storage, listing and deletion. Prepare downloads about 39 MB of public model/runtime files only on request; raw audio is discarded. Physical Pixel 8/iPhone performance and speaker accuracy remain unverified. Browser ASR still lacks usable per-utterance alignment, so live identity attribution is not enabled and all captions remain Unknown. See [ADR 0006](docs/decisions/0006-experimental-local-enrolment.md), [model assets and licences](docs/speaker-assets.md), and the [device test matrix](docs/manual-testing.md).

**Speakers → Compare recordings** now supports local same-person/different-person evaluation against a saved profile. It requires consent and a declared relationship, displays cosine similarity and processing time, and retains at most 20 temporary results until you clear them, leave the screen or interrupt the app. The test recording and voiceprint are discarded; saved profiles are unchanged. Scores are measurements, not probabilities or confirmed identities. See [ADR 0011](docs/decisions/0011-local-voice-comparison.md).

M3 research has a streaming ASR candidate with token timestamps on its input sample clock. A continuous capture adapter feeds real AudioWorklet frames to a combined ASR, speech-region detector and bounded speaker-window experiment; Chromium tests use a synthetic microphone source. Shared sample coordinates and desktop throughput are verified, but startup behaviour, accurate speaker turns, identity calibration and physical-device capture remain unfinished. These experiments are not shipped as the live recognizer; see [ADR 0007](docs/decisions/0007-streaming-asr-clock-experiment.md), [ADR 0009](docs/decisions/0009-continuous-audio-clock.md) and [ADR 0010](docs/decisions/0010-shared-speech-and-speaker-windows.md).

A separate offline speaker-turn candidate now runs in Node, Chromium and WebKit. Two generated voices expose incorrect cluster assignments despite a correct speaker count; processing approximately 24 seconds takes 9–11 seconds on the tested desktop. It is not enabled for live captions. See [ADR 0013](docs/decisions/0013-offline-diarization-candidate.md) and [reproduction instructions](research/README.md).

### Run locally

Use Node 22.12+ (tested: 22.20.0):

```sh
cd speech-to-text
npm ci
npm run dev
```

Open the printed localhost URL. Listen selects the browser's speech service, which may send audio to its provider. The app saves neither recordings nor transcripts. Remote-device microphone testing requires HTTPS; an ordinary LAN HTTP address is insufficient. Offline app opening does not guarantee offline speech recognition.

### Verify and deploy

```sh
npm run check
npx playwright install chromium webkit
npm run test:e2e
npm run preview
```

`check` runs TypeScript, ESLint, unit tests, speaker-asset checksum verification and a production build. Browser tests use simulated recognition and synthetic microphone input; enrolment tests exercise real local inference and storage, but do not verify acoustic accuracy or phone microphones. For certificate or sandbox issues see [troubleshooting](docs/troubleshooting.md).

### GitHub Pages under H-Wilderspin

The public repository [H-Wilderspin/speech-to-text](https://github.com/H-Wilderspin/speech-to-text) is created. GitHub Pages is configured to deploy through Actions, and the `github-pages` environment permits deployment from `main`. This directory is a Git repository on `main`, with `origin` pointing to that repository.

From this directory, publish the prepared commit with:

```sh
git push -u origin main
```

Every subsequent push to `main` runs [.github/workflows/pages.yml](.github/workflows/pages.yml): install dependencies, typecheck, lint, unit tests, production build, Chromium/WebKit tests, then publish `dist/`. Pull requests run checks without publishing. Follow progress in [GitHub Actions](https://github.com/H-Wilderspin/speech-to-text/actions).

The configured address is **https://h-wilderspin.github.io/speech-to-text/**. It becomes available after the first successful deployment; deployment has not yet been verified. Open it on Pixel 8 and iPhone and follow [manual testing](docs/manual-testing.md). First check Listen/Stop and the microphone indicator, then installation. The earlier LAN address was unreachable; no physical-device pass has been recorded.

The one-time account setup is reproducible with `./scripts/setup-github-pages.ps1` in PowerShell using Git Credential Manager's existing sign-in. It creates the public repository if absent and configures Pages and its deployment environment. It does not push code or store credentials in project files. It has already been run for this repository.

The workflow assumes this app is the repository root, rather than a subfolder of a larger repository. GitHub Pages supports public repositories on GitHub Free; private repository hosting depends on the account plan. See [GitHub's Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [ADR 0005](docs/decisions/0005-github-pages-hosting.md).

Relative assets, manifest scope and service-worker scope support both a project directory ending in `/` and a root/custom-domain site. No backend, secret tokens or runtime configuration are needed. GitHub manages cache headers; no custom headers file is required. Close all app windows and reopen to apply a waiting update. This deployment includes anonymous captions, experimental local enrolment and temporary voice comparisons. Include all three public model/runtime binaries documented in [speaker assets](docs/speaker-assets.md) in the repository; the development-only speaker benchmark described below is not published.

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
5. Tap **Stop** to end microphone capture. Clear errors and actionable recovery prompts are shown if permission is denied or recognition fails.

### Enrolled speakers

1. Open a secondary **Speakers** interface, enter a display name, and record one or more short samples with the speaker's informed consent.
2. Generate and store a reusable voice embedding / voiceprint **on the device when technically feasible**. Let users inspect and delete individual profiles.
3. During listening, attribute distinct utterances to enrolled speakers where confidence is sufficient. Display **Unknown** if no enrolled speaker matches confidently.
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
| FR-01 | Must | Start/stop live transcription with **Listen** / **Stop** | Tap Listen; speech appears; Stop ends mic use. |
| FR-02 | Must | Interim and final transcription rendering | Interim revisions do not duplicate words; final segments remain stable. |
| FR-03 | Must | Readable, accessible full-screen display | Large text, text scaling, high contrast, accessible controls on phone sizes. |
| FR-04 | Must | Anonymous mode works immediately | No speaker profiles, account, or cloud service required to enter listening mode. |
| FR-05 | Must | Enrol named speaker with voice samples | Profile can be created, displayed, and deleted; permission and consent made clear. |
| FR-06 | Must* | Identify enrolled speakers | Correctly attribute clearly separated utterances when feasible, else label Unknown. |
| FR-07 | Must* | Show who said what across speakers | Transcript groups segments by speaker; changes remain visually clear. |
| FR-08 | Must | Graceful degradation | Unavailable recogniser / diarisation never blocks basic listening if STT works. |
| FR-09 | Must | Cross-platform installable PWA | HTTPS; manifest; iOS Safari and Android Chrome device checks. |
| FR-10 | Must | Data minimisation | No audio or transcript upload/storage without an explicit selected processing path. |
| NFR-01 | Must | TypeScript frontend; static deploy | Build outputs static assets; no always-on backend required. |
| NFR-02 | Must | Local-first storage and processing | Profile embeddings stored locally where feasible; transcript stays in memory. |
| NFR-03 | Target | Prompt perceived responsiveness | Interim text should normally appear within ~1 second where the selected engine permits; measure rather than promise. |
| NFR-04 | Must | Privacy and security | HTTPS, explicit microphone consent, no hard-coded secret API keys, delete enrolments. |

\* Speaker identification and diarisation are **research-dependent feasibility goals**. Do not pretend they are solved by the browser SpeechRecognition API. Document measured limits and display Unknown when recognition is unreliable.

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

- User interface to add/list/delete named speakers; explain and capture consent.
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
