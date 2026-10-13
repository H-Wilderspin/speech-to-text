# Speaker runtime experiment

## Local pipeline comparison (2026-10-13)

The [comparative benchmark](../docs/comparison-benchmark.md) runs the production
local ASR/window components, existing delayed diarizer and CPU Whisper against
the same eight generated fixtures. It includes repeat/silence failure cases,
strict temporal joins, separately labelled oracle diagnostics and reproducible
Python pins. Models/audio stay in ignored `private/comparison`; no API access or
production changes are required. See that report for the sequential commands,
results and limits. This does not benchmark browser speech recognition or modern
pyannote Community-1.

## Direct enrolled-voice attribution prototype

After preparing the existing shared pipeline, run:

```sh
npm run spike:generate-attribution-fixtures
npm run spike:attribution
```

This experiment uses the installed Microsoft Hazel/Zira desktop voices, with
different profile, calibration and held-out passages. It requests no microphone
and never reads saved user profiles. WAV fixtures remain ignored under
`research/private/attribution-fixtures/`. `-- --verbose` prints window scores,
not audio, vectors or transcripts. Node 22.20.0 is tested (native TypeScript type
stripping loads the production cosine function).

The actual shared ASR/embedding runtime processes ordered 100 ms audio frames.
Three-second embeddings at 1.5-second strides are compared directly to references,
bypassing the failed anonymous-cluster reconciliation. Optional whole-window
energy gating avoids discarding speech windows when instantaneous VAD is silent;
it does not prove a window contains speech. A token point needs two agreeing
windows, a calibrated score/margin, and three seconds of subsequent audio before
a name can commit. Token timestamps are not fabricated into word durations.

The two-voice synthetic calibration is confined to this runner and is never
saved or shipped as a production threshold. The leave-one-out case treats Zira
as unenrolled while retaining calibration that has seen that voice; it is not
unseen-speaker validation. Counts compare token points to exact playback
schedules, including pauses, and are not human accuracy or diarization error rate.
Unequal overlap exposes a remaining failure. See [ADR 0017](../docs/decisions/0017-direct-live-attribution-prototype.md)
for measurements and the concrete production integration path. The production
browser recognizer still supplies no identities.

After preparing the existing diarization runtime, `npm run spike:overlap-veto`
tests it as an independent mixed-speech rejection signal. Equal-level overlap is
detected, while the 20%-amplitude second voice is missed. `-- --short` reproduces
the five-second-window output validation failure; do not use that as a live path.

This directory retains the isolated, real-inference experiment for M2. Its page and private data are excluded from the production app. It uses synthetic audio only: valid embeddings and fast inference do not establish speaker accuracy. The app now separately includes an English model and experimental consented enrolment under [ADR 0006](../docs/decisions/0006-experimental-local-enrolment.md).

## Reproduce on the current Windows build workspace

Prerequisites: the existing sherpa-onnx static-library build at `../../sherpa-onnx/build-wasm-simd-vad-asr` and Emscripten 4.0.23 at `../../emsdk`, both relative to this directory. The scripts only read these dependencies and never modify their source/build artifacts. The build script accepts `-SherpaBuild` and `-Emsdk` overrides. It is a relink experiment, not a from-scratch portable sherpa build recipe.

```sh
npm run spike:build-speaker
npm run spike:extract-model
npm run spike:infer
npm run dev -- --port 5178 --strictPort
```

With the development server running, open `/research/speaker-benchmark.html` and click **Run synthetic benchmark**, or run `npm run spike:browser` in another shell. `SPEAKER_BENCHMARK_URL` can override the browser runner's default URL. The browser runner uses Chromium and WebKit, checks real finite 512-dimensional outputs, cancellation, and recovery from a blocked model request.

The extraction script reads the file table and bytes from the adjacent project's existing `sherpa-onnx-wasm-main-speaker-diarization.{js,data}` package. Pass another wrapper path as its argument if needed. It never executes the wrapper while extracting. Outputs go to ignored `research/private/speaker-runtime/`. This Chinese research model is not shipped; the public English model and paired runtime are documented separately in [speaker assets](../docs/speaker-assets.md).

For the English Node comparison, download the pinned English model from that document into `research/private/speaker-runtime/embedding-en.onnx`, then run `npm run spike:infer -- embedding-en.onnx`. The smoke runner validates output without assuming the Chinese model's 512 dimensions; the English output is 192. The browser research page remains the original Chinese experiment. Production enrolment browser tests use the English model.

## Artifact identity and preprocessing

The extracted model is `3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx`, 39,593,761 bytes, SHA256 `1a331345f04805badbb495c775a6ddffcdd1a732567d5ec8b3d5749e3c7a5e4b`. This matches the [sherpa maintainer's model artifact](https://huggingface.co/csukuangfj/speaker-embedding-models/commit/8be2a75c9ed7a590538b268e46fbb65e1aa9d208). Its embedded metadata identifies 3D-Speaker, Chinese training language, 16,000 Hz input, 512 outputs, sample normalization enabled, and global-mean feature normalization. Sherpa's extractor performs preprocessing; the wrapper supplies mono float PCM and does not independently reproduce log-mel computation.

This artifact is a runtime feasibility candidate, not an approved final model for the English-language app. Cross-language, cross-session, unknown-speaker and microphone performance remain unmeasured. Review the exact model licence, notices and all linked library licences before shipping binaries. The [3D-Speaker project licence](https://github.com/modelscope/3D-Speaker/blob/main/LICENSE) alone should not be treated as a complete third-party-notices inventory.

## Measurement and privacy boundaries

- Runtime, model load, per-inference time and WASM linear memory are reported separately. Linear memory is not total browser process memory, peak native allocations or battery use.
- Each run computes the same deterministic three-second synthetic signal three times. Reports omit audio and embedding values, and expressly report `speakerAccuracyMeasured: false`.
- Model fetching happens only when Run is clicked. Requests are same-origin and uncached by the experiment. Cancel terminates the worker; timeout, pagehide and backgrounding stop it too. The app's service worker does not precache these files.
- PCM allocations are cleared after use; streams and native embeddings are freed. Terminating the isolated worker releases its WASM instance. No raw audio/embedding or report persistence is added.
- Synthetic similarity is not a calibration dataset. Production identity matching remains disabled; a score threshold must be derived from consented held-out human speech.

See [feasibility evidence](../docs/feasibility.md) for executed measurements and [manual testing](../docs/manual-testing.md) for required phone checks.

## Streaming ASR clock experiment

This separate experiment tests the candidate needed for M3's common audio clock. It does not change the production browser ASR adapter or enable speaker labels.

```sh
npm run spike:prepare-asr
npm run spike:build-asr
npm run spike:generate-asr-fixture
npm run spike:asr
npm run dev -- --port 5178 --strictPort
# In another terminal:
npm run spike:asr-browser
```

Preparation reads the existing public English 20M Zipformer models and JS wrapper from the adjacent sherpa checkout; an alternate checkout path can be supplied to `spike:prepare-asr`. The build script accepts `-Kind asr` in addition to its original default speaker mode. Generated files go only to `research/private/asr-runtime/`. Fixture generation requires Windows System.Speech and Microsoft Hazel Desktop, writes only an explicitly generated test phrase, and never records the microphone. `spike:asr -- <path/to/mono-16khz-PCM16.wav>` can read an explicitly selected fixture instead, without printing recognized text.

Open `/research/asr-benchmark.html` on the development server for a cancellable worker run. `ASR_BENCHMARK_URL` overrides the browser runner's default URL. It loads approximately 57 MB of research assets only when Run is selected and is excluded from the deployed site. Reports contain token counts/timing and runtime measures, not transcripts or sample values. The browser runner checks Chromium and WebKit completion, cancellation and model-download failure; microphone APIs are not needed.

Model/runtime checksums and measurements are in [feasibility](../docs/feasibility.md); [ADR 0007](../docs/decisions/0007-streaming-asr-clock-experiment.md) explains why token points must not be invented into utterance end times.

`npm run spike:asr-startup` runs that generated phrase once per fresh stream with 0, 0.5, 1, 2 and 3 seconds of leading silence. It reports aggregate word edits across all endpoint results against the fixed synthetic reference, without printing recognized text. This investigates startup sensitivity; it is not a human speech accuracy evaluation or a production padding workaround.

## Continuous local listening experiment

After the same ASR preparation/build steps, open `/research/live-asr.html` on the development server. **Prepare local ASR** loads only local assets. **Listen locally** requests the microphone, sends continuous 16 kHz frames to the ASR worker and displays temporary text labelled Unknown. Stop flushes the final partial audio frame; Cancel discards unfinished work. Backgrounding or a processing overrun stops the microphone. No text or audio is saved or uploaded. This page is not published to GitHub Pages.

`npm run spike:live-asr` exercises the actual capture adapter using the generated fixture played into a synthetic 48 kHz microphone source. It checks 16 kHz resampling, contiguous frames, local recognition, Stop draining, denied/late permission, pagehide and stalled processing. It prints timing/counts only. Windows WebKit skips capture because it lacks Web Audio and checks the fallback instead. `LIVE_ASR_URL` overrides the default localhost URL. Phone microphone tests require a reachable HTTPS development host; ordinary LAN HTTP is insufficient.

## Shared speech and speaker windows

After ASR preparation and fixture generation above:

```sh
npm run spike:prepare-pipeline
npm run spike:build-pipeline
npm run spike:pipeline
# With the development server on port 5178:
npm run spike:pipeline-browser
```

Open `/research/live-asr.html?pipeline=1` for the combined local experiment. Prepare loads approximately 85 MB including the ASR, small Silero VAD and public English embedding model. The pipeline uses one WASM instance, bounds speech-region storage, and extracts three-second speaker windows on the same sample clock as ASR. It reports counts/timing only for embeddings and keeps transcript labels Unknown. Windows can cross speaker changes; this is not working diarization or calibrated identification.

`spike:pipeline` verifies every extracted region and window against the original generated audio, checks silence and forces bounded cuts during a 24-second repeated fragment. The browser runner verifies actual paced capture plus cleanup failures. See [ADR 0010](../docs/decisions/0010-shared-speech-and-speaker-windows.md) for why the implementation moved away from whole-region embedding. Model/runtime files remain under ignored `research/private/`, and these pages are absent from the deployed app.

`npm run spike:pipeline-stress` feeds fifteen minutes of the generated phrase with silence gaps through one persistent pipeline, using only one small reusable input buffer. It verifies every returned speech region and speaker window against its original sample coordinates, checks increasing final ASR timestamps, and prints memory/processing checkpoints for each minute of input. `npm run spike:pipeline-stress -- 3` is the shorter regression reproduction; durations from 1–30 minutes are accepted. Input is processed as fast as possible, so this is not a fifteen-minute wall-clock microphone or battery test. No recognized text, embeddings or audio values are printed.

Rebuild the combined runtime after pulling the reset change in [ADR 0012](../docs/decisions/0012-vad-window-reset.md). Forced VAD flushes now reset native analysis state; each native window is explicitly mapped back to the unchanged capture clock. The earlier runtime can return an empty region when a forced flush intersects trailing silence.

## Offline speaker-turn candidate

This isolated experiment reuses the public English embedding model and existing native libraries. It downloads a pinned public 1.5 MB MIT segmentation export into ignored research assets, then generates two Windows TTS voices locally. Requires the existing Emscripten/static-library build described above and Microsoft Hazel Desktop / Microsoft Zira Desktop voices.

```sh
npm run spike:prepare-diarization
npm run spike:build-diarization
npm run spike:generate-diarization-fixtures
npm run spike:diarization
# With the development server on port 5178:
npm run spike:diarization-browser
```

Open `/research/diarization-benchmark.html` to run it manually. `DIARIZATION_BENCHMARK_URL` overrides the browser runner's default localhost URL. It loads approximately 41 MB of local assets, takes roughly half a minute on the tested desktop, and requests no microphone. Cancel, pagehide, visibility loss and timeout terminate the worker. The browser runner tests cancellation during native inference, interruption and a failed model download in Chromium and WebKit; no Web Audio support is needed.

The four fixtures are silence, one repeated voice, A/B/A and an overlapping mixture. Output contains timing, anonymous clusters and coverage of known playback intervals, never PCM, embeddings or transcript text. Those intervals include TTS pauses and cannot serve as precise speech annotations. All inference calls use unknown speaker count and the upstream distance threshold; this is not a calibrated identity threshold. IDs are local to each call and may be sparse. Input copies are erased and native resources released; worker termination also discards its process state.

Observed misassignment and batch latency prevent promotion to live attribution. See [ADR 0013](../docs/decisions/0013-offline-diarization-candidate.md) and [feasibility](../docs/feasibility.md). These models, generated WAVs and pages are absent from the production build; physical-device and human-speaker validation remain outstanding.

`npm run spike:diarization -- --local-windows` isolates independent ten-second segmentation calls at five-second strides, plus an exact end-aligned window. No input is padded; reported coordinates are translated back to the fixture sample clock, while cluster IDs remain independent for every call. The native implementation bypasses embedding/clustering for one model window. This is substantially faster, but the alternating synthetic voices still collapse into one local label. It is not a working replacement for the full diarizer.

## Local ASR accuracy comparison (2026-10-11)

`npm run spike:asr-decoders` compares the original small and upgraded local ASR
weights with greedy/four-path beam decoding, using the generated fixtures in
`tests/fixtures`. Add a path to the upstream model's `test_wavs` directory to
include its `0.wav`, `1.wav` and `trans.txt` public references. The script uses
shipped assets, has no network/microphone access and prints aggregate edit counts
and timings. It does not save recognized words or evaluate human conversational
accuracy. See ADR 0022 and feasibility for results and the rejected small-model
beam-search command regression.
