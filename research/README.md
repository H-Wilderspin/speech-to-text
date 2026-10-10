# Speaker runtime experiment

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
