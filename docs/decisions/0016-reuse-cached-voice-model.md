# ADR 0016: Reuse verified voice assets across enrolments

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-10
Status: Accepted; supersedes ADR 0006's model-loading/cache policy

Follow-up: [ADR 0018](0018-page-owned-public-model-cache.md) moves persistent
cache access to the page after a reproduced worker-lifetime failure in WebKit.

## Context

Each speaker dialog creates disposable model workers. Their in-memory ready flag
cannot survive closing the dialog or reloading the page. Browser HTTP caching
does not tell the UI that a usable complete model is available.

## Decision

After an explicit first Prepare, keep the three public model/runtime assets in
CacheStorage, scoped by model base URL and model version. Verify SHA-256 for all
three files before saving and before use. Import the verified runtime from a
temporary blob URL and supply cached WASM bytes directly.

Opening enrolment or comparison checks for the complete current model, then
automatically initializes it from cache without microphone access. This restore
path must never fall back to network. Missing, corrupt or unavailable storage
returns to an explicit Prepare action; that action downloads only missing or
damaged files. Cancelling terminates the worker and invalidates outstanding
restore results.

The cache has a separate prefix from versioned application-shell caches so app
updates do not discard a compatible model. No voiceprint, recording or transcript
is placed in CacheStorage. Profile deletion leaves the public model reusable;
clearing browser site data removes both. Cache eviction/quota restrictions can
necessitate another download. This does not promise offline browser recognition.

## Validation

Cache tests cover integrity, repair, no network during restore, unavailable
storage and app-path separation. Session tests cover both features, cancellation
and absence of microphone access. Chromium's real enrolment test reloads offline,
automatically prepares from cache and completes a real WASM comparison without
any further model requests. The full available Windows browser suite passed
32 tests; four existing WebKit audio cases skip because Web Audio is unavailable.
No new physical-device verification is claimed.

Related: [ADR 0006](0006-experimental-local-enrolment.md),
[CacheStorage](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage).
