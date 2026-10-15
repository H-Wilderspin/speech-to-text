# ADR 0033: Compare delayed pipelines locally before selecting a service

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-13
Status: Accepted for research only

## Context

The user requested a small comparative benchmark following [ADR 0032](0032-delayed-audio-timeline-service-proposal.md).
They confirmed there is no managed API access and requested a local start.
The live pane is adequate; the unresolved requirement is complete, accurately
assigned delayed speech, retaining strict word-level uncertainty.

## Decision

Use isolated research scripts and generated Windows Hazel/Zira voices. Compare:

1. The shipped local Zipformer/voice-window components, before browser text matching.
2. The same recognized words joined to delayed model-predicted speaker turns.
3. CPU faster-whisper small.en with timed words joined to those same turns.
4. A second Whisper pass that transcribes separate Silero speech regions to test
   the whole-recording pass's observed repetition loss and silence hallucination.

Reuse the existing sherpa segmentation-3.0/ERes2Net diarization experiment;
do not call it a benchmark of modern pyannote Community-1, WhisperX or a hosted API.
Anonymous cluster audio is aggregated only from non-overlapping predicted turns,
up to 15 seconds, then compared with independently generated enrollment passages.
Keep the existing experimental 0.60 cosine threshold and ambiguity fallback.
No inference stage receives scripted speaker boundaries, names or reference text.
Separate explicitly labelled oracle diagnostics use scripted playback for evaluation only.

Retain unassigned words internally. A strict temporal join leaves words crossing
gaps, multiple clusters or unknown identity unassigned. Zipformer only supplies
token points, so it cannot provide the same full-interval check as Whisper.
No nearest-turn filling or sentence-wide name propagation is introduced.

## Consequences

Python dependencies, the downloaded Whisper model, WAVs and intermediate outputs
stay in ignored `research/private/`. No application dependencies, microphone flow,
live captions, public model assets or production deployment change. No audio is
uploaded to a service, and no API charges are incurred. Python performs local
inference; these results do not establish an advantage attributable to language.

The set is a technical screen with two synthetic voices, not a human accuracy
study or calibration set. Report deletions, unknown-speaker false names, repetition,
boundary coverage and overlap separately. Runtime is offline desktop processing,
not Pixel 8 performance or end-to-end live latency. The VAD follow-up is exploratory
on the same set, not independent held-out validation.

## Validation

See [the benchmark report](../comparison-benchmark.md), machine-readable results
and reproduction instructions linked there. Focused scoring tests cover clipped
endings, intentional repeats, false names, insertions, gaps and overlapping turns.
Production checks still run as required by this repository's working agreement.

References: [faster-whisper](https://github.com/SYSTRAN/faster-whisper),
[existing diarizer provenance](0013-offline-diarization-candidate.md),
[pyannote Community-1 access](https://github.com/pyannote/pyannote-audio).
