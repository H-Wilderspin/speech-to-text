# ADR 0040: Restore continuous Live sentence composition

Date: 2026-10-14
Status: Accepted; supersedes ADR 0039's split Live reading layout

## Context

The user reports lost text integrity with the separate latest-sentence/history
areas and explicitly requests returning to inline sentence composition.

## Decision

Restore the previous shared transcript renderer: one chronological list of captions
in one scrolling Live viewport. Interim text updates its existing caption; finalized
text stays in that flow. Keep existing follow-at-bottom behaviour and preserve a
reader's position when they scroll back. Remove the split-only layout and scroll
reset. Reuse the original browser-segment reconciliation without engine changes.

## Consequences

Long utterances use the full Live viewport again, and completed sentences do not
move between separate areas. Light mode, speaker colours, Live-first pane order,
collapsible Who said what and bottom controls remain. The report alone does not
establish a recognition/data-loss defect; this change restores the requested display.

## Validation

Browser regression checks cover in-place interim/final updates, chronological
complete text, no duplicate captions, a single viewport, Stop/Clear and scrolling.
Run required project checks and verify Pages publication. Physical-device feedback
remains separate from simulated-browser verification.
