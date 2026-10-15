# ADR 0046: Remove speaker attribution from the MVP

Date: 2026-10-15
Status: Accepted

## Context

The user confirms live transcription is adequate for the MVP and explicitly
removes Who said what and its associated tests. Attribution is not reliable
enough and requires separate future work. Merely hiding its pane would retain
extra recording, inference, storage, downloads and development overhead.

## Decision

Compose one BrowserTranscriptionEngine directly into App. Remove the assigned
pane, enrolment/colour/activity controls, local/delayed/remote engines, audio
worklets, voiceprint store, model assets/manifests, diagnostics and comparison
entry point. Remove the associated unit/browser tests, generated voice fixtures,
research executables, Python service and model tooling/CI stages. Retain the
research findings and ADRs as history; implementation is recoverable at commit
`37835e4`, before this removal. Ignored private recordings/environments are not
deleted or published.

Keep browser reconciliation, pause lines, session-aware Clear/Stop, formatting,
scroll-following, typography, language, wake lock and listening indicator. Simplify
caption types and rendering to one stream. Settings retains text size, language,
wake-lock status and About. Preserve offline shell/project-path tests and lifecycle
coverage; no changes to recognition timing or matching of voice commands.

On upgrade, best-effort cleanup deletes only this app path's voiceprint database,
model cache namespaces and legacy attribution preferences. Reading preferences
are retained. Other applications' data and the current offline shell are untouched.
Deletion may wait for an old database connection to close; reload retries restricted
storage cleanup. Updates still wait for old tabs to close before activating.

## Superseded scope

This supersedes the speaker/ML/service and two-pane decisions in ADRs 0003–0004,
0006–0007, 0009–0013, 0015–0018, 0021–0037, and the speaker-specific portions of
0038–0044. Their measured findings remain historical, not current MVP claims.
See the current README and manual test guide for the supported scope.

## Validation

Typecheck, lint, retained unit tests, production build and Chromium/WebKit browser
checks. New upgrade checks verify retired-data deletion, sibling-app isolation,
preserved reading preferences, restricted storage and no model requests. Physical
device acceptance remains distinct from simulated browser tests. Results are in
[feasibility](../feasibility.md).
