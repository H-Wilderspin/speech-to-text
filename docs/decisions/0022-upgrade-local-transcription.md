# ADR 0022: Upgrade local transcription after poor clear-speech results

Date: 2026-10-11
Status: Accepted; upgraded phone accuracy/throughput pending

## Context

The user tested with another person and reported mostly wrong words and all-caps
text. They clarified that everyone spoke clearly, one at a time. This fails the
local recognizer's usability test; overlap does not explain that reported case.
The earlier generated-voice integration tests verified plumbing, not conversational
recognition. The small 20M LibriSpeech model's startup omissions were already
reproduced. Its raw uppercase output was also being shown without presentation
formatting. Neither symptom is evidence that stored voiceprints are corrupt.

## Experiments and decision

Changing the small model's decoder from quantized to FP32 did not improve the
tested clips. Modified beam search (four paths) reduced word errors, but the real
AudioWorklet regression then failed spoken Stop: the small model emitted `D STOP`
instead of `COMMAND STOP`. Search widths 2, 8 and 16 also failed that command
fixture. This configuration was not published and the acceptance check was kept.

Upgrade the local ASR to the English streaming Zipformer trained on LibriSpeech
and GigaSpeech, [sherpa export at immutable revision 9a65b6e](https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-21/tree/9a65b6ea94c311ca770c2bf895b30f456a22d703),
Apache 2.0. The locally available encoder/decoder/joiner hashes match the export's
LFS SHA256 identifiers; the existing vocabulary is identical. Use modified beam
search with four paths. This candidate retained spoken Stop, substantially
reduced startup omissions, and improved the public example transcripts. No
microphone processing settings, ASR timestamps, matching threshold or embedding
model are changed. Existing voiceprints remain compatible.

With **no added leading silence**, six generated passages (two installed voices,
three texts, 132 reference words) had 33 word edits under the deployed small model
and one under the upgraded model. Two upstream public speech examples (66 words)
had six edits under the deployed model and zero under the chosen upgraded beam
decoder. These small fixtures are not an estimate of user/conversation accuracy.
In the initial desktop measurements, the upgraded ASR processed about 0.12–0.14
seconds per second of input, versus about 0.05 for the small model, without the
speaker workload. ASR-only WASM linear memory was 240,582,656 bytes. No phone
latency, battery or peak-memory pass is claimed.

Apply display-only sentence casing after token matching and word grouping, per
recognizer utterance, across speaker splits. Preserve English `I`, saved display
names and metadata. Do not infer punctuation, spelling, proper nouns or acronyms
that the uppercase model never supplied. Browser text is unaffected.

## Static hosting, download and memory

The new weights total **190,175,893 bytes**. The encoder exceeds GitHub's per-file
limit, so publish it as three ordered parts (at most 64 MiB each) and reassemble
its original bytes. Every part is SHA256-checked at load; build verification checks
the concatenated upstream encoder hash. No quantization or conversion is performed.
`local-asr-assets.json` pins the new files; `scripts/prepare-local-asr.mjs` reproduces
the split from verified source weights.

Reuse the existing five runtime/VAD/vocabulary files and shared voice model. A
fresh local speech setup needs **204,461,235 bytes**, plus the 26,485,263-byte voice
model if missing. Existing enabled-mode startup stays cached-only: the upgrade
requires explicit Prepare, with size and compatibility explained in Settings.
Preparation is cancellable and bounded to ten minutes; completed files survive
for retry. Models are never included in the app-shell precache.

Sequential part loading bounds temporary assembly buffers. After native models
initialize, delete their JS weight buffers; only the small VAD bytes needed by
session reset remain. Worker cancellation/error destroys inference and releases
capture. The existing 32-frame bound still stops sustained overload visibly.
Browser captions remain available by turning off name suggestions, preserving
profiles. The heavier model may exceed a phone's throughput or memory budget;
that requires a physical retest and is not hidden by dropping audio.

## Validation

`npm run spike:asr-decoders` compares both shipped model versions and decoding
methods using generated fixtures; an optional upstream `test_wavs` path adds the
two public references. Reports contain counts/timings, no user recordings or
recognized text. Unit tests cover casing, metadata preservation, ordered model
assembly, invalid lengths and cancellation. Browser tests retain actual matching,
offline reuse, known/other generated voice checks and voice/button Stop; expected
caption casing changes without weakening the command check. See feasibility for
executed checks and the separate pending phone result.
