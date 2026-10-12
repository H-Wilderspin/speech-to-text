# ADR 0024: Two caption panes and filtering the listener's speech

Date: 2026-10-12
Status: Proposed; recommendation only, not implemented or deployed

Follow-up: [ADR 0025](0025-dark-two-pane-family-interface.md) implements the user's
chosen variant: everyone live below, assigned speakers only above. Automatic
listener suppression and partner-controlled capture remain proposals, not features.

## Context

The user proposes two vertically stacked panes: delayed who-said-what above,
immediate discussion captions below. The priority is that the person reading the
captions does not need to read her own speech. Previous local recognizers reduced
transcription quality on the user's phone. ADR 0023 keeps browser words authoritative
and adds experimental names through delayed phrase correspondence.

The Web Speech result interface provides no speaker identity. Its timestamp
proposal documents missing acoustic boundaries; event arrival is not speech timing:

- https://webaudio.github.io/web-speech-api/
- https://github.com/WebAudio/web-speech-api/blob/main/explainers/speech-recognition-result-timestamps.md

Consequently, a fast voice match cannot safely be attached to whichever browser
result arrives next. Splitting the display alone does not fix microphone contention,
phone inference load, alignment, or speaker accuracy.

## Proposed direction

- Retain Listen/Stop, Clear and Settings. Start with an adjustable horizontal divider
  and equal-height panes. Keep large text and independent scrolling; follow new
  text only when the reader is already at the bottom of that pane.
- Bottom: immediate browser captions, with interim words replaced in place.
- Top: final browser wording grouped by delayed speaker evidence, consistent names
  and colours, and explicit Unknown/estimate states. Do not substitute local ASR
  wording or suggest the delayed transcript is verified. Both views share canonical
  text, so delays and failures cannot produce two conflicting transcriptions.
- Speaker inference stays outside the live-caption rendering path, with bounded
  work and backlog. If it cannot keep up, prioritise live text and show that speaker
  processing is delayed/unavailable. A split display offers no performance guarantee.

## Filtering choices

Add a Settings choice for the reader's consented profile. Treat suppression as a
separate, more consequential decision than displaying an experimental name.
Current uncalibrated name estimates are insufficient for automatic removal.

1. Immediate captions with later hiding: after calibrated identity AND reliable
   text alignment, collapse only the reader's matched text. Preserve underlying
   in-memory text for Show all/undo. Keep uncertain, short, mixed-speaker and
   overlapping speech visible. Her speech may appear before identification.
2. Delay before display: hold captions until a speaker decision or timeout, then
   show uncertain speech on timeout. This trades latency for fewer appearances of
   her words; it does not guarantee exclusion. Measure any delay on actual phones
   rather than promise an arbitrary buffer duration.
3. If exclusion before display is essential, evaluate partner-controlled capture:
   a close microphone for the person addressing her, preferably with an explicit
   hold-to-talk/mute control and turn-taking. Physical placement alone cannot exclude
   nearby voices or overlap. Verify the browser actually uses the selected input
   and that gating preserves utterance starts before recommending hardware.

Recommend the two-pane design and partner-controlled input when never showing her
words is essential. For hands-free shared-microphone use, describe later hiding as
best effort, not an already solved live voice filter. Do not repeatedly restart
browser recognition based on guessed speaker changes, which risks losing words.
Filtered-audio input is a separate platform experiment, not assumed portable:
https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start

No new service, paid dependency, model download, audio persistence or cloud
voiceprint processing is proposed. Existing browser-provider audio disclosure
continues to apply. Hiding displayed words does not prevent provider processing.

## Validation before enabling automatic hiding

- Compare live-word accuracy and delay with attribution disabled/enabled on Pixel 8
  and iPhone; test actual microphone routing and concurrent capture.
- Use consented reader/other/unknown voices across sessions, brief replies, turn
  changes, similar voices, noise and overlap. Measure incorrectly hidden other-person
  words, reader-word leakage and time to removal, separately from name accuracy.
- Calibrate suppression against held-out human examples. Retain unknown text,
  reversible filtering, microphone Stop/command Stop and local-failure fallback.
- Verify enlarged text, divider accessibility, independent scrolling, stable layout,
  and avoiding duplicate screen-reader announcements from the two views.

This document records a recommendation from code/documentation review. No new
physical-device or speaker-accuracy evidence was obtained, and no runtime changed.
