# ADR 0034: Compare Community-1 with unchanged identity matching

Date: 2026-10-13
Status: Accepted for research only

## Context

The user created a Hugging Face account, accepted model access and confirmed local
CLI login after the initial [comparative screen](../comparison-benchmark.md).
Access to Community-1's configuration was verified using that saved login.
The older delayed diarizer merged the two alternating generated voices.

## Decision

Run official pyannote.audio Community-1 locally on exactly the same eight WAVs.
Use a separate ignored Python environment; disable pyannote metrics and Hugging
Face telemetry. Authentication is used for model downloads, never included in
source, logs or frontend assets. Audio is not uploaded to any inference service.

Keep the previous speech-region Whisper words/times, ERes2Net enrollment model,
enrollment passages, 0.60 experimental identity threshold and aggregation policy.
Only replace speaker-turn inference. Extract the existing identity implementation
into a shared research module so both diarizers use identical decisions.

Use regular overlapping diarization, not exclusive output or an expected speaker
count supplied by the test script. Cluster labels remain anonymous and local to
each recording until compared with enrolled reference embeddings. Strict temporal
joining excludes words crossing unknown spans, gaps or multiple clusters.

## Consequences

This isolates speaker segmentation/clustering from transcription and identification.
It does not calibrate an identity threshold or establish human-speaker accuracy.
Record model revision, dependency versions, aggregate counts and CPU timings.
The baseline transcript and initial results remain available for comparison.
No app runtime, model cache or production deployment change is authorized here.

## Follow-up measurements

The model-only replacement retained the same 75/123 known-word coverage and 13
false unknown-word names. Two exploratory ablations were added on the same set:
identify each predicted turn separately, and align unchanged recognized words with
WhisperX/wav2vec2. Together they reach 120/123 correctly named words, zero false
unknown-word names and 9/11 complete utterances. Neither receives reference text
or scripted timing. Alignment interpolation is disabled. This supports the next
human-data prototype, not immediate deployment or threshold calibration.

The alignment module is deliberately isolated from WhisperX's full ASR/CLI
dependency set. Its exercised calls work with the pinned research environment,
but declared full-package requirements conflict; a production service must use a
supported dependency combination. See [the complete follow-up](../community-benchmark.md).

## Validation

See the Community-1 follow-up in the benchmark report. Identity regressions verify
unknown/ambiguous fallback and exclusion of overlapping or insufficient enrollment
evidence. Repository typecheck, lint, unit tests and build apply to the added harness.
Model provenance: [official Community-1 model](https://huggingface.co/pyannote/speaker-diarization-community-1)
and [pyannote.audio](https://github.com/pyannote/pyannote-audio).
