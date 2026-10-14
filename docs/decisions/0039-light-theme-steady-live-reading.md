# ADR 0039: Light theme and a stable live reading area

Date: 2026-10-13
Status: Accepted; supersedes ADR 0025's dark presentation

The split Live reading layout is superseded by [ADR 0040](0040-restore-continuous-live-transcript.md).
The light theme and colour migration remain in use.

## Context

After testing on the target device, the user prefers light mode and needs the
most recent sentence to stay in a predictable place for easier reading.

## Decision

Use an off-white background and dark neutral text throughout the app and Settings.
Use darker versions of the eight speaker colour families, preserving saved choices
from the dark palette. Verify at least 7:1 contrast against the caption background.
Update browser/PWA theme metadata too.

Split the Live reading area into two fixed equal-height rows. The newest browser
utterance appears in the top row, and earlier utterances appear once in the bottom
history row. Both scroll independently. Growing hypotheses revise the same text;
finalization reserves the same left indent so the sentence does not jump sideways.
A new utterance resets only the current reading area's scroll to its beginning.
History retains its existing follow/unfollow scroll behaviour.

## Consequences

No additional buttons, identity changes or transcription-engine changes. The
existing collapsible assigned panel is preserved. Long utterances require scrolling
within the current reading area; new words do not automatically move its origin.
The browser determines utterance boundaries, which can include multiple sentences.
Opening the assigned panel or changing text/viewport size intentionally changes
available space. Screen-reader DOM order remains chronological (history, current).

## Validation

Contrast and old-colour mapping unit tests; browser checks for a stable text origin
through wrapping, finalization and a new utterance; history scrolling, Clear/Stop,
colour selection, PWA installation, enlarged text and existing live captions.
Record observed results in feasibility notes; no physical-device claim is inferred.
