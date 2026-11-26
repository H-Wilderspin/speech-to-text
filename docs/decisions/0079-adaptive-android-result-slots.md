# ADR 0079: Detect segmented Android speech results

Date: 2026-11-26
Status: Accepted; narrows ADR 0020's cumulative-result workaround to legacy result streams.

## Context

The Pixel follow-up reports earlier sentences disappearing when speaking resumes
after a pause. ADR 0076 preserved text when capture ended, but the Android adapter
still discarded every result except the last within a continuing native session.

The current [Chromium Android bridge](https://raw.githubusercontent.com/chromium/chromium/main/content/public/android/java/src/org/chromium/content/browser/SpeechRecognitionImpl.java)
supports finalized segments during continuous capture and genuine interim results.
The older bridge promoted all partial callbacks to final-marked revisions, which
motivated ADR 0020. The phone's native event stream was not captured; fixtures of
the newer contract reproduce the reported loss in the deployed adapter.

## Decision

On Android, observing a result explicitly marked interim selects standard result
slots for the engine's lifetime, including subsequent native restarts and Clear.
Reconcile the complete result snapshot, retain completed slots and replace only
interim wording. Assign separate utterance groups to separate slots so deliberately
repeated or extended sentences cannot be collapsed together. Native end does not
promote remaining interim words to confirmed commands in this mode.

Until that distinguishing signal is observed, retain the legacy cumulative adapter
and its command-safety rules. Do not guess from elapsed silence, word similarity,
confidence or a browser-version threshold. Continuous capture, privacy, retention
limits, Clear invalidation and existing pause formatting remain in force.

## Evidence and limits

Regression fixtures failed before this change when a finalized sentence was
followed by another interim in the same session. Coverage includes repeated and
extended sentences, late mode discovery, native restart/Clear, unfinished command
text and confirmed commands without native end. Browser tests exercise multiple
pause/resume sequences and screen changes without restarting capture.

This does not establish physical Pixel acceptance. A stream containing only final
flags is ambiguous and retains the legacy interpretation until an interim appears.
Retest on the phone using several distinct and repeated sentences with pauses.
