# ADR 0012: Reset native VAD after each forced final flush

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-10
Status: Accepted; supersedes ADR 0010's native-state continuation after a forced cut

## Context

The new fifteen-minute generated-input test failed after 123.072 seconds. Native VAD returned an empty segment at sample 1,966,080, shortly after the forced flush at 122.88 seconds. The adapter correctly refused the invalid span. A second run reproduced exactly the same failure.

Sherpa's C API documents Flush as an end-of-input operation. Source inspection shows it clears the outer current-region state while the Silero model can retain pending-silence state. Continuing that detector after flushing can request an invalid sample range and return an empty segment. The short continuous-fragment benchmark did not exercise this silence/boundary interaction.

## Decision

After draining a forced 10.24-second analysis window, reset the native VAD and begin a fresh native stream. Record the new window's starting sample index on the unchanged capture clock. Translate each native segment's local index by this offset; expose `analysisWindowStartSample` alongside the segment metadata.

Keep the shared ASR clock, three-second PCM history, input order and sample values continuous. Reset only the VAD's native analysis state. Reject empty, overlapping, excessive or future spans instead of silently ignoring them. Stop's final partial model window remains explicitly unclassified.

## Consequences

This follows the native API lifecycle and preserves exact correspondence between returned audio and its global sample coordinates. Each analysis boundary now restarts VAD model context, so speech near those boundaries requires further accuracy evaluation. The boundary is still a processing cut, not a speaker change. No identity labels are enabled.

The repeated-fragment regression measured 70 ms of unclassified VAD input immediately after the two resets, while ASR and PCM history still received every input sample. This limitation must stay visible in future alignment work; accurate sample coordinates do not guarantee complete speech detection.

The combined research runtime adds the existing reset export and must be rebuilt. The production speaker runtime and application behaviour are unchanged.

## Validation

The native three-minute reproduction passed after the change, verifying 105 exact sample slices, 44 regions, 61 embedding windows and 27 nonempty ASR finals. The full fifteen-minute generated-input run subsequently passed with 516 exact slices and 121 nonempty finals; linear memory stayed constant at every minute checkpoint. The unit fixture now enforces reset before accepting more input after Flush, and checks that native zero-based indices map back onto the continuous capture clock. The stress runner reports memory, processing and cumulative counts without audio, embeddings or text. Exact measurements and limits are recorded in [feasibility](../feasibility.md).

Source: [sherpa C API Flush/Reset contract](https://github.com/k2-fsa/sherpa-onnx/blob/9db1af1871ed78cee9357c23898e5a7d8702d21a/sherpa-onnx/c-api/c-api.h), [native VAD implementation](https://github.com/k2-fsa/sherpa-onnx/blob/9db1af1871ed78cee9357c23898e5a7d8702d21a/sherpa-onnx/csrc/voice-activity-detector.cc).
