# ADR 0011: Consent-based local voice comparison without identity claims

Date: 2026-10-10
Status: Accepted experimental M2 evaluation feature

## Context

M2 requires same-speaker/different-speaker comparisons across sessions and realistic microphones. Stored enrolments and synthetic inference alone cannot establish accuracy. The family devices need a usable evaluation path on the static published app, without developer tools or exporting voiceprints.

## Decision

Add a secondary Compare recordings screen within Speakers. The user selects a saved profile, declares whether the new recording is from the same person or a different person, and confirms that person's consent. Prepare the existing English model before the Record gesture. Capture a fresh eight-second sample, then read the reference profile from IndexedDB and verify its model/dimension before computing cosine similarity. A deleted or incompatible profile produces an error.

Read only the selected voiceprint after recording; do not keep reference embeddings in the UI or session snapshot. Erase temporary audio, the new embedding and the reference copy after use. Never write comparison recordings, embeddings or results to storage. Keep at most 20 result records in memory with reference name/ID, user-declared relationship, model version, sample duration, score and processing time. Clear them on request, navigation, interruption or disposal. The original profile store remains unchanged.

Keep enrolment and comparison worker lifecycles separate and prepare only the selected mode. Mode changes cancel the previous worker. The UI explains that scores are not probabilities or validated identity decisions. It uses no match threshold and does not assign names to live captions. The existing research matcher reuses the same cosine implementation.

## Consequences

Users can now collect real local comparison evidence after deployment, including after reloading an existing enrolment. The app does not manufacture a ground-truth relationship from its score; the user supplies that label. Results from one device/session are not sufficient for general calibration. Human held-out evaluations and target-device performance remain required before enabling identification.

No new dependencies, network services, additional model assets or persistent schemas are introduced. Preparing either mode can load the existing 39 MB assets. The UI grows by about 8.5 kB of uncompressed app JavaScript. Test results disappear intentionally, so users must manually record non-identifying aggregate evidence before leaving the screen.

## Validation

Unit tests verify consent/preparation, score calculation, no storage writes, buffer erasure, deleted/incompatible profiles, stale cancellation, invalid inference and result limits. Chromium's real synthetic AudioWorklet/WASM/IndexedDB test now covers enrolment, reload, comparison, cancellation, intact storage and deletion at the GitHub project path, including enlarged text at 320 px. Windows WebKit has no Web Audio and cannot verify microphone comparison. Exact checks and human-device limits are in [feasibility](../feasibility.md).
