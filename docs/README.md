# Documentation

The [interface style guide](interface-style.md) records the shared palette,
control sizing and compact layout choices.

The current product combines live captions, shared meal planning and shopping. Start with
the root README, [meal setup](meal-planner.md),
[shopping setup](shopping-list.md), [shopping decision](decisions/0055-shared-shopping-list.md),
[shopping drag/delete controls](decisions/0056-shopping-drag-and-delete.md),
[local-first planner sync](decisions/0066-local-first-planner-sync.md),
[free hosted family connection setup](hosted-editing.md) and
[its architecture](decisions/0071-free-hosted-family-editing.md),
[whole-row shopping dragging](decisions/0059-shopping-row-dragging.md),
[ADR 0046](decisions/0046-live-transcription-only-mvp.md),
[ADR 0047](decisions/0047-shared-meal-planner.md),
[automatic connection and token renewal](decisions/0063-automatic-token-persistence-and-renewal.md) and
[weekly defaults](decisions/0049-recurring-meal-defaults.md) and
[meals alongside captions](decisions/0050-meals-alongside-captions.md) with
[tablet-sized split toggle](decisions/0061-tablet-side-by-side-toggle.md) and
[global footer navigation](decisions/0062-global-footer-navigation.md),
[Settings split and toggle](decisions/0067-settings-split-and-toggle.md),
[shared footer refresh and meal header](decisions/0064-footer-refresh-and-planner-header.md),
[desktop-only Refresh icon](decisions/0069-desktop-refresh-icon.md),
[touch week navigation](decisions/0070-touch-week-navigation.md),
[Update app](decisions/0053-user-triggered-app-updates.md),
[updating directly from Settings](decisions/0065-update-directly-from-settings.md) and
[manual testing](manual-testing.md). The latest feasibility entries record changes
and checks; older entries describe historical builds.

The task planner is removed; [ADR 0060](decisions/0060-remove-task-planner.md)
supersedes its feature decisions. The [old task guide](cleaning-planner.md)
remains solely as a reference for existing data.

Speaker asset guides, diagnostics, comparison benchmarks, service measurements and
the original acceptance audit are historical research. Their commands, endpoints,
source paths and feature claims no longer describe the MVP. Implementation before
removal is recoverable at Git commit `37835e4`; private ignored files are not part
of the repository. Keep historical findings for a separately scoped future effort,
not as requirements to restore the feature.
