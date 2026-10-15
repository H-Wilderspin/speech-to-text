# ADR 0030: Opt-in console diagnostics for delayed speaker stages

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-12
Status: Accepted

## Context

The user reports one correctly transcribed and assigned payload, followed by no
further upper-pane statements, and asks whether processing is synchronous. The
physical cause remains unknown. Earlier cumulative success statuses cannot tell
whether new capture, inference, voice decisions or word alignment have stopped.

## Decision

Enable session-only console diagnostics with `?debugSpeakers=1`. Use the fixed
`[who-said-what]` prefix and stage names, anonymous trace/request/segment counters,
timings, numeric similarities and aggregate counts. Never log transcript text,
names, profile IDs, audio, embeddings or arbitrary error messages. The logging
boundary defensively copies only finite numeric, boolean and null values.
No persistence, upload, extra setting, dependency or model change is introduced.

Trace capture readiness, input/processed sample positions, queued frames, lag,
Stop/drain and categorized failures; worker request/response and waiting/timeout;
local endpoints, tokens, pending/final/committed segments, future-evidence wait,
voice decisions; browser-word alignment counts; and visible upper-pane counts.
Sample routine frame logs approximately once per second. A request still pending
after one second logs even if its normal request event was sampled out. Endpoint,
lifecycle and changed alignment/display events are immediate. Worker diagnostics
travel back as numeric metadata, so they appear in the main page console.

## Ordering and consequences

Browser captions remain independent. Microphone capture continues while the local
worker is busy. Capture queues up to 32 unacknowledged 100 ms frames; its pump awaits
one worker response before submitting the next frame. Inference inside that worker
is synchronous, including ASR and periodic three-second voice windows with 1.5 s
hop. This is local RPC, not a server round trip. A sentence does not block capture
until it is finalized or assigned. Queues remain bounded; failures stay visible.

Upper text needs an ASR endpoint, token timing, enough subsequent audio for future
voice windows (up to three seconds beyond the last token), agreeing voice evidence
and a sufficiently unique wording match to the browser. Unknown or hidden speech
is omitted. Logs distinguish these gates; they do not weaken them or claim a fix
for the latest phone failure. Debug logging can affect timing, so it is off by
default. Similarities are measurements, not confidence probabilities.

## Validation

Tests cover opt-in silence, numeric-only output, throttling, serial request
progression and timeout, queuing during a pending frame, multiple committed local
sentences and delayed alignment of successive browser statements. Real model
integration checks repeated generated speech in one session and safe diagnostic
transport; paced browser integration checks stage events through rendering.
Execution results and physical limitations are recorded in feasibility notes.

## Follow-up: complete copyable output (2026-10-12)

Returned DevTools logs copied expandable object previews, losing later numeric
fields behind an ellipsis. Emit the same safe fields as one JSON string per line
and add explicit rejected count plus best/minimum similarity. This changes only
presentation of diagnostics; privacy filtering, opt-in and matching decisions stay
as recorded above. The returned one-profile trace established below-cutoff rejection,
not a processing stall. See the newer troubleshooting and feasibility entries.
