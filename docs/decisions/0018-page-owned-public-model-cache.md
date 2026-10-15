# ADR 0018: Keep persistent public model caching in the page

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-11
Status: Accepted; refines ADR 0016's cache implementation

## Context

A new microphone-independent test exposed a Windows WebKit 27.2 failure that
the existing recording tests could not exercise: all three model responses were
readable inside the preparing worker, but their cache was empty after that worker
terminated. Reloading another worker offline failed. Original network responses
instead of reconstructed responses, and a single cache-open operation instead of
parallel opens, did not resolve it. This is observed behaviour of the tested port,
not a diagnosis of Safari on an actual iPhone.

## Decision

Let `WorkerEmbeddingEngine` load, verify and cache public assets in the page, then
transfer their buffers into the inference worker. Keep SHA-256 verification before
use, explicit download consent, cache-only automatic restore and scoped/versioned
storage. Retain the original verified network response. Presence checks inspect
all expected successful responses; integrity is established by rehashing on use.

Fetching has an AbortSignal and a 90-second preparation limit. Cancellation
invalidates cache/hash work before worker creation and permits immediate retry.
Dispose aborts pending preparation and terminates active inference. Only public
assets cross this new boundary; voice processing stays in the worker and raw
audio/voiceprints are never added to the model cache.

## Validation

The new Chromium/WebKit test prepares via the production UI, closes the dialog,
reloads offline, automatically prepares again without further model requests,
then computes a finite 192-dimensional embedding from retained assets. It passed
in both engines. The test substitutes constructors that throw if recording is
attempted; it verifies no phone microphone behaviour. Unit regressions cover
cancellation during cache lookup and retry while an older asset load is pending.

Related: [ADR 0016](0016-reuse-cached-voice-model.md),
[model browser regression](../../tests/model-cache.spec.ts).
