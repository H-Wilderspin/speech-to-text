# ADR 0019: Keep native recognition running across pauses

Date: 2026-10-11
Status: Accepted; supersedes ADR 0014's single-utterance mode and productive restart delay

Update: the user's physical retest reported repeated-line spam. [ADR 0020](0020-android-cumulative-recognition.md) replaces Android result handling while retaining continuous capture.

## Context

The Pixel 8 user confirms missing opening words specifically after pauses between
sentences. The previous adapter requested single-utterance recognition, then
waited at least 200 ms after native end before starting another recognizer. That
capture gap is demonstrable in the adapter; the phone's actual event/audio trace
was not collected, so the precise acoustic cause remains a hypothesis.

## Decision

Request `continuous = true` with interim results. Keep the original recognizer
through pauses whenever the provider allows it. Retain automatic restart for
providers that end anyway. A cycle containing text restarts on the next timer task
with no added delay; empty cycles retain 200 ms to two-second backoff. Stop,
interruption, terminal errors and cancellation keep their existing semantics.

Use native `speechstart` events to group result slots. New slots belong to the
current speech group; existing slots retain their group when late finals arrive.
Collapse strict cumulative phrase extensions only within a group. Do not extend a
previous group's final slot. These groups are neither speaker IDs nor timestamps.
Providers without speech-start events retain the existing within-cycle heuristic;
unusual independent prefix-extending results remain ambiguous in that fallback.

## Consequences

This removes the deliberate sentence-by-sentence capture gap, but does not promise
uninterrupted capture from every browser/provider. Native restart and service
latency can still lose audio; no buffer or fabricated words cover that interval.
Both repeated-prefix sentences and growing cumulative hypotheses have regressions.
The main page remains three buttons and captions. No model or data policy changes.

Live identity remains unresolved as described in ADR 0017: production browser ASR
does not consult profiles, while the shared-clock prototype lacks human calibration
and fails unequal-volume overlap. Successful enrolment/comparison is not evidence
that live identity is enabled. Do not patch this by labelling all speech as the
first saved profile or pairing delayed text with the latest microphone sample.

## Validation

Unit tests cover continuous configuration, a 15-second simulated pause, independent
prefix-extending sentences, delayed finals, cumulative output, immediate productive
restart and existing lifecycle failure cases. Browser regression repeats pause,
sentence retention and spoken Stop with a simulated recognizer. Exact checks and
physical-device limitations are recorded in feasibility and manual testing.

Sources: [continuous](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/continuous),
[results](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionEvent/results).
