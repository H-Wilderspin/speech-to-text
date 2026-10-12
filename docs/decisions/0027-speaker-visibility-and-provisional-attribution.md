# ADR 0027: Speaker visibility and independently completed attribution

Date: 2026-10-12
Status: Accepted; refines ADRs 0023, 0025 and 0026

## Context

The user wants a per-person activity button that excludes that person's speech
from Who said what. They also report that the upper pane stays empty even after
Stop, without a preparation/error message. No phone trace or audio was collected.

Code inspection and regression fixtures identify two gates: Android captions
remain provisional until native recognition ends to prevent growing duplicates,
but attribution and the upper view both previously required browser-final text.
Separately, six consecutive words had to agree exactly between recognizers, so
one wrong word could prevent a match even with a final local voice estimate.
These are reproducible limitations, not a proven complete diagnosis of the phone.

## Decision

- Add an eye/hidden-eye toggle to each profile pill. Active is the default;
  hidden profile IDs persist in the app-path display preferences. Filtering is
  immediate and reversible for existing and new upper-pane text. Lower captions
  remain complete. Deleting profiles removes their colour/visibility preferences.
- Keep inactive people in voice matching. Removing their references could cause
  their voice to be incorrectly offered as an active person's identity. The
  toggle changes presentation only and never starts/stops capture or clears text.
- Record `speakerEvidenceFinal` separately from browser `isFinal`. Final local
  phrase/voice evidence may label exact corresponding browser words while the
  browser segment is provisional. The top accepts these matched slices; both
  views continue replacing revisions by source ID. Unmatched text and provisional
  local evidence never gain an identity. No fabricated browser timestamps.
- Keep unique, monotonic six-word exact anchors. Additionally permit two unique,
  non-overlapping three-word anchors, with at most one intervening word in each
  recognizer and one final identity across the entire local span. This still
  requires six identical ordered words (at least six of seven within either
  span). Reordered/ambiguous triples do not qualify. Never assign the differing
  word or bridge a speaker/unknown transition through this fallback.
- Show a short diagnostic only in Settings: no local words recognized, speech
  without a voice match, a voice match awaiting matching words, or matching names.
  It contains no audio, transcript, similarity score or personal identity.

## Consequences

The activity button can suppress a registered listener's attributed speech above,
while all immediate speech stays below. Unknown speech is still omitted above.
Hidden references still incur the existing matching cost. No new model, service,
dependency, biometric threshold or profile schema; existing caches are reused.

Matching remains experimental. Sparse, wrong or repeated recognition can still
leave the upper pane empty. Phone microphone coexistence, human accuracy and the
reported after-Stop failure need a physical retest using the new diagnostic if
necessary. Exact word agreement is correspondence evidence, not a new calibrated
identity guarantee. Provisional browser corrections can withdraw an earlier label.

## Validation

Unit regressions cover provisional browser/final local evidence, untouched live
text, corrected/withdrawn labels, a single substitution/insertion/deletion, short
or repeated phrases, speaker changes and visibility filtering. The generated
AudioWorklet browser test now simulates Android's cumulative result flags and
requires an upper name before native end/Stop; it checks activity off/on without
capture restart or changes to lower text. Settings tests cover three buttons,
persistent activity state and preference cleanup after protected deletion.
