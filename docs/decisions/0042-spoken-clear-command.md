# ADR 0042: Spoken Clear alongside spoken Stop

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-14
Status: Superseded by [ADR 0043](0043-session-reset-and-pause-lines.md); originally extended ADR 0041

## Decision

Recognize the complete English phrase "command clear" with the same confirmed-word,
case-insensitive, punctuation-tolerant matching as "command stop". Process commands
in spoken order. Clear hides text up to and including the command, preserves speech
following it, and leaves browser/local capture running. Repeated cumulative results
must not execute the same command again. The existing display boundary advances
through each consumed command without restarting native recognition.

A monotonic browser clear revision resets the composed engine's earlier manual
history and any button-Clear boundary exactly once. Delayed speaker results cannot
restore cleared words, and later speech can still receive names. Local model output
does not trigger Clear; browser words remain authoritative in the main app.

## Consequences and validation

Provisional guesses remain text until confirmed. Android waits for successful native
session completion, as Stop already does. A command may span final result slots or
automatic native restarts, but not a manual Stop/new Listen boundary. Commands are
not saved. The previous display-cut limitations still apply to revised hypotheses.

Tests cover punctuation, word boundaries, provisional guesses, cross-slot commands,
replayed results, following text, multiple commands, Android finalization, delayed
names, manual history and button/voice Clear interaction. Published browser checks
use simulated recognition; physical-phone command latency remains unmeasured.
