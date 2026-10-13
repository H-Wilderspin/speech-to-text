# ADR 0035: Separate PC-hosted comparison endpoint

Date: 2026-10-13
Status: Accepted for an experimental comparison

Update 2026-10-13: [ADR 0037](0037-browser-plan-collapsible-attribution.md) supersedes
this as the active rollout plan. The implementation remains as inactive research.

## Context

The user requested a new endpoint to compare the successful delayed benchmark
route against the original app. After checking hosting costs, they explicitly
selected their PC with a temporary HTTPS link and no hosting subscription.
This supersedes ADR 0034's research-only restriction for this separate prototype.

## Decision

Keep the original entry point and engines. Add `compare.html` with the same native
browser captions below and independently transcribed, matched words above.
Reuse the app-path IndexedDB voiceprints, speaker colours and visibility choices.
The existing fullscreen Settings gains optional connection content only on this page.

Send mono 16 kHz PCM16 plus opaque profile IDs/model-versioned embeddings to an
authenticated FastAPI service on this PC. Cloudflare relays the temporary HTTPS
connection; this data flow is disclosed in Settings. Display names stay in the
browser. No server audio, voiceprint or transcript persistence; no request-body
logging. Keep all credentials and tunnel state under ignored `research/private`.
An initial private URL fragment supplies the connection, is removed from the URL,
and is retained only in sessionStorage. It is not a public deployment secret.

Use the measured Whisper small.en speech-region transcription, Community-1 normal
overlapping turns, ERes2Net identity per isolated predicted turn, and wav2vec2/
WhisperX forced alignment with interpolation disabled. Preserve the experimental
0.60 unique-candidate threshold and whole-word containment. Never infer identity
from an anonymous cluster or copy a name across unknown/overlapping words.
Native sherpa-onnx uses the same pinned voice model as browser enrollment.

Capture never waits for inference. Windows carry 24 seconds of context with a
20-second stride; their midpoint ownership ranges partition the audio clock.
Stop flushes the tail and releases the microphone before queued inference completes.
Clear, interruption, profile changes and a new session cancel obsolete results.
The client allows at most three waiting windows plus one in flight; overflow
stops delayed processing visibly while live captions continue. The single model
worker rejects concurrent HTTP jobs with 503; request size and upload time are bounded.

## Consequences

Names arrive after audio collection plus CPU inference, usually tens of seconds.
The PC must remain awake and its server/tunnel running. This is an English-only
comparison, not a replacement deployment or a claim of calibrated human accuracy.
Independent ASR/alignment in overlapping windows may disagree near a batch seam;
word ownership avoids append-all-overlap duplicates but is not an accuracy proof.
Strict identity boundaries can still omit unsupported words. The bottom pane is
unmodified native recognition, including its one-growing-line reconciliation.

No paid service or Hugging Face-hosted inference is enabled. Current HF Docker
Space creation requires a paid plan; CPU Basic's lack of an hourly charge does
not remove that subscription requirement.

## Validation

See [service operation and checks](../../service/README.md),
[packaged model results](../service-benchmark-results.json), and the new client
queue/lifecycle tests, HTTP-policy tests and comparison browser tests.
Physical Pixel/iPhone acceptance remains outstanding.
