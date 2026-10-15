# ADR 0043: Reset recognition sessions on Clear and retain correctable inline lines

Date: 2026-10-15
Status: Accepted; supersedes ADRs 0041 and 0042

## Context

The user reports both active-Clear implementations fail and authorizes replacing
display masking with explicit capture restart and session isolation. They want
inline composition, new lines after brief pauses, and incremental scrolling.
The browser provider can revise cumulative text and does not supply word times.
An event-free interval is not evidence of acoustic silence. The approved design
review therefore distinguishes a proposed display break from final recognition.

## Decision

- Main-app browser lines have a logical session ID, stable source ID and arrival
  revision. Native automatic restarts retain the logical session; Clear increments
  it once before any asynchronous work. Manual Listen starts another session.
- Both Clear actions immediately empty both panes, invalidate old callbacks and
  cancel pending pause/restart timers. Abort the old native recognizer and await
  its end before starting another. If native end has already occurred, do not
  wait for a second event. Coalesce repeated Clear during retirement. Stop or
  interruption cancels resumption. A two-second unconfirmed retirement fails
  visibly rather than silently opening a competing recognizer.
- The entire cleared payload is obsolete, including words after a spoken Clear.
  Commands only act on confirmed browser text; Android confirmation still waits
  for successful native end. Provisional guesses do not execute commands.
- Abort local capture and queued input immediately. Let the one in-flight worker
  operation finish without accepting its output, then reset ASR/voice state and
  temporary references in order. Retain initialized model weights. Reload saved
  references for the new session. Worker request ID and session ID must both
  match; old results/errors cannot affect captions. Failed reset permits cached
  preparation recovery without blocking browser captions.
- A provider speech-end event starts a 500ms debounce, cancelled by new speech
  or sound. It records a display boundary, not finality. If subsequent cumulative
  text extends that unchanged prefix at a word boundary, render its suffix on a
  new line. If the prefix is corrected, render the complete corrected source
  together rather than guess offsets or discard words. Keep final browser phrases
  as the fallback when the provider supplies no usable pause event.
- Keep existing bottom-following scroll: only follow new lines while near the
  bottom; preserve scrollback. Emptying the log restores following.

## Consequences

Clear now creates a short capture gap. Mobile automatic restart permissions need
physical verification. Exact 500ms acoustic-to-word boundaries remain infeasible
with this provider interface; the browser may report speech end late or not at all.
Late corrected wording may merge a provisional display break. No extra microphone
stream, remote service, threshold changes, saved transcripts or model download
requirement is introduced. Session/revision metadata is local and numeric.

## Validation

Regression tests cover standard/Android Clear, replayed callbacks, native-end
handoff, Stop winning restart, timeout, confirmed commands, corrected prefixes,
old name/error rejection, worker IDs, model retention and scrolling. Browser
tests include real local models with generated audio; recognition is simulated.
See the 2026-10-15 entry in [feasibility](../feasibility.md) for actual run results
and physical-phone acceptance steps.
