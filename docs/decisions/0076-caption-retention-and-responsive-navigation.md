# ADR 0076: Retain visible captions and bound navigation waits

Date: 2026-11-25
Status: Accepted; amends ADR 0020's discarded provisional captions and ADR 0066's navigation wait.

## Decision

Recognition end, silence errors, Stop and interruption retain the latest visible
words in session memory. Unconfirmed words keep that flag and cannot trigger
commands. A new native cycle starts a new line. Live corrections, explicit Clear,
reload/disposal and the existing rolling retention limit still apply. No captions
or audio are persisted. This trades removal of abandoned guesses for continuity
of the text the reader has already seen.

Screen changes allow up to 150ms for local persistence, then proceed with the
app-owned queue intact. A newer selection supersedes an earlier pending one.
IndexedDB opens and transactions time out after three seconds; timed-out writes
are aborted, late open results are closed, and subsequent attempts may reconnect.
Failed local saves retain edits in memory, warn before exit and block unsafe
updates. Network saves continue independently.

## Evidence and limits

Regression fixtures reproduce dropped provisional words on recognition end and
navigation trapped behind an unresolved IndexedDB request. Tests cover Android
silence recovery, pause lines, command safety, rapid selection, stalled writes
and later sync. These are simulated provider/storage failures; a physical Pixel
retest is still needed to establish whether they explain all reported symptoms.
