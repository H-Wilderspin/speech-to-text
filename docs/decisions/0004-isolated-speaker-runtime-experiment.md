# ADR 0004: Measure a speaker-only runtime before enrolment integration

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-10
Status: Research-only distribution restriction superseded by [ADR 0006](0006-experimental-local-enrolment.md); historical experiment retained

## Context

The standard diarization artifact audited in ADR 0003 lacks speaker-embedding exports. Further workspace inspection found a different, existing custom vad-asr build that exposes those APIs. Its JS/WASM audit succeeds, but it packages 372,421,566 bytes of model data unrelated to a narrow embedding test.

## Decision

Relink the already-built sherpa libraries into an isolated speaker-only ES module, exporting the C extractor/stream lifecycle APIs and explicitly exporting filesystem/heap helpers. Use one CPU thread, WASM SIMD, 64 MiB initial linear memory with growth, and no preload package. Stage only the existing embedding model for inference. Reuse sherpa's preprocessing rather than approximating it in JavaScript.

Keep this under `research/` until model quality and device gates are measured. Use a cancellable module worker, lazy same-origin asset fetches, and synthetic input first. Do not load these binaries in the production app or enable identities from synthetic evidence. ADR 0003's confidence, data-handling and alignment gates remain in force; this is the next experiment it called for, not a claim that enrolment/attribution is complete.

## Consequences

The missing standard-wrapper API no longer blocks investigation: the isolated native C API produces real embeddings. The experiment depends on an existing Emscripten 4.0.23/sherpa static-library build and is not yet a portable model distribution. Its model is Chinese-trained; suitability for target speech and licences/notices must be assessed before a production selection.

No ASR timing support is added by this experiment. M3 still requires common capture, reliable utterance spans and diarization. M2 needs consented capture, validated sample quality, schema/model-versioned IndexedDB, deletion and device/accuracy benchmarks before its gate can close.

## Validation

`npm run spike:infer` executes real CPU/WASM inference with synthetic audio. `npm run spike:browser` runs the equivalent worker path plus cancellation and model-download failure in Chromium/WebKit. See [research instructions](../../research/README.md) and [recorded evidence](../feasibility.md). These are runtime tests, not voice identification accuracy measurements.
