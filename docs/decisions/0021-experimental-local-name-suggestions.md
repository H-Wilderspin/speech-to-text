# ADR 0021: Opt-in local name suggestions

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-11
Status: Accepted for experimental estimates; reliable human identification remains unverified

Follow-up: [ADR 0022](0022-upgrade-local-transcription.md) replaces the small ASR
model and adds readable casing after a clear-speech phone accuracy failure.
Speaker matching and its experimental status remain unchanged.

## Context

The user confirmed that browser captions now retain opening words after pauses,
but saved voiceprints still produced Unknown. That was the implemented boundary:
the browser recognizer supplied no compatible audio spans and never ran matching.
Only one consenting human is available, so human negative calibration is pending.
Asked whether to keep names disabled or show explicitly experimental suggestions,
the user chose **“Show experimental name suggestions.”** This authorizes estimates
before the earlier human-calibration gate, not a claim of reliable identification.
It supersedes the production-disable condition in [ADR 0017](0017-direct-live-attribution-prototype.md)
for this opt-in mode. Full M3 acceptance still requires human/device evidence.

## Decision

Keep browser captions as the default. Settings offers a separate English-only
local mode, preparing the pinned Zipformer20M streaming ASR, Silero speech detector
and existing ERes2Net voice model. The capture adapter sends identical numbered
16 kHz PCM frames to ASR and speaker windows in one worker. Browser recognition is
not run concurrently or aligned by callback arrival time. No backend is added.

Three-second voice windows advance every 1.5 seconds. Use cosine **0.6**, the
[upstream sherpa speaker-identification-with-vad example's default](https://github.com/k2-fsa/sherpa-onnx/blob/9db1af1871ed78cee9357c23898e5a7d8702d21a/python-api-examples/speaker-identification-with-vad.py),
as an explicitly uncalibrated baseline. This is not a probability or a validated
threshold for these users. Do not ship the research runner's synthetic-derived
threshold or invent a margin. A window suggests a name only when exactly one
compatible saved profile exceeds the baseline. A token point needs at least two
distinct covering windows which all agree. Word pieces must agree before a whole
word receives a name. Interim, insufficient or ambiguous evidence remains Unknown.

ASR segment IDs replace provisional text. Final text waits for all possible
covering windows (three seconds after its last token point) before names settle;
Stop uses only available evidence. Returned word-boundary markers can be either
SentencePiece `▁` or literal spaces. Unexpected tokenization preserves anonymous
original text. Every suggested identity displays **Name (estimate)** with its
profile's existing colour. Overlap is not reliably rejected: agreeing windows do
not prove one speaker. First/short words and turn boundaries may remain Unknown.

The initial explicit preparation downloads up to **57,929,595 bytes** of additional
ASR/VAD/runtime files, plus the **26,485,263-byte** speaker model if absent. Exact
asset sizes/hashes are in `local-assets.json`; existing speaker cache is reused.
The page owns both verified caches; the worker imports verified runtime bytes.
Models are lazy and cancellable, never shell-precached. Reload of an enabled mode
attempts cached-only preparation, with an explicit repair action if files were
evicted. A path-scoped localStorage preference remembers the opt-in; it stores no
speech. Changing modes clears the current transcript.

The capture queue is bounded to 32 unacknowledged 100 ms frames plus a partial
frame, allowing short inference bursts (the user's latest Pixel comparison was
about 0.9 seconds). Sustained overload fails visibly without silently dropping
audio. Stop drains capture; command Stop trims the command; interruption/error
terminates the worker and releases the microphone. Loaded models are reused
between successful sessions. Profiles are read anew each session; temporary
vectors are erased. Profile mutations invalidate active local sessions in the
same tab or via a metadata-free BroadcastChannel signal in other tabs. Closed
models require cached preparation again. Caption retention remains bounded to
the latest 100,000 characters, in memory only.

## Consequences

This makes actual estimated names available on static GitHub Pages with existing
voiceprints. Local mode has different English ASR accuracy, preparation cost,
memory use and delay from browser captions. It may run too slowly on a phone;
turning it off returns to browser recognition. Model startup, first-word accuracy,
long sessions, human false matches, short turns and overlap need phone tests.
No audio, live embedding or transcript is uploaded or persisted. Saved consented
profiles continue to use the existing versioned IndexedDB schema and deletion UI.

## Validation

`suggestions.test.ts` checks unknown/one-profile ambiguity, independent windows,
clock mismatch, word assembly, actual tokenizer spacing, replacement and Stop.
`engine.test.ts` checks preparation, cancellation, storage/capture failure,
temporary vector erasure, interruption, unsupported language and spoken Stop.
Existing AudioWorklet tests verify bounded capacity and tail draining.
`tests/local-listening.spec.ts` exercises the published worker/assets, generated
held-out known/other voices, offline reuse, recovery and real paced AudioWorklet
capture with both Stop paths. These generated voices are integration fixtures,
not human accuracy or phone acceptance. See feasibility and manual testing for
executed environments and pending physical checks.
