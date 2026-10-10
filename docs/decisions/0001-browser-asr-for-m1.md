# ADR 0001: Browser recognition for anonymous captions

Date: 2026-10-10
Status: Accepted; restart, retention and cumulative-result behaviour superseded by [ADR 0014](0014-persistent-listening-and-voice-stop.md)

## Context

The initial repository contained the product plan and working agreement only. M1 needs a static, accessible listening experience before model selection. Browser speech recognition can delegate audio processing to a browser provider; availability and permission behavior vary. The [Web Speech specification](https://webaudio.github.io/web-speech-api/) describes explicit user consent and replaceable interim results. Its result interface does not supply per-utterance audio start/end positions suitable for speaker alignment.

## Decision

Use React, TypeScript and Vite as specified. Put browser recognition behind `TranscriptionEngine`; UI receives the interface through application composition. No additional microphone stream, inference runtime, analytics, backend or authentication. Do not persist transcripts or audio.

Show the browser processing disclosure immediately beside Listen. Clicking Listen selects that processing path; recognition is never started on page load. This is local-first application storage, **not a promise of local-only speech processing**. Experimental `processLocally`/language installation support is deferred until tested on target devices. Do not silently assert or select local processing.

Stop waits up to two seconds for native final results, then aborts. Permission requests can be cancelled and time out after 30 seconds. Hidden/pagehide/unmount aborts capture. Unexpected ends require a fresh Listen gesture, avoiding uncontrolled restart loops. Final segments are stable; interim snapshots can replace or remove earlier interim slots. No timestamps or known identities are invented. Sessions stop after 100,000 characters to bound growth; Clear is required before starting another full session.

Use Vitest for lifecycle/reconciliation and research logic; Playwright for actual DOM and service worker integration with simulated recognition. These development-only dependencies do not establish microphone accuracy. The only runtime dependencies are React and React DOM.

## Consequences

No setup gate or model download. Browser-provider terms, retention, connectivity and device support apply. Anonymous captions cannot be joined to an independent diarization stream using result-arrival times. Error recovery is explicit and confirmed text remains readable. FR-04's no-cloud wording is satisfied for app infrastructure, not guaranteed offline ASR; a fully offline interpretation remains unmet with this provider.

## Validation

`src/transcription/*.test.ts` covers replacement/final stability, late callbacks, stop fallback, denied permission, unsupported recognition, interruption, retry and resource cleanup. `tests/app.spec.ts` covers user workflows with an injected recognizer. Physical microphone and mobile-device checks remain required; see [manual validation](../manual-testing.md).
