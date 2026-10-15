# Static speaker assets

> Historical research: this feature was removed from the MVP by [ADR 0046](decisions/0046-live-transcription-only-mvp.md). Commands and source paths below refer to earlier Git history.

The optional enrolment path uses three public files in `public/speaker/v1/`. Commit these files with the app, including the ONNX and WASM binaries. They contain public software/model weights, never recordings or voiceprints. All files are below GitHub's per-file 100 MB limit. Do not replace them with Git LFS pointer files in the Pages artifact.

`npm run verify:speaker-assets` checks the SHA256 values in `speaker-assets.json` and notice presence; `npm run build` runs that check automatically. Runtime/model downloads are lazy and same-origin. The service worker does not precache this directory.

After the first explicit preparation, a separate model/version cache retains all
three verified files. Enrolment and comparison detect and load that copy without
another download prompt, including offline; cache eviction or corruption requires
explicit repair. See [ADR 0016](decisions/0016-reuse-cached-voice-model.md).

| Asset | Bytes | Provenance |
|---|---:|---|
| `embedding.onnx` | 26,485,263 | `3dspeaker_speech_eres2net_sv_en_voxceleb_16k.onnx`, pinned maintainer conversion below |
| `speaker-runtime.wasm` | 12,576,592 | sherpa-onnx source `9db1af1871ed78cee9357c23898e5a7d8702d21a`, local static libraries, speaker-only relink |
| `speaker-runtime.mjs` | 75,294 | Emscripten 4.0.23 output paired with this WASM |

Download the model from [this immutable artifact URL](https://huggingface.co/csukuangfj/speaker-embedding-models/resolve/8be2a75c9ed7a590538b268e46fbb65e1aa9d208/3dspeaker_speech_eres2net_sv_en_voxceleb_16k.onnx) and save it as `public/speaker/v1/embedding.onnx`. Its SHA256 is `c59158379255ad66e161679cca6af8d52d51e389e3224ab7d7a7baae295c2db5`. The [original model card](https://www.modelscope.cn/models/iic/speech_eres2net_sv_en_voxceleb_16k) lists Apache License 2.0, English and the ERes2Net architecture (reviewed 2026-10-10). The card's suggested similarity threshold is **not adopted**: application-specific calibration is still missing.

The runtime is reproducibly relinkable from the existing static-library build using `research/build-speaker.ps1 -SherpaBuild <build-directory> -Emsdk <emsdk-directory>`. Required libraries and exact link flags are in that script. It uses ONNX Runtime 1.28.2 SIMD (source-build dependency archive SHA256 `88688849b67fed9ca0e9fb2bf92ce19a5def9e8c2c8c2df34eb235d25893232a`) and Eigen 5.0.1. Copy the resulting `.mjs` and `.wasm` together. The script is a relink recipe, not a complete clean-machine toolchain build; a fresh source build and bit-for-bit reproducibility have not been verified. Ordinary development and GitHub Pages deployment use the included verified binaries and do not need this toolchain.

[THIRD-PARTY-NOTICES.txt](../public/speaker/THIRD-PARTY-NOTICES.txt) accompanies distribution and is linked from Speakers. It includes sherpa, kaldi libraries, sentencepiece, OpenFst, KissFFT, Eigen, JSON, hclust, Emscripten and ONNX Runtime licence/notice texts, plus model provenance. Eigen's unmodified covered source is available from [the exact 5.0.1 source archive](https://gitlab.com/libeigen/eigen/-/archive/5.0.1/eigen-5.0.1.tar.gz). ONNX Runtime notices came from its [v1.28.2 ThirdPartyNotices.txt](https://github.com/microsoft/onnxruntime/blob/v1.28.2/ThirdPartyNotices.txt) and [LICENSE](https://github.com/microsoft/onnxruntime/blob/v1.28.2/LICENSE).

Any replacement requires updating hashes, model version, dimensions, notices, benchmarks and compatibility decisions together. Existing profiles must not silently be matched against a different model. No user embeddings belong in these files or the repository.
