# ADR 0041: Clear captions without restarting capture

Date: 2026-10-14
Status: Accepted

## Context

Clear was disabled during listening and both main transcription engines ignored
active Clear calls. Restarting native recognition to clear it would reopen the
capture gaps previously reported on Android. Native cumulative results and delayed
speaker updates can also restore text if only the rendered list is emptied.

## Decision

Enable Clear whenever the main app has displayed text. During capture, mark a
display boundary using browser segment IDs and their current word counts. Hide
those words from both panes; subsequent words compose in place. Use language-aware
word boundaries, including languages without spaces. Cumulative slots keep their
first caption ID. Apply the same boundary to delayed name slices by original
browser segment ID, after alignment with the complete recognition context.

Clear does not stop/restart recognition, local capture or model processing. Existing
bounded, in-memory recognition context is retained during that session, with no
new persistence. Idle Clear still discards engine text. A new manual session keeps
only the visible history. Reset scroll following when the display becomes empty.
The inactive PC comparison remains unchanged.

## Consequences

Cleared text cannot reappear merely because names arrive or recognition repeats
the same result. New words within an ongoing utterance remain visible. This is a
display-word boundary, not an exact microphone-time cut: a provider that later
inserts/deletes earlier words can shift where an unfinished utterance is trimmed.
Prefer clearing between sentences when an exact sentence boundary matters.

## Validation

Unit coverage checks active capture, Android and standard cumulative revisions,
repeated Clear, delayed names, Stop, voice Stop, new sessions and word boundaries.
Browser checks exercise Clear through the main app without replacing the native
recognizer. Physical Pixel 8 verification remains separate from simulated tests.
