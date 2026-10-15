# ADR 0029: Twenty-second guided voice registration

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-12
Status: Accepted

## Context

The user requests more recording time and content for voice matching, with a set
passage to read. Registration previously captured eight seconds of unprompted
speech. The existing extractor and profile schema accept up to thirty seconds.
The latest phone attribution result is still unresolved; more registration audio
is a hypothesis to test, not a proven fix or a reason to relax matching gates.

## Decision

Capture twenty seconds for registration, processing the entire recording with the
existing embedding extractor. Show an original short conversational passage before
and during recording, with one instruction to use a normal voice and repeat if
finished early. Scroll the passage into view on Record. Keep comparison recordings
at eight seconds, allowing evaluation with different speech rather than memorized
registration content. Do not change live speech windows or identity thresholds.

Pass an explicit bounded duration to the AudioWorklet; registration and its progress
display share one duration constant. Give microphone permission and capture separate
timeouts so permission delay does not shorten the sample. Reject incomplete
registration captures before inference. Erase transient audio and embeddings as
before; only the normalized 192-dimensional voiceprint is stored.

Allow selection of a saved person in the same form and an explicit Update voice
action. Replace their voiceprint only after successful capture, inference and a
durable transaction. Preserve ID/name/creation and legacy registration metadata;
colour and visibility remain keyed to the same ID. The storage transaction checks
that the row still exists before replacing it, preventing resurrection after
deletion. New registration retains insert-only semantics. Cancellation/failure
keeps the old profile. Existing eight-second profiles remain usable until updated.

## Consequences

Registration takes 2.5 times the recording time and may require more inference
time/memory. Model limits already permit this duration; phone throughput still
needs measurement. No model download, dependency, backend, profile schema change,
raw recording persistence or automatic identity assignment is introduced.
The passage is a practical prompt, not a validated phonetic or biometric protocol.

## Validation

Unit tests cover actual worklet sample counts at 16/44.1/48 kHz, eight-second
comparison defaults, invalid durations, cancellation erasure, full registration
payloads, legacy-preserving replacement and failure cases. The browser integration
records twenty seconds with real worklet/resampling/model inference, verifies
stored duration, updates the same ID without duplicate profiles, and checks retained
colour/activity. Generated tones validate mechanics, not human voice accuracy.
Executed checks and publication are recorded in feasibility notes.
