# ADR 0020: Replace Android cumulative recognition revisions

Date: 2026-10-11
Status: Accepted; supersedes ADR 0019's result grouping for Android Chromium

## Context

The user reports that the continuous-mode deployment again repeatedly prints the
same line. Its physical acceptance test failed; the prior desktop simulations did
not exercise Android result semantics. No phone event payload or audio was collected.

Chromium's Android bridge converts partial callbacks to final in continuous mode
and terminates on Android's completed-results callback. Native confidence can also
be absent. See [Chromium implementation](https://raw.githubusercontent.com/chromium/chromium/main/content/public/android/java/src/org/chromium/content/browser/SpeechRecognitionImpl.java)
and its [native bridge](https://chromium.googlesource.com/chromium/src/+/lkgr/content/browser/speech/speech_recognizer_impl_android.cc).
These sources were inspected on 2026-10-11; the phone's installed version is unknown.

Our strict-prefix heuristic does not collapse equal repeats or revised wording,
and speech-start groups can separate updates. A synthetic Android-shaped sequence
with duplicate and corrected final-marked slots reproduces the displayed spam.

## Decision

Select a small compatibility adapter for Android Chromium user agents, including
reduced Android UAs. Keep continuous capture and interim results enabled. Within
each native cycle, the latest hypothesis replaces one stable display slot, without
depending on prefix similarity, speech-start grouping, confidence, or the promoted
final flag. Keep that slot provisional until a normal native end, then commit it
once. A later native cycle gets a different ID and can contain the same words.

Errors, background interruption, cancellation, disposal and Stop timeout discard
the unfinished hypothesis. Successful button Stop permits the last completed
result. Spoken Stop is evaluated after completion; a command that gets revised
away must not stop capture. Keep existing command boundaries, retention, restart
backoff and non-Android behavior. No extra microphone, model, persistence or UI.

## Consequences

Words remain live and replaceable, but confirmation (including voice Stop) waits
for provider completion, which may require a pause. Earlier committed captions
remain stable. This is specific provider compatibility, not a generic text
deduplicator: repeated words within speech and repeated later utterances survive.

The adapter assumes cumulative hypotheses until the Android native end. A provider
that emits independent completed chunks without ending would need different
handling; multi-sentence phone testing remains required. The user has not yet
confirmed this fix. No claim of gap-free native capture or speaker attribution.

## Validation

Unit coverage includes unchanged duplicates, growth, spelling corrections, final
flags with multiple confidence values, empty revisions, repeated speech events,
pause continuation, native completion, deliberate repetition in later cycles,
confirmed/revised voice commands, successful/timed-out button Stop, errors and
late callbacks after interruption/disposal. Browser tests inject an Android UA and
Android-shaped results to exercise actual composition and rendering in both test
engines. These are simulations, not physical Android or iPhone acceptance.
