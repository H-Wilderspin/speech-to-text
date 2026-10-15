# ADR 0037: Return to the browser plan with collapsible attribution

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-13
Status: Accepted; supersedes ADRs 0035/0036 as the active rollout plan

## Context

The user considers the PC service impractical for available hardware and requests
the previous browser plan, with the diarized panel collapsible while development
continues. The original app's browser recognition and local delayed attribution
engines were never replaced by the separate comparison entry point.

## Decision

Keep the main browser app as the supported route and retain the separate service
as inactive research. Make its Who said what heading an accessible toggle with
`aria-expanded` and `aria-controls`. Start collapsed for both fresh and existing
preferences without an explicit choice. Persist the choice alongside existing
display settings and keep the three top toolbar controls.

When collapsed, the live pane takes the available space below a compact title row.
Hide the upper contents from display, keyboard navigation and accessibility APIs;
retain caption state. Expansion returns to two equal pane rows. Toggling does not
stop recognition, clear text, change attribution decisions or request microphone
access. Existing local processing continues while hidden; this is not a CPU or
accuracy optimization. Keep profile visibility, colours and settings intact.

## Consequences

Family use can prioritize live captions without reserving half the screen for
unfinished attribution. Developers can reopen it without restarting a conversation.
The private PC service setup is no longer an acceptance prerequisite. Hardware
and matching limitations remain recorded rather than being presented as solved.

## Validation

Browser checks cover default collapse, restored pane height, keyboard activation,
active recognition and one evolving sentence across toggles, focus, persistence
through reload, and the existing local attribution flow with the pane expanded.
See feasibility notes for executed checks and publication results.
