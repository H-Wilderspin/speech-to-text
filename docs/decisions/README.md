# Architecture decisions

These records explain changes over time. An old Accepted status does not mean
every feature described is still present. Start with the [current guides](../README.md).

| Area | Current reference |
| --- | --- |
| Caption-only speech engine; retired speaker features | [0046](0046-live-transcription-only-mvp.md) |
| Clear/session lifecycle | [0043](0043-session-reset-and-pause-lines.md) |
| Display formatting | [0044](0044-display-caption-formatting.md) |
| Weekly defaults | [0049](0049-recurring-meal-defaults.md) |
| App updates | [0053](0053-user-triggered-app-updates.md), [0065](0065-update-directly-from-settings.md) |
| Shopping row dragging | [0059](0059-shopping-row-dragging.md) |
| Task removal | [0060](0060-remove-task-planner.md) |
| Footer navigation and split view | [0061](0061-tablet-side-by-side-toggle.md), [0062](0062-global-footer-navigation.md), [0067](0067-settings-split-and-toggle.md) |
| Local edits, batching and conflicts | [0066](0066-local-first-planner-sync.md) |
| Touch refresh and week navigation | [0068](0068-planner-pull-to-refresh.md), [0069](0069-desktop-refresh-icon.md), [0070](0070-touch-week-navigation.md) |
| Family editing service | [0071](0071-free-hosted-family-editing.md) |
| GitHub App setup helper | [0072 CLI setup](0072-cli-github-app-registration.md) |
| 24-hour invitation codes | [0072 code lifetime](0072-day-long-pairing-codes.md) |
| Editing interruption and visible-app wake lock | [0073](0073-editing-and-visible-screen-awake.md) |

Earlier records remain at their original paths. In particular, the former
speaker pipeline, task planner, top/bottom split, modal navigation, 30-second
shopping batches and listening-only wake lock are historical designs.
The two 0072 files have distinct subjects; their filenames are retained for links.
