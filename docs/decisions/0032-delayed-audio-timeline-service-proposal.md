# ADR 0032: Delayed speaker attribution on a shared audio timeline

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-13
Status: Proposed; no runtime change, service purchase or audio upload authorized by this document

## Problem and recommendation

The user accepts live transcription but finds assigned text unusable and requests
structural alternatives, including a background service or external API. Retain
the strict word-level attribution preference from ADR 0031. Recommend evaluating
a separate delayed audio-processing service, with timestamped transcription,
speaker-turn segmentation and identity matching as distinct stages.

Production already runs local inference in `local.worker.ts`. Its three-second
embedding windows and text anchors are not a full speaker-turn clustering system.
Independent local/browser recognizers disagree, text anchors omit words, and weak
covering embeddings remove sentence boundaries. Worker language alone cannot fix
these modelling and correspondence limitations.

## Proposed flow

1. Keep the existing browser live pane during evaluation. Independently capture
   PCM with monotonically increasing sample indices for the delayed service.
   Browser recognition currently owns its capture; do not claim its text shares
   reliable word coordinates with our PCM. Ultimately, an accepted timestamped ASR
   stream could supply both panes from one canonical capture.
2. Send timestamped audio to a bounded asynchronous queue. Preserve a rolling
   buffer and context on both sides of processing chunks. Start evaluation with
   15-30 second chunks and overlapping context, measuring cost and end-of-phrase
   latency; these are experiment settings, not a responsiveness promise.
3. Transcribe complete context-bearing audio and perform diarization on that same
   audio. Join word intervals and speaker-turn intervals by the shared sample
   clock. Do not cut tiny speaker packets before transcription or associate results
   by arrival order. Diarization marks who spoke when; it does not itself separate
   simultaneous voices into clean audio channels.
4. Gather several clean non-overlapping speech excerpts for each anonymous speaker.
   Match their embeddings against model-compatible enrollment references. Keep
   identity scores, segmentation confidence and ASR confidence separate. Retain
   unknown and competing-candidate outcomes. Anonymous IDs must be reconciled
   across chunk jobs; `speaker_0` in two jobs need not mean the same person.
5. Store all words internally, including unassigned words, until results settle.
   Identify words using their actual speaker-turn membership. Do not extend a
   sentence's dominant identity across an uncertain boundary. Group contiguous
   known words for display; split on real speaker changes. Unknown/overlap remains
   excluded above. Better boundaries and aggregated identity evidence aim to
   recover complete single-speaker sentences without guessing missing identities.
6. Publish versioned replacements rather than append-only partials: `sessionId`,
   `segmentId`, `revision`, audio start/end, word intervals, anonymous speaker ID,
   nullable profile ID and pending/final status. Reconcile overlapping chunks by
   timeline and source IDs. Discard stale/out-of-order revisions; preserve deliberate
   repetitions at distinct times. Stop releases capture immediately and permits
   bounded final processing; Clear/new sessions invalidate old results.

This replaces `delayed/align.ts` text-anchor correspondence and the production
per-word window veto, rather than merely moving the same algorithm to a server.
Keep the two-pane UI, profile colours/visibility and live result reconciliation.

## Service options

**Managed benchmark first:** pyannoteAI documents streaming diarization, separate
voiceprint identification jobs, and transcription with word/speaker timing.
Its transcription add-on currently cannot run on identification jobs, so the
adapter must reconcile separate results by audio time; do not join independently
generated anonymous labels by equality. Sources checked 2026-10-13:

- [Streaming diarization](https://docs.pyannote.ai/tutorials/streaming-real-time)
- [Voiceprint identification](https://docs.pyannote.ai/tutorials/identification-with-voiceprints)
- [Transcription and diarization, including the identification restriction](https://docs.pyannote.ai/tutorials/speech-to-text-diarization)

**Self-hosted alternative:** a Python service with WhisperX for transcription and
alignment plus pyannote.audio for diarization, and a separately evaluated identity
matcher. Python exposes the relevant model tooling; native inference performs the
heavy computation. Go is suitable for transport/job orchestration but is not needed
for the prototype. Existing WASM also already executes compiled inference code.
[WhisperX](https://github.com/m-bain/whisperX) documents word alignment and diarization,
and explicitly notes limitations with overlapping speech. Neither option guarantees
correctness on these family/device recordings without a comparative evaluation.

GitHub Pages remains the static frontend. A service requires separate HTTPS hosting
or a securely reachable home computer; [Pages is static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
Keep provider credentials on the server, restrict access and bound usage. Agree
audio processing/retention and costs before enabling uploads. Different embedding
models require fresh enrollment; current stored vectors cannot reconstruct the
discarded registration audio. No existing recordings/profiles are uploaded by
this proposal.

Exact preservation of browser wording in the upper pane would need separately
validated acoustic forced alignment against captured audio. The current text-anchor
scheme is not a substitute. Prefer an independent, stronger timestamped transcript
above during evaluation; only replace the accepted live provider if a later test
proves equivalent or better live recognition.

## Evaluation before migration

Benchmark recordings from enrolled people on a different session from enrollment,
an unenrolled live person, audiobook playback, short phrases, pauses, A/B/A turns,
repetition and overlap. Obtain authorization before collecting or uploading new
audio. Compare the same audio across candidates and the baseline. Measure word
error rate, correctly attributed word coverage, false names on unknown speech,
boundary-word retention, end-of-turn delay (median/p95), sustained backlog and cost.
Distinguish recorded-voice rejection from live-person identification accuracy.

First implement provider-neutral transcript contracts and a replay evaluator, then
test one managed candidate against one self-hosted candidate if hardware permits.
Choose from measured accuracy/latency/cost before wiring a phone upload stream.
This document is a researched proposal, not a tested implementation or a replacement
of the currently deployed app. No tests are required for the documentation alone.
