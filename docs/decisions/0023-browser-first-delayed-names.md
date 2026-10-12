# ADR 0023: Browser captions first, delayed experimental name estimates

Date: 2026-10-11
Status: Accepted for opt-in estimates; device coexistence and human matching pending

The opt-in toggle is superseded by automatic preparation for registered profiles in
[ADR 0026](0026-single-pane-settings-automatic-names.md); browser words remain authoritative.

## Context

After ADR 0022's larger local recognizer, the user still reports unsatisfactory
transcription accuracy and explicitly prefers accurate words with delayed speaker
detection. More successful generated clips cannot override that failed phone
acceptance. Their earlier authorization of experimental estimated names remains.

The [Web Speech timestamp proposal](https://github.com/WebAudio/web-speech-api/blob/main/explainers/speech-recognition-result-timestamps.md)
documents the missing result audio boundaries and why speech-start/event arrival
does not locate individual utterances. Simply waiting longer and attaching the
latest microphone identity to a browser result is not a valid solution.

## Decision

Restore browser recognition as the sole source of displayed words in all product
modes. The unchanged Android adapter handles growing hypotheses, pause restart
and voice Stop. Optional local processing uses the existing models and voiceprints
as an independent source of delayed estimates. Do not buy/download another ASR
model, add a server, upload voiceprints, or replace browser text with local output.

Local ASR token points and speaker windows retain their real shared sample clock.
Transfer an existing local word estimate only where **six consecutive normalized
words match exactly and uniquely in both current-session transcripts**. Require
monotonic anchor order; conflicting mappings, local uncertainty and interim browser
words remain anonymous. Normalize case/apostrophe spelling for comparison only.
Copy exact original browser slices, including punctuation and spacing, to display.
Never assign browser timestamps or extend a label over unmatched words.

This is conservative **text correspondence**, not acoustic forced alignment,
reliable diarization, or a calibrated identity threshold. Six words is an explicit
engineering gate, not human accuracy evidence. Repetition plus asymmetric omissions
can still produce a false correspondence; matching mistakes can still produce a
false name. Names remain marked `(estimate)`. Short or poorly recognized speech
will often stay Unknown. This approach intentionally prioritizes useful words
over name coverage and supersedes ADR 0021's separate-local-caption product mode.

The browser and local engines start within the same Listen gesture. Local failure
does not stop or replace browser captions and produces a visible status. Browser
Stop/confirmed command stops both captures; local draining can finish estimates
after capture ends. Local ASR cannot trigger the user-facing voice command. New
manual sessions clear matching evidence while retaining prior displayed captions;
Clear, interruption and disposal prevent stale evidence reuse. Text stays bounded
to the existing 100,000-character limit; no raw audio or transcripts persist.

## Privacy, upgrade and platform limits

Settings explicitly explains that browser speech may be sent to its provider while
voiceprints/matching remain local. A new path-scoped preference is opt-in: old
local-only preferences do not silently enable concurrent recognition. On reopening,
browser captions are immediately available, with no model download. Selecting
Prepare name suggestions reuses verified existing cached files and enables delayed
names. No enrolment or new model download is required when the cache is intact.

This no longer promises offline transcription. Two independent microphone clients
may contend on Android/Safari; real phone coexistence, energy use and name delay
must be measured. The current local capture bound still limits sustained backlog;
an overrun disables further estimates while browser captions continue. Turning off
estimates removes that extra capture/inference workload.

## Validation

Unit regressions cover exact text preservation, corrections, short/ambiguous or
reordered anchors, provisional words, local failure isolation, command/button Stop,
draining, manual-session isolation, Clear and reactivation. Browser regression uses
real generated AudioWorklet input and actual local inference alongside explicitly
simulated browser results: words appear first, names arrive later, text is unchanged,
and both captures stop. It does not measure browser-service acoustic accuracy or
prove that two physical microphone clients coexist on phones. Existing real local
known/other voice, cache, migration and Android reconciliation checks remain.
Executed checks and outstanding phone acceptance are recorded in feasibility.
