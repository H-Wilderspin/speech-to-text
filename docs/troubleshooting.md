# Troubleshooting

## 2026-10-10 — Repeated model preparation and lost return focus

- **Cause:** disposable dialog workers only tracked readiness in memory; no persistent complete-model detection existed. Automatic cache restore then exposed a second bug: the comparison launch button lost restored focus when preparation disabled it.
- **Fix:** versioned CacheStorage for verified public model/runtime files; cache-only automatic restore on both screens, explicit network repair, and cancellation guards. Allow the comparison navigation button during model checking/preparation; navigating cancels that worker safely.
- **Verification:** Chromium completed real enrolment, offline reload and comparison with no additional model requests. The focused-button regression initially failed and passed after the fix. All 32 available Windows browser checks passed; four WebKit audio checks remain unsupported. Cache corruption, quota, absence and delayed cancellation have unit coverage.
- **Related:** [ADR 0016](decisions/0016-reuse-cached-voice-model.md). Browser cache eviction remains a legitimate reason to download missing files again.

## 2026-10-10 — Live attribution: progress and remaining overlap failure

- **Context:** local shared-clock ASR plus English embeddings; generated Hazel/Zira reference, calibration and held-out passages. No user recordings or stored profiles are used.
- **Finding:** the instantaneous VAD gate skipped embedding windows that still contained speech. Optional whole-window energy gating restored coverage. Direct enrolled-reference matching bypasses the previously failed cluster assignments: A/B/A now names 81/93 token points with 12 Unknown in the fixture, versus 10/93 previously.
- **Unresolved:** energy and agreeing embeddings do not prove one speaker. Unequal overlap still produces solo labels at eight mixed token points; the existing segmentation candidate also misses that quiet voice. Five-second segmentation output fails existing time-bound validation, so the ten-second model cannot simply be shortened.
- **Next:** follow [ADR 0017](decisions/0017-direct-live-attribution-prototype.md). Do not map browser result arrival time to microphone windows, copy synthetic thresholds into production, or describe playback schedules as annotated word truth.

## 2026-10-10 — Growing repeated captions (user-reported Pixel 8 fix)

- **Context/symptom:** the user reports that captions repeat the phrase with each new word. Android/browser versions and native event payload remain unknown.
- **Cause:** unconfirmed on the device. A fixture containing successive cumulative final slots reproduces the visual failure in the old reconciliation logic; it rendered every slot as an independent paragraph. This is a candidate explanation, not evidence of the phone's exact event sequence.
- **Change:** single-utterance native recognition with automatic application restart, plus strict cumulative-prefix normalization within each native utterance. Independent repeated utterances remain intact. See [ADR 0014](decisions/0014-persistent-listening-and-voice-stop.md).
- **Verification:** regression unit tests and Chromium/WebKit app tests show only the growing phrase once. All 112 unit tests and 30 available local browser tests passed; four existing Windows WebKit audio cases skipped. After deployment, the user reported “command stop worked and the text only writes once” on Pixel 8. This verifies the reported symptom's resolution in their test, without establishing the exact native event cause or broader browser behaviour.
- **Prevention:** preserve raw final slots for interrupted interim recovery, scope normalization to one native utterance, and retain fixtures for both provider-like cumulative output and intentional repetitions. No personal transcript or audio is logged.

## 2026-10-10 — Windows sandbox blocks build-tool configuration

- **Context:** Node 22.20.0, Vite 7.3.7/Vitest 3.2.7, restricted Windows workspace.
- **Symptoms:** npm could not write its user cache (`EPERM`). After dependencies installed, esbuild reported `Cannot read directory "../..": Access is denied` while loading `vite.config.ts`.
- **Root cause:** filesystem permissions outside the workspace, confirmed by successful execution of the same commands with approved permissions.
- **Solution:** approve `npm install` and `npm run check` outside the restricted sandbox when requested. No app/config workaround or disabled security setting is needed.
- **Verification:** install succeeded; typecheck, lint, 32 unit tests and production build passed under approved execution.
- **Prevention:** distinguish build-tool access errors from application defects; retain the lockfile and documented Node version.

## 2026-10-10 — Generated offline worker missed shell assets

- **Context:** custom Vite `generateBundle` hook.
- **Symptoms:** initial `dist/sw.js` lacked `index.html`, and a precache marker remained in executable code.
- **Root cause:** Vite emits HTML after this hook; first-occurrence string replacement replaced a marker in an ESLint comment instead of the declaration.
- **Solution:** explicitly enumerate `index.html`, hash source HTML, use `replaceAll` and remove the duplicate marker comment.
- **Verification:** generated worker contains all explicit assets and no unresolved markers; production browser offline-reload regression tests passed in Chromium and WebKit, at root and a subdirectory.
- **Prevention:** keep the service-worker browser test in `npm run test:e2e`; include HTML and icon changes in the cache version.

## 2026-10-10 — Playwright download certificate chain

- **Context:** Node 22.20.0 on Windows; Playwright 1.64.0 needed browser revisions different from the existing local cache.
- **Symptoms:** browser download failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.
- **Root cause:** Node's default trust configuration could not validate the download certificate chain. The exact certificate issuer was not investigated.
- **Solution:** use the OS certificate store for the installation process, keeping verification enabled. In PowerShell: `$env:NODE_OPTIONS = '--use-system-ca'`, then `npx playwright install chromium webkit`. Preserve existing Node options if your shell already defines them; do not disable TLS verification.
- **Verification:** download succeeded and Chromium/WebKit launched for the 16 passing browser tests.
- **Prevention:** install the browsers matching the pinned Playwright version; use `--use-system-ca` on managed Windows machines when their trusted certificates are needed.

## 2026-10-10 — Chromium opened a blank shell offline

- **Context:** Chromium 156, Vite preview, service-worker precache.
- **Symptoms:** cached HTML loaded but JS/CSS requests fell through to the disconnected network; WebKit passed the same scenario.
- **Root cause:** trace showed module requests with an Origin header and host responses with `Vary: Origin`. Precache request headers differed, so header-sensitive cache matching missed the enumerated public files.
- **Solution:** match the exact allowlisted URL with `ignoreVary: true`. This is only valid because these are public, invariant build assets; dynamic or personalized requests are never intercepted/cached.
- **Verification:** root and subdirectory offline reloads passed in Chromium and WebKit.
- **Prevention:** preserve the cross-browser offline regression and the strict request allowlist.

## 2026-10-10 — WebKit did not restore dialog trigger focus

- **Context:** desktop WebKit 27.2 with iPhone emulation.
- **Symptoms:** after tapping Speakers and pressing Escape, focus did not return to the trigger.
- **Root cause:** relying on native dialog focus restoration was insufficient when the tapped trigger was not the previously focused element in this browser.
- **Solution:** hold the trigger ref and explicitly focus it in the dialog close callback.
- **Verification:** focus entry, Escape closing and trigger restoration passed in both tested engines.
- **Prevention:** retain dialog focus assertions; still verify VoiceOver on a physical iPhone.

## 2026-10-10 — Speaker experiment failed before browser inference

- **Context:** research runtime initially emitted as CommonJS/UMD and loaded through a classic worker on Vite's development server.
- **Symptoms:** Node inference succeeded but the browser worker failed before reporting model inference; the UI recovered with a worker-load error.
- **Root cause:** the initial classic-worker loading arrangement was incompatible with the development module pipeline. The exact generated statement was not isolated, so a narrower syntax diagnosis is not claimed.
- **Solution:** emit native Emscripten ES-module output (`-sEXPORT_ES6=1`, `.mjs`), import it from a module worker, and reuse that module in Node. No eval or global `importScripts` bridge.
- **Verification:** the final Node module and both browser workers produced three valid embeddings each; browser cancellation and aborted model requests recovered successfully.
- **Prevention:** keep the research browser smoke runner alongside the Node check. Do not assume a Node-only inference pass proves browser loading compatibility.

## 2026-10-10 — Windows WebKit has no Web Audio capture APIs

- **Context:** Playwright 1.64.0, desktop WebKit 27.2 on Windows, secure localhost; iPhone viewport does not change the engine's compiled capabilities.
- **Symptoms:** full enrolment tests could not press Prepare because the application correctly reported local recording unsupported. The initial synthetic microphone fixture also failed to install.
- **Root cause:** direct page inspection returned `undefined` for `navigator.mediaDevices`, `AudioContext`, `AudioWorkletNode` and `OfflineAudioContext`, with `isSecureContext === true`. This is a test-runtime capability limit, not evidence about physical iPhone Safari.
- **Solution:** keep the product's feature-detected fallback. The fixture explicitly skips the four audio-dependent tests only for this Windows/WebKit configuration after checking capability. Other platforms must satisfy the APIs to run those tests. Continue testing profile deletion, unavailable storage, accessibility and anonymous flows in both engines.
- **Verification:** Chromium completed real AudioWorklet/resampling/WASM/IndexedDB enrolment. WebKit exercised the unsupported-recording message and disabled Prepare control; physical Safari capture remains pending.
- **Prevention:** do not present desktop WebKit viewport emulation as iOS microphone coverage. Keep skip reasons and device gates visible in reports.

## 2026-10-10 — Streaming recognizer initialization returned null

- **Context:** isolated English Zipformer WASM experiment, sherpa source `9db1af1871ed78cee9357c23898e5a7d8702d21a`.
- **Symptoms:** valid model files were staged but recognizer creation returned null before audio input.
- **Root cause:** explicitly setting `modelingUnit: 'bpe'` triggers a requirement for a SentencePiece vocabulary file in `OnlineModelConfig::Validate`, even with hotwords unused. This parameter is used for hotword encoding; the recognizer still decodes the supplied BPE token table without it. WASM validation logs go to stdout, not just stderr, which initially hid the diagnostic.
- **Solution:** retain the upstream no-hotword default `modelingUnit: 'cjkchar'`; collect stdout/stderr only during initialization and disable diagnostic collection before audio input.
- **Verification:** Node, Chromium and WebKit produced timestamped utterances across endpoint reset using the staged quantized models.
- **Prevention:** consult the wrapper and native configuration validation together; model family and optional hotword configuration have distinct meanings.

## 2026-10-10 — Whole-region speaker inference exceeded the live queue budget

- **Context:** shared single-threaded WASM ASR/VAD/English embedding experiment on Windows, Node 22.20.0. Capture permits eight unacknowledged 100 ms frames.
- **Symptoms:** a ten-second generated speech region took 909 ms to embed, producing a 911 ms processing step. A live producer cannot safely wait this long with its current queue budget.
- **Root cause:** embedding cost grows with input duration; delaying all work until a long speech region ends creates a processing burst. Separately, native VAD's maximum-duration setting only adjusts thresholds and cannot guarantee a hard region-storage limit.
- **Solution:** keep a three-second PCM ring and compute bounded windows at most every 1.5 seconds when current VAD state reports speech. Force marked VAD window cuts every 10.24 seconds without resetting the sample clock. These cuts and windows do not prove a speaker turn.
- **Verification:** Node maximum processing steps fell below 310 ms in these fixtures; Chromium's complete capture/pipeline run peaked at 381 ms without queue overrun. Forced-cut and sample-window tests verify continuity and exact sample values. Physical-phone throughput is unverified.
- **Prevention:** benchmark worst processing bursts and simultaneous model memory, not only average real-time factor. Preserve the explicit overrun stop and Unknown labels until turn/identity evidence exists. Related: ADR 0010.

## 2026-10-10 — VAD failed after two minutes of repeated speech

- **Context:** combined WASM pipeline, Node 22.20.0/Windows, generated speech with three-second gaps, forced 10.24-second VAD cuts.
- **Symptoms:** `spike:pipeline-stress -- 3` reproducibly rejected a zero-length region at sample 1,966,080 after processing 1,969,152 samples (123.072 seconds). The short 24-second continuous fixture passed.
- **Root cause:** using native Flush midstream without resetting. Flush is documented for final input; outer region state was cleared while Silero's pending-silence state survived. Source inspection explains the empty sample range after continuing input.
- **Solution:** flush/drain, reset native VAD, and add the analysis-window starting offset to subsequent native indices. Keep capture/ASR clocks continuous and reject malformed spans. This changes the implementation detail in ADR 0010; see ADR 0012.
- **Verification:** the formerly failing three-minute input completed with exact sample-slice and monotonically increasing ASR-final checks. The unit fixture now refuses continuation after Flush without Reset and verifies global indices across resets. Longer-run results are in feasibility.
- **Prevention:** test repeated silence transitions across many window cuts, and distinguish end-of-stream APIs from streaming operations. Mapping indices correctly does not establish speech-boundary accuracy near a reset.

## 2026-10-10 — Correct cluster count with incorrect speaker assignments (Unresolved)

- **Context:** offline pyannote 3.0 int8 segmentation plus English ERes2Net, sherpa source `9db1af1`, Windows Node 22.20.0 / Chromium 156 / WebKit 27.2; default unknown-count clustering distance 0.5.
- **Symptoms:** generated A/B/A reports two speakers but splits A's first solo clip between both clusters. A/B overlap reports two simultaneous clusters and then reuses A's earlier cluster for B's solo speech.
- **Cause:** the output is demonstrably inconsistent with the exact generated playback schedule. The relative contribution of segmentation, embedding extraction and clustering has not been isolated; do not attribute this to a particular model component yet.
- **Containment:** keep the candidate outside live captions. Preserve clusters as per-call anonymous metadata. Do not force two clusters, tune identity thresholds on these two voices, or treat a correct count as successful attribution.
- **Verification:** `npm run spike:diarization` and `npm run spike:diarization-browser` reproduce identical segment/cluster output in all three engines. Browser worker termination keeps cancellation responsive during expensive inference.
- **Next:** isolate local segmentation from cross-window clustering, evaluate conservative overlap exclusion and use consented held-out human data before enabling identification. Native `NumSpeakers()` counts distinct IDs rather than promising dense numbering; the adapter preserves sparse IDs and has a regression test.
- **Follow-up:** `spike:diarization -- --local-windows` now isolates the native ten-second path, which bypasses embedding/clustering. All four alternating-voice windows return one local label. Incorrect merging therefore already exists in local segmentation for these synthetic voices; cross-window clustering is not the only issue. The overlap window similarly reuses one label for both voices' solo speech. The result remains unresolved for human speech; obtain consented held-out evidence rather than treating lower latency as successful diarization.
- **Related:** [ADR 0013](decisions/0013-offline-diarization-candidate.md), [measurements](feasibility.md).

## 2026-10-10 — Worker-download failure simulation bypassed in Linux WebKit

- **Context:** first GitHub Actions Linux run, WebKit 27.2, real local enrolment worker. Windows WebKit cannot run this audio-dependent test and had skipped it locally.
- **Symptoms:** `page.route` was set to abort `embedding.onnx`, but preparation reached Ready instead of the expected download error. The other 31 browser tests passed; deployment correctly stopped.
- **Cause:** the page-level interception did not make the dedicated worker's model fetch fail in this environment. The exact WebKit routing mechanism was not isolated; this was a failed fault injection rather than evidence that the app ignored a failed download.
- **Solution:** the test now serves the real production app through a temporary loopback HTTP server, returning HTTP 503 for the model file. It asserts that the server actually received and rejected the model request, checks the app's error/retry state and verifies no microphone was requested. The production worker, model checksums and error handling are unchanged.
- **Verification:** focused Chromium regression and all 87 unit tests/typecheck/lint/build passed locally. The next Linux run passed this test, including WebKit. That run exposed a separate intermittent comparison timeout; its assertion now reports the actual comparison status for diagnosis, rather than only a missing success element.
- **Prevention:** verify a simulated fault actually occurs; use a real server response when browser interception cannot cover worker traffic. Do not skip the model failure check to publish. [First failure](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38051147409), [follow-up run](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38051447339).

## 2026-10-10 — Linux WebKit synthetic microphone sometimes records silence

**Follow-up:** the same too-quiet comparison recurred in the [layout deployment](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38055482454) at commit `23b61f0`; 35 browser tests passed and one failed. The silent-output connection described below did not eliminate the intermittent synthetic-source problem. Production recording correctly rejected the input, and publication was blocked. One unchanged retry also failed, this time awaiting the first saved profile; that assertion did not expose the recording status, so the second failure's exact cause is unconfirmed.

**Revised fixture:** synthesize the 173 Hz tone in the application's recording AudioContext when it asks for the fixture's media source. Keep real MediaStream tracks for permission/cancellation cleanup, real AudioWorklet collection, resampling, quality checks, WASM inference and IndexedDB. The test now explicitly replaces both getUserMedia and the synthetic stream's MediaStreamAudioSourceNode, avoiding cross-context OS audio routing. It does not establish correctness of a real microphone source node; physical tests remain required. An enrolment status assertion now exposes errors directly. Production recording thresholds and capture code are unchanged. Verification of this replacement is tracked in feasibility notes.

**Replacement verification:** all eight local Chromium speaker tests and all 36 Linux Chromium/WebKit tests passed with the revised fixture at `bd7154d` ([successful workflow](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38056062154)). The layout then deployed and passed published-site checks. This verifies the replacement in those runs, without claiming that the earlier native cross-context routing issue was repaired.

- **Context:** full Linux CI suite; the test creates an oscillator feeding a MediaStream destination, consumed by the application's separate recording AudioContext.
- **Symptoms:** enrolment succeeded but the later comparison sometimes failed. An assertion on the actual status revealed `The recording was too quiet. Move closer and try again.` The app correctly rejected the silent input rather than producing a voiceprint. An initial diagnostic selector also matched the similarity `<output>`'s implicit status role; it now explicitly selects the status paragraph.
- **Cause:** silence was observed in this generated cross-context test path. An idling source graph with no connection to its own output destination was the working hypothesis; physical microphone behaviour was not implicated or tested by this result.
- **Solution:** also connect the generated signal through a zero-gain node to the source context's destination, keeping the source graph rendering without playing a tone. Closing the synthetic track still closes that context. Do not reduce the app's quality threshold or skip the comparison.
- **Verification:** local checks and both affected Chromium tests passed (Windows WebKit audio remains unavailable). The subsequent full Linux [run](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38051991375) passed all 32 browser checks in 51.6 seconds and deployed successfully. This verifies the observed test correction, not universal WebKit audio reliability.
