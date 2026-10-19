# Documentation

The [interface style guide](interface-style.md) records the shared palette,
control sizing and compact layout choices.

The current product combines live captions, shared meal/task planning and shopping. Start with
the root README, [meal setup](meal-planner.md), [task setup](cleaning-planner.md),
[shopping setup](shopping-list.md), [shopping decision](decisions/0055-shared-shopping-list.md),
[shopping drag/delete controls](decisions/0056-shopping-drag-and-delete.md),
[batched shopping saves](decisions/0057-batched-shopping-saves.md),
[Sunday task resets](decisions/0058-sunday-task-completion-reset.md),
[whole-row shopping dragging](decisions/0059-shopping-row-dragging.md),
[ADR 0046](decisions/0046-live-transcription-only-mvp.md),
[ADR 0047](decisions/0047-shared-meal-planner.md),
[remembered editing access](decisions/0048-remember-meal-access.md) and
[weekly defaults](decisions/0049-recurring-meal-defaults.md) and
[meals alongside captions](decisions/0050-meals-alongside-captions.md) with
[split orientation icons](decisions/0051-explicit-split-orientation.md), plus
[narrow viewport controls](decisions/0054-narrow-viewport-split-controls.md),
[cleaning checklists](decisions/0052-shared-cleaning-checklists.md),
[Update app](decisions/0053-user-triggered-app-updates.md) and
[manual testing](manual-testing.md). The latest feasibility entries record changes
and checks; older entries describe historical builds.

Speaker asset guides, diagnostics, comparison benchmarks, service measurements and
the original acceptance audit are historical research. Their commands, endpoints,
source paths and feature claims no longer describe the MVP. Implementation before
removal is recoverable at Git commit `37835e4`; private ignored files are not part
of the repository. Keep historical findings for a separately scoped future effort,
not as requirements to restore the feature.
