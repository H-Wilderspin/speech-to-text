# Documentation

The current product combines live captions and shared meal planning. Start with
the root README, [meal setup](meal-planner.md),
[ADR 0046](decisions/0046-live-transcription-only-mvp.md),
[ADR 0047](decisions/0047-shared-meal-planner.md),
[remembered editing access](decisions/0048-remember-meal-access.md) and
[weekly defaults](decisions/0049-recurring-meal-defaults.md), plus
[manual testing](manual-testing.md). The latest feasibility entries record changes
and checks; older entries describe historical builds.

Speaker asset guides, diagnostics, comparison benchmarks, service measurements and
the original acceptance audit are historical research. Their commands, endpoints,
source paths and feature claims no longer describe the MVP. Implementation before
removal is recoverable at Git commit `37835e4`; private ignored files are not part
of the repository. Keep historical findings for a separately scoped future effort,
not as requirements to restore the feature.
