# ADR 0003: Keep speaker identity behind a measured feasibility gate

Date: 2026-10-10
Status: Accepted

## Context

M2 requires consented, reusable embeddings rather than retained reference recordings. M3 needs compatible ASR and diarization timing from the same capture stream. Neither requirement is supplied by the M1 browser adapter. An adjacent project uses reference audio and pairwise diarization as a workaround; those choices do not meet this project's data-minimization requirements.

## Decision

Do not ship an enrolment form that saves names without real embeddings or assigns identities from clusters. Explain unavailability in Speakers and retain anonymous listening. Do not add IndexedDB until a model/versioned profile schema is justified by an actual embedding integration.

Evaluate sherpa-onnx as a candidate because its upstream source and existing WASM assets are available locally. The reproducible binary-wrapper audit found diarization bindings but no embedding extraction bindings. The inspected upstream build config reserves 512 MB initially. This prevents treating the existing artifact as a ready mobile enrolment solution; it does not establish that a custom lightweight build is impossible.

Keep the experimental matching/alignment logic under `research/`, outside the production bundle. Require a model-specific calibration with documented evidence, valid vectors, a minimum similarity and runner-up separation. Missing or ambiguous evidence returns Unknown. Alignment requires a real shared audio clock, full utterance containment and no overlapping turns. A cluster identifier remains distinct from an enrolled identity.

## Consequences

M2/M3 product gates remain open. The next implementation experiment is a worker-hosted embedding extraction build (or separately licensed ONNX model), followed by consented cross-session device benchmarks and a common AudioWorklet/ASR timing pipeline. No default threshold, accuracy, memory, latency, battery or iOS support claim is justified yet. No external inference service or paid infrastructure is selected.

## Validation

See [feasibility evidence](../feasibility.md), `research/audit-sherpa.mjs` and `research/attribution.test.ts`. Synthetic tests check failure rules and boundaries only; they do not measure voice-recognition accuracy.
