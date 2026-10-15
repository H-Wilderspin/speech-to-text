# ADR 0028: Retain voice decisions until delayed words arrive

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-12
Status: Accepted

## Context

The Pixel 8 retest still leaves Who said what empty after Stop, while live captions
work and the profile eye is on. Settings reports "Speech received; no saved voice
matched yet." That message tests labelled local captions, not embedding matches:
it cannot distinguish rejected voices from evidence lost before word attribution.

A regression reproduces premature pruning: when a voice window ends at the current
audio position and the recognizer has not emitted tokens, `SuggestedTranscript`
immediately discards it. Later timestamped words cannot recover the accepted
identity. Provisional token timestamps moving backwards can lose evidence too.
This is a verified code defect, not yet the established cause on the user's phone.

## Decision

Keep 30 seconds of lightweight window decisions, plus older decisions still needed
by pending words. This exceeds the configured 20-second ASR utterance endpoint.
Keep the existing sample-clock coverage checks, two agreeing windows, unique
candidate threshold, unknown fallback and browser/local phrase alignment.
No names are inferred merely from having one saved profile.

Report session aggregate window counts (accepted and ambiguous), best cosine
similarity and local word-attribution stage through the worker and engine into the
existing Settings status. Counts distinguish threshold rejection from competing
profiles, insufficient agreeing evidence and tokenizer/timing rejection. A best
score is a similarity, not an identity probability. Successful browser attribution
still displays the existing short success status. Diagnostics survive Stop and
reset on Clear/new listening sessions.

## Consequences

Browser caption text, lifecycle and finalization are unchanged. No new models,
dependencies, raw audio retention, embedding retention, persistence or telemetry.
The retained decisions contain clock coordinates, internal identity and aggregate
score metadata only, in session memory. Decisions outside the retention horizon
still safely result in unknown if a recognizer supplies exceptionally late words.
Duplicate/similar profiles remain ambiguous rather than selecting an arbitrary name.

## Validation

The delayed-first-token regression failed before the retention change and passes
afterward. Unit coverage also checks backward revisions, decision expiration,
weak/ambiguous matches, tokenizer rejection and diagnostic lifecycle. The real
worker browser fixture checks a generated known voice, an unenrolled voice and
duplicate reference profiles. Human acoustic accuracy and the physical blank-pane
issue remain unverified; record executed checks in feasibility notes.
