# ADR 0006: Integrate experimental consented local enrolment

Date: 2026-10-10
Status: Accepted; supersedes ADR 0004's research-only distribution restriction

## Context

The isolated runtime produces real embeddings. The English-trained ERes2Net VoxCeleb candidate is smaller than the initial Chinese model and its original ModelScope card identifies English and Apache License 2.0. Phone measurements still require a reachable HTTPS deployment. Keeping all recording and storage code unimplemented until that measurement would prevent testing the intended M2 workflow.

## Decision

Expose clearly labelled experimental profiles in Speakers, with explicit per-recording consent, an eight-second single-speaker recording and local-only processing. Use the pinned English model with sherpa preprocessing (16 kHz mono, model-controlled normalization, 192 output values). Load its 26,485,263-byte model and 12,576,592-byte single-thread SIMD runtime in a cancellable module worker only after Prepare. Include the tested assets and third-party notices in the static site; verify their hashes on build and the model/WASM hashes before inference. No cross-origin isolation headers or inference service is required by this runtime.

An AudioWorklet captures real samples; OfflineAudioContext resamples to 16 kHz. Reject incomplete, very quiet, heavily clipped and non-finite signals. These are coarse recording checks, not speech detection or proof of a single speaker. One consented sample is the initial enrolment flow; cross-session accuracy remains to be measured.

Store normalized embeddings plus explicit schema/model versions, consent version/time, name, creation time and sample duration in IndexedDB scoped by app path. Wait for transaction completion before confirming a save. Support individual deletion and confirmed clear-all. Never persist raw recordings or transcripts. Stop microphone tracks before inference, zero temporary buffers where accessible, and terminate worker processing on cancellation, dialog closure or page interruption. A late permission grant must have its tracks stopped immediately.

Keep anonymous captions independent. Opening Speakers stops live recognition to avoid simultaneous captures. Names are not assigned to captions: confidence calibration, unknown-speaker evaluation, diarization and a common ASR/audio timing reference remain prerequisites under ADR 0003.

## Consequences

M2 can now be exercised on a published static site, but its device and false-match acceptance gates remain open. The public distribution grows by about 39 MB; anonymous opening does not fetch these binaries and the offline worker does not precache them. Browser HTTP caching may retain model files. No guarantee of offline enrolment is made. Profile data is sensitive local browser data, not synced, encrypted by this app or recoverable after site data deletion.

The tested prebuilt runtime is included to avoid requiring the user's GitHub build to have an adjacent sherpa/Emscripten checkout. Source/version/provenance and rebuild limitations are in [speaker assets](../speaker-assets.md). Changing preprocessing, dimensions or model must change the model version before matching profiles.

## Validation

Typecheck, lint, 53 unit tests, asset checks and production build passed. Unit tests cover schema boundaries, signal checks and enrolment lifecycle cancellation/failure. The production suite passed 28 browser checks and explicitly skipped four audio-dependent checks on Windows WebKit, which exposes no Web Audio APIs. Chromium tests replace only microphone input with a synthetic oscillator and exercise real AudioWorklet capture, resampling, WASM and IndexedDB at root and project paths. WebKit covers the recording fallback and profile management. These are not voice-quality, physical permission, phone or accuracy tests. See [feasibility](../feasibility.md) and [manual testing](../manual-testing.md) for executed evidence and pending gates.

Sources: [original model card](https://www.modelscope.cn/models/iic/speech_eres2net_sv_en_voxceleb_16k), [pinned ONNX artifact](https://huggingface.co/csukuangfj/speaker-embedding-models/commit/8be2a75c9ed7a590538b268e46fbb65e1aa9d208), [AudioWorkletNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode), [IndexedDB transaction completion](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event).
