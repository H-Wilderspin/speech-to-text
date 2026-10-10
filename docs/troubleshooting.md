# Troubleshooting

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
