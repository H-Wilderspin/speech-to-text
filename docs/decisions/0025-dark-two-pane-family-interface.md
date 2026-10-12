# ADR 0025: Dark two-pane family captions

Date: 2026-10-12
Status: Accepted; supersedes the display/filtering proposal in ADR 0024

## Context

The user chose immediate captions for everyone below, with only assigned speakers
above. Unknown speech must be omitted from the upper pane. They requested dark
mode, light-grey live text, selectable high-contrast speaker colours, and a small
Settings interface without consent text or lengthy explanations.

## Decision

- Two equal-height, independently scrolling panes fill the space below the existing
  Listen/Stop, Clear and Settings controls. The top contains only final segments with
  both a speaker ID and name. Unknown/unassigned/interim speech is omitted there;
  it is not deleted from the live transcript. Existing experimental names retain
  the short `(estimate)` suffix; filtering does not upgrade matching confidence.
- Both panes use browser words. Attribution slices retain their original browser
  segment ID, allowing the lower pane to rejoin the exact text without new paragraph
  breaks or colour changes when labels arrive. No new recognition model or threshold.
- Dark background #121619, live text #d1d5db. Eight selectable speaker colours each
  exceed 7:1 text contrast against that background. Names remain visible as a second
  identity cue. Profile-ID colour choices, text size and language are saved under an
  app-path-specific localStorage key; invalid choices fall back to safe defaults.
- Settings holds text/language, registration/colours and the optional name-processing
  switch/preparation. Registration needs a name and an explicit Record button action.
  Compare and bulk-delete controls are under More. Provider information and model
  licence links remain under a collapsed About section, with no consent checkbox.
- The user's explicit family-project instruction overrides the earlier enrolment
  consent UI requirement. New profiles record `registrationMethod: record-button`,
  not fabricated checkbox consent. Validation still accepts existing version-1
  consent metadata, so no saved voiceprint migration or re-enrolment is necessary.
  Comparison also requires its explicit Record action without a checkbox.

## Consequences

Own speech and unknown speech still appear immediately below, as requested. This
does not implement automatic listener exclusion. Existing experimental attribution
may be wrong or leave the upper pane empty. A split layout does not establish phone
performance, correct speaker identity, or simultaneous microphone compatibility.
Model downloads remain lazy and cached; no new service, dependency or recording
retention. Raw recordings are discarded; transcripts remain in memory only.

## Validation

Tests cover upper-pane exclusion, exact live-text reconstruction, intentional
repetition, profile compatibility, palette contrast, saved preferences/colours,
registration/deletion and the existing microphone/model lifecycle. See feasibility
for executed checks. Physical Pixel 8/iPhone acceptance remains outstanding.
