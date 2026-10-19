# ADR 0050: Optional meal planner alongside live captions

Date: 2026-10-19
Status: Accepted; extends ADR 0047

The checkbox and automatic split direction below are superseded by
[ADR 0051](0051-explicit-split-orientation.md). The mounted-dialog approach remains.

## Context

The user wants to discuss the meal plan while reading live captions. The existing
modal hides captions even though recognition continues. Captions and meals must
be usable together without adding another recognition engine or losing meal drafts.

## Decision

Add a Show alongside captions checkbox to the planner. Keep the initial full
planner view; remember the layout choice in page state only. The combined view
uses two columns above 900px and stacked, independently scrolling panes below.
Meal layout follows its container width rather than the viewport so a narrow
tablet panel receives the same compact day layout as a phone.
Keep the layout switch in the pinned header. In combined view the editor scrolls
with the meal content rather than covering it, leaving the switch reachable.

Keep one mounted planner, changing its native dialog between modal and nonmodal
display. Close/reopen the same element when changing mode, restoring focus to the
switch and ignoring queued close events when it is already open again. Children
remain mounted, preserving the selected week, draft and pending refresh state.
In nonmodal mode the dialog participates in the page grid and permits caption
controls and Settings interaction. Back hides it; Escape closes it when focus is
inside it. Layout changes and closing remain disabled during saves.

## Consequences and validation

No new dependency, transcript persistence, microphone stream or data format.
The choice resets on reload. Phone screens devote less space to each pane, so
full planner and captions-only views remain available. Native phone keyboards,
screen readers and physical device usability still require manual acceptance.
Browser coverage exercises ongoing captions, Clear/Stop, narrow/tablet layouts,
Settings, draft/week preservation, save focus and Escape. Results are recorded in
the feasibility log.
