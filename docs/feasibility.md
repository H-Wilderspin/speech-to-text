# Feasibility evidence

## 2026-10-10 — M1 browser adapter

- **Hypothesis:** anonymous captions can be isolated from provider-specific APIs, with reliable app-side interim replacement and lifecycle handling.
- **Setup:** Windows workspace; Node 22.20.0; React/Vite/Vitest versions pinned in `package-lock.json`. Simulated recognizers produce complete result snapshots, late callbacks, errors and missing end events. No speech recordings used.
- **Observed:** all 32 initial unit tests passed, including 19 lifecycle tests, 4 reconciliation tests, and 9 speaker-boundary experiments. Typecheck, lint and production build passed.
- **Not measured:** physical microphone behavior, acoustic recognition accuracy, speech-to-caption latency, permission timing on iOS/Android, thermals, battery and real inference memory. The 550 ms initial unit-suite duration is a test-run duration, not speech latency.
- **Conclusion:** automated evidence supports the state/reconciliation logic only. No family-device acceptance gate is closed by these tests.
- **Source:** [Web Speech specification](https://webaudio.github.io/web-speech-api/). Event timestamps are not per-result audio spans. Newer optional audio-track/local-processing APIs do not establish deployed target-device support.

### Automated production-browser evidence

- **Executed:** 16 Playwright 1.64.0 checks passed on Windows: 8 each in Chromium 156.0.8078.4 and desktop WebKit 27.2 (iPhone 13 viewport/user-agent emulation). Unit checks: 32 passed. TypeScript 5.9.3, ESLint 9.39.5 and Vite 7.3.7 production build passed; React/React DOM 19.3.0. Exact dependencies are in the lockfile.
- **Scenarios:** interim replacement/final stability, Stop/restart/Clear/reload, no local/session storage, permission-denial recovery, unsupported API, modal focus/Escape, pagehide abort, 320 CSS px layout with 56 px captions, preserving old-text scroll position, return to newest text, offline shell at root and `/speech-to-text/`, scoped worker registration and PNG icon delivery.
- **Failures reproduced and fixed:** WebKit modal return focus; Chromium cache lookup with `Vary: Origin`; generated precache inclusion. See [troubleshooting](troubleshooting.md).
- **Build:** approximately 234 kB JavaScript (73.4 kB gzip), 5 kB CSS (1.8 kB gzip), plus HTML/manifest/worker/icons; no speech models in `dist/`. These are build sizes, not network startup or memory benchmarks.
- **Evidence limits:** recognition was injected, no physical microphone used. No actual Android, iOS, installed PWA, VoiceOver/TalkBack, incoming-call, real network-service or acoustic tests. No ML inference occurs in this app, so model-load failure testing is deferred with M2/M3.
- **User's target devices:** Pixel 8 and an iPhone of currently unknown model; OS/browser versions and physical observations remain pending. Steps are in [manual testing](manual-testing.md).

## 2026-10-10 — Existing sherpa speaker artifact audit

- **Hypothesis:** the available diarization WASM artifact can also extract reusable voice embeddings for M2.
- **Method:** `npm run spike -- ../hands-free-transcribe/public/sherpa/sherpa-onnx-wasm-main-speaker-diarization.js`. The tool reads the JS wrapper and packaged artifacts, compiles (does not instantiate) the WASM, and checks exposed API names. It does not record or process speech. Any compatible artifact directory may be passed; the adjacent repository is not an application dependency.
- **Environment:** Windows, Node 22.20.0. One artifact inspected; adjacent extracted distribution directory is labelled v1.13.7, but artifact SHA256 below is the precise identity.
- **WASM SHA256:** `d99e64e62f2d78652457bf45cb7608181fcd70efed47d3e9d23c862372305eb6`.
- **Measured on disk:** JS 81,899 bytes; WASM 12,364,192 bytes; packaged model data 45,587,685 bytes; 20 WASM exports. These are file sizes, **not runtime memory measurements**.
- **Observed bindings:** `SherpaOnnxCreateOfflineSpeakerDiarization` and `SherpaOnnxOfflineSpeakerDiarizationProcess` present; `SherpaOnnxCreateSpeakerEmbeddingExtractor` and `SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding` absent from this wrapper.
- **Source inspection:** local sherpa commit `9db1af1871ed78cee9357c23898e5a7d8702d21a`, `wasm/speaker-diarization/CMakeLists.txt`; upstream [build configuration](https://github.com/k2-fsa/sherpa-onnx/blob/master/wasm/speaker-diarization/CMakeLists.txt) similarly exposes offline diarization only and configures 512 MB initial WASM memory plus growth. Configuration is not an observed peak/RSS benchmark.
- **Result:** this wrapper cannot meet reusable-embedding enrolment as-is. Offline cluster numbering must not be presented as a recognised identity. A custom export build remains possible but unbenchmarked.
- **Licence/deployment investigation:** sherpa and [3D-Speaker](https://github.com/modelscope/3D-Speaker) use Apache-2.0 project licences; separately review exact model artefacts and attribution before distribution. The [pyannote segmentation-3.0 model card](https://huggingface.co/pyannote/segmentation-3.0) lists MIT and gated source access and describes 10-second, 16 kHz input. No model has been downloaded, redistributed or integrated into this app. CORS is unnecessary if approved artifacts are hosted with the static site; no third-party API/pricing commitment was made.
- **Not measured:** model startup, inference time, embedding accuracy, overlap, real-time factor, phone memory or battery. No consented voice samples or target devices were available in this run.
- **Decision:** [ADR 0003](decisions/0003-speaker-pipeline-feasibility-gate.md). Keep anonymous captions usable and run the following bounded experiment before M2/M3 implementation.

## 2026-10-10 — Isolated embedding inference in Node and browser workers

- **Hypothesis:** an available custom sherpa build can be relinked into a smaller speaker-only runtime with real reusable embedding output.
- **Discovery:** `build-wasm-simd-vad-asr/bin/sherpa-onnx-wasm-main-vad-asr.js` exposes both extractor creation and computation, unlike the previously audited diarization wrapper. The custom input WASM SHA256 is `36dc4052b2ee85cdbff029e31161d5d370eb843d4b393cd84b0f437ea4a30210`; its model preload was 372,421,566 bytes. This does not change the earlier finding about the different standard artifact.
- **Build:** `npm run spike:build-speaker` relinks existing sherpa libraries (source checkout `9db1af1871ed78cee9357c23898e5a7d8702d21a`) with Emscripten 4.0.23, `-O3`, SIMD, one inference thread, ES-module output, 64 MiB initial memory and growth enabled. No ASR/VAD model preload. Separate original build files were not modified.
- **Final artifact:** `speaker-runtime.mjs` 75,294 bytes; WASM 12,576,592 bytes, SHA256 `e7180cc64e8472a9d98befe62de29c72f849322f86eba5d9ddc833f073092181`.
- **Model:** 39,593,761 bytes, SHA256 `1a331345f04805badbb495c775a6ddffcdd1a732567d5ec8b3d5749e3c7a5e4b`, extracted locally from the standard package. It matches `3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx` in the [maintainer's artifact record](https://huggingface.co/csukuangfj/speaker-embedding-models/commit/8be2a75c9ed7a590538b268e46fbb65e1aa9d208). Embedded metadata: 3D-Speaker, Chinese, 16 kHz, 512 dimensions, sample normalization on, global-mean feature normalization. This is an experimental candidate, not a final English-language model selection.
- **Method:** a deterministic three-second multi-frequency signal at 16 kHz, three consecutive inferences per runtime. Fresh extractor/runtime per environment; repeated samples share that instance. PCM/embedding values are not printed or persisted. Browser requests use the local Vite server. This is not human speech and cannot measure match accuracy.

| Runtime on this Windows machine | Runtime init | Model load | Inference runs (ms) | WASM linear memory after each inference |
|---|---:|---:|---|---:|
| Node 22.20.0, final ES module | 33 ms | 236 ms | 286, 245, 272 | 96,665,600 bytes |
| Chromium 156.0.8078.4 worker | 19 ms | 245 ms | 273, 242, 248 | 96,665,600 bytes |
| Desktop WebKit 27.2 worker | 32 ms | 141 ms | 264, 246, 246 | 96,665,600 bytes |

- **Observed:** all nine final inference outputs were finite, nonzero 512-dimensional embeddings. Browser completion was 1,172 ms (Chromium) / 1,279 ms (WebKit), including local loading. Cancellation terminated the worker and re-enabled Run. Deliberately aborting the model request produced a recoverable error in both engines. An earlier Node/CommonJS run also passed (254–298 ms), before the module-worker integration was fixed.
- **Limits:** three repetitions of one synthetic signal per engine, one Windows host. No independent speech samples; no similarity/false-match measurement; no mobile inference; no battery/thermal test; linear memory is not total/peak process memory. Small timing differences between engines are not statistically meaningful.
- **Reproduction:** [research/README.md](../research/README.md); `npm run spike:infer`, `npm run spike:browser`. The browser runner requires the development server on port 5178 or `SPEAKER_BENCHMARK_URL`. Generated runtime/model files are ignored and excluded from the production bundle.
- **Decision:** [ADR 0004](decisions/0004-isolated-speaker-runtime-experiment.md). Embedding API availability is no longer the integration blocker. Model suitability, physical-device behavior, consented enrolment/storage, calibration and shared ASR timing remain work to do.

## Remaining device/model experiment

1. Finalize an appropriate licensed model for target speech and record its URL, checksum, version and preprocessing. The candidate above already has a cancellable worker and synthetic runtime measurements; compare an English-trained candidate before production selection. Discard PCM immediately after inference and do not persist raw audio.
2. With informed consent, use at least 3 enrolled participants and 2 unknown participants. Record 3 enrolment utterances and 10 held-out test utterances each across 2 sessions, near/far microphone positions and quiet/noisy rooms. Use anonymous test IDs in aggregate reports. Do not commit recordings, embeddings or identifiable transcripts.
3. On a named iPhone and Android device, record cold/warm load time, p50/p95 per-utterance processing time, peak memory where measurable, app termination, and battery change over a 15-minute session (with a matched idle baseline). Measure speech-to-interim delay against a reference clock; report sample counts and failed runs.
4. Calibrate same/different-speaker score distributions using a development split; evaluate false accept/reject and Unknown rates on held-out sessions. Do not choose a universal cosine threshold from synthetic tests. Set the acceptable false-match rate with the product owner before enabling names.
5. Prototype shared 16 kHz capture via AudioWorklet, streaming ASR with real sample-index spans, voice activity/turn segmentation, and embeddings in workers. Compare two speakers taking turns, unknown voices, noisy speech and overlap; measure delay and diarization/identity errors separately. Silence detection alone is not speaker diarization.
6. Exercise the experimental consent UI and versioned IndexedDB profiles added under ADR 0006, including individual deletion/clear-all and storage failure. Model migration and confidence calibration remain prerequisites before comparing incompatible profiles or enabling identities. Keep an anonymous fallback if the worker or model cannot load.

## 2026-10-10 — English model and experimental enrolment integration

- **Model:** English ERes2Net VoxCeleb ONNX, 26,485,263 bytes, SHA256 `c59158379255ad66e161679cca6af8d52d51e389e3224ab7d7a7baae295c2db5`, 192 dimensions, 16 kHz mono with native sherpa preprocessing. Exact provenance/licences are in [speaker assets](speaker-assets.md).
- **Node measurement:** Windows, Node 22.20.0, the same WASM checksum as the earlier experiment. `npm run spike:infer -- embedding-en.onnx` processed the same synthetic three-second signal three times. Runtime initialization 36 ms; model load 223 ms; inference 300, 255, 270 ms. All outputs finite/nonzero. Linear memory 67,108,864 bytes after the first inference and 80,543,744 after later inferences; not peak process memory.
- **Scope:** real local voiceprint extraction, consented capture, model-specific schema, local profile persistence and deletion implemented. Worker loads only on Prepare; the model is excluded from service-worker precaching. See ADR 0006 for the deliberate experimental integration before physical acceptance.
- **Executed checks:** typecheck, lint, 53 unit tests, pinned-asset verification and production build passed. The production browser suite passed 28 checks, with four explicit Windows WebKit skips because that runtime has no Web Audio/capture APIs. Chromium 156 completed the real eight-second synthetic AudioWorklet → 16 kHz resampling → English WASM → IndexedDB path, persistence/reload and deletion, plus pagehide/late-permission cleanup and model-download cancellation/failure. Desktop WebKit 27.2 passed profile clear-all, unavailable storage, unsupported-audio messaging, layout and the existing caption/offline checks. The full Chromium enrolment/deletion test was then rerun at `/speech-to-text/` and passed (WebKit capture skipped for the same reason). No tests used a physical microphone.
- **Distribution:** approximately 250 kB app JS, 3.4 kB worker, 1.1 kB AudioWorklet, 5.7 kB CSS, plus the lazy 39.1 MB public runtime/model and notices. Artifact inspection confirmed no private research files and no model precache entries. Large-system-text speaker form checks passed at 320 CSS px in both engines. GitHub-hosted workflow execution remains pending publication.
- **Limits:** synthetic evidence is not a voice accuracy measurement. Phone startup/memory/thermals/battery, real microphone behaviour, near/far/noisy speech, cross-session matching, false acceptance/rejection and M3 timing remain unmeasured. No speaker names are attached to captions.

## 2026-10-10 — Streaming ASR input-clock experiment

- **Candidate:** `sherpa-onnx-streaming-zipformer-en-20M-2023-02-17`, English, greedy decoding, one CPU thread, 16 kHz mono, endpoint trailing silence 1.2 seconds after speech. Apache-2.0 model card; exact upstream record is linked in ADR 0007. The `modelingUnit` setting controls the optional hotword encoder, not decoding of the model's BPE token table; the no-hotword experiment uses the wrapper's default setting.
- **Model bytes / SHA256:** encoder 42,845,182 / `3810755ce7c3ab26b42a8bcf39d191308fa27fb0f53358823ba46141d03b7eb3`; decoder 539,499 / `21e2a2acd961b3ac72f55be2f10f1a285e1b0b0ba010d7c0b6eab141411b163c`; joiner 259,572 / `e085d73b593cf9b0707f370dbd656d58327d3fe36d80d849202ef81df02cb01e`; tokens 5,048 / `49e3c2646595fd907228b3c6787069658f67b17377c60aeb8619c4551b2316fb`.
- **Runtime:** existing sherpa source/static libraries, Emscripten 4.0.23, no preload, 64 MiB initial memory with growth. Module 75,773 bytes; WASM 13,437,070 bytes, SHA256 `44a4695463074c140de3021cf70bdd278700fa775a5ede45786613affaae9d5f`. All ASR assets remain private research, excluded from `dist/`.
- **Input/method:** one 6.91-second fixed synthetic sentence generated with Microsoft Hazel Desktop, repeated twice with three-second gaps including the tail, total 19.82 seconds / 317,120 samples. Two runs per engine using a fresh stream for each run, 199 input blocks of at most 1,600 samples. Blocks were fed as fast as processing allowed; this is not a real-time microphone test.

| Windows runtime | Runtime init | Model init | Processing runs | Per-block p95 | Linear memory after runs |
|---|---:|---:|---|---:|---:|
| Node 22.20.0 | 37 ms | 304 ms | 826, 772 ms | 14 ms | 80,543,744 bytes |
| Chromium 156.0.8078.4 worker | 27 ms | 278 ms | 800, 740 ms | 13 ms | 80,543,744 bytes |
| Desktop WebKit 27.2 worker | 40 ms | 189 ms | 846, 821 ms | 15 ms | 80,543,744 bytes |

- **Observed timing:** every run produced 26 interim changes and two endpoint results. First segment: start offset 0, 23 token points spanning 2.32–6.20 seconds. Second segment: start offset 10.24 seconds, 31 token points with absolute times 10.40–16.08 seconds. All observed token points were monotonic within a segment and within the submitted sample clock. First text appeared after 2.7 seconds of accepted samples in every run. These are token emission points; acoustic boundary accuracy was not measured.
- **Browser behavior:** complete page runs including local fetch took 2,474 ms in Chromium and 2,333 ms in WebKit. Both recovered from worker cancellation and an aborted encoder request. WebKit's lack of Web Audio on Windows does not prevent this worker-only inference check.
- **Limits/next action:** six runs repeat one synthetic utterance. No word error, acoustic boundary, multiple-human-speaker, phone, battery, live queue or ASR+speaker concurrent-memory test. Investigate differing token counts and startup delay; build shared capture/queue and actual speech/turn boundaries before attaching identities. See ADR 0007.

## 2026-10-10 — Synthetic ASR startup sensitivity

The follow-up `npm run spike:asr-startup` used the same Windows host, Node 22.20.0, quantized models and Microsoft Hazel Desktop fixture. Each fresh stream received the single 18-word, 6.91-second generated phrase, varying preceding silence and three seconds of trailing silence. Blocks were processed as fast as possible. Word edits compare the concatenation of all final endpoint text against the reference, not each segment independently; reports omit the recognized text.

| Leading silence | First interim after fixture begins | Word edits / reference words | Processing time |
|---|---:|---:|---:|
| 0 seconds | 2.7 seconds | 8 / 18 | 433 ms |
| 0.5 seconds | 2.5 seconds | 7 / 18 | 383 ms |
| 1 second | 1.1 seconds | 0 / 18 | 408 ms |
| 2 seconds | 1.0 seconds | 0 / 18 | 443 ms |
| 3 seconds | 1.0 seconds | 0 / 18 | 492 ms |

The half-second case produced two endpoints, the others one. All runs retained 80,543,744 bytes of WASM linear memory; per-block p95 was 12–14 ms. These observations reproduce the earlier startup/token-count discrepancy and show sensitivity to initial silence on one generated phrase. They do not establish a universal padding fix, real-time latency, acoustic boundaries or human speech accuracy. Production ASR remains unchanged. Next: isolate model/decoder startup behaviour with independent fixtures while developing a shared microphone clock.
