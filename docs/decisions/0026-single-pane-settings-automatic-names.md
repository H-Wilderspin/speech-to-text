# ADR 0026: Single-pane Settings and automatic names

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-12
Status: Accepted; supersedes the name toggle and nested Settings flow in ADRs 0023 and 0025

## Context

Profile pills gain an activity button in [ADR 0027](0027-speaker-visibility-and-provisional-attribution.md),
which also separates local evidence completion from browser finalization.

The user requests full-viewport, vertically scrolling Settings with registration,
colours and text controls on one page. They want names automatically for registered
people in the upper transcript, with no labels in the live lower transcript.

## Decision

- One native modal fills 100vw and 100dvh (100vh fallback). Its sticky header has
  a return icon beside Settings. Escape/return restores focus to the toolbar.
- People appear as coloured pills with two accessible icon buttons: colour and
  delete. Colour swatches expand inline. Delete requires a second explicit action,
  with Cancel initially focused. Registration is directly below, not another page.
  Comparison and bulk deletion remain under More and expand within the same pane.
- Remove the name checkbox and stored enable preference. Keep the browser-first
  composite engine connected throughout the app lifetime. Read profile summaries
  on connection and on profile-change events; compatible registered profiles
  automatically prepare the existing models, reusing verified cached assets.
  With no compatible profile, release local inference and download no names model.
- Listen immediately starts browser recognition. Prepared local inference starts
  in the same gesture; if preparation finishes later it may join the session.
  Queue that activation after preparation notifications finish, recheck session
  state, and never activate capture after Stop. Try once per listening session;
  a capture failure leaves browser captions running. Opening Settings or loading
  models alone does not request microphone access.
- Retain conservative experimental matching: assigned final words and estimated
  names above, all unchanged browser words below without names. Registration does
  not mean every utterance belongs to that profile. No threshold/model changes.

## Consequences

Registering a voice now enables model preparation automatically, including missing
files (the existing combined cache is about 205 MB). Startup reads local speaker
metadata even without opening Settings. No new service, model, dependency, audio
retention or profile schema. Failed preparation offers Retry names in Settings;
non-English/unsupported names and storage failures preserve live browser captions.

Late local microphone activation may fail on some mobile browsers; prepared Listen
retains the original gesture. Physical Pixel 8/iPhone capture coexistence and human
identity accuracy remain unverified. Names remain estimates and unknown speech
stays absent from the top pane.

## Validation

Unit tests cover automatic profile discovery, profile changes/deletion/storage
failure, disposal and Stop versus late preparation. Browser tests cover full-screen
scrolling, header/focus, pills/colour persistence/protected deletion, no checkbox,
generated local inference and delayed upper-only labels, cache reuse/repair and
preparation continuing after Settings closes. See feasibility for executed results.
