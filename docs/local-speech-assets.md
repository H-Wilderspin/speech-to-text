# Optional local speech assets

The name-suggestions mode uses the eight checksum-pinned public files in
`public/local/v1/` plus the existing speaker embedding model. `local-assets.json`
records exact byte counts and SHA256 values; `npm run verify:speaker-assets`
checks them before every build. Keep these files in Git, not Git LFS pointers.
The largest file is 42.85 MB; all are below GitHub's per-file limit.

| Files | Provenance |
|---|---|
| `encoder.onnx`, `decoder.onnx`, `joiner.onnx`, `tokens.txt` | Quantized English streaming Zipformer20M, epoch 99 average 1, export [csukuangfj/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17](https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17), from [desh2608/icefall-asr-librispeech-pruned-transducer-stateless7-streaming-small](https://huggingface.co/desh2608/icefall-asr-librispeech-pruned-transducer-stateless7-streaming-small), Apache 2.0 |
| `asr-api.mjs` | sherpa-onnx `wasm/asr/sherpa-onnx-asr.js` at `9db1af1871ed78cee9357c23898e5a7d8702d21a`, with an appended named ES export; Apache 2.0 |
| `pipeline-runtime.mjs`, `pipeline-runtime.wasm` | Same sherpa source/static-library build as the speaker runtime, relinked by `research/build-speaker.ps1 -Kind pipeline`; Emscripten 4.0.23, ONNX Runtime 1.28.2 |
| `silero_vad.onnx` | [sherpa distributed artifact](https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx), pinned here by SHA256; [Silero VAD](https://github.com/snakers4/silero-vad), MIT |

The repository's `research/prepare-asr.mjs` and `prepare-pipeline.mjs` record the
copy/export recipe from the local sherpa checkout. A full clean-toolchain rebuild
has not been verified; ordinary development/CI uses the included pinned assets.
Silero's release URL is mutable; the manifest hash identifies this exact artifact.
The ASR local model card was reviewed before promotion. Notices include the ASR
source/model, the appended-export modification, Silero MIT text and the complete
existing runtime dependency notices in
[THIRD-PARTY-NOTICES.txt](../public/local/THIRD-PARTY-NOTICES.txt).

These files total 57,929,595 bytes. They are not shell-precached. An explicit
Settings preparation downloads only missing/corrupt files into a page-owned
model cache; later preparations and enabled-mode reloads reuse verified files.
The 26,485,263-byte `speaker/v1/embedding.onnx` is reused from enrolment's cache.
If no cache is available, explicit online preparation can run in memory. Browser
eviction requires an explicit repair; cached-only startup never initiates a model
download. There is no model proxy, key, backend or voice data in these assets.

See [ADR 0021](decisions/0021-experimental-local-name-suggestions.md) for the
uncalibrated experimental baseline and restrictions. Changing models requires
new compatibility decisions, hashes, licences and evaluation; saved voiceprints
must never silently be used with a different embedding model.
