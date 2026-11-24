# ADR 0067: Settings shares split view and toggle navigation

Date: 2026-11-24
Status: Accepted; supersedes Settings return-to-previous-view behaviour in ADR 0062

## Context

The user wants Settings to split and toggle off like Shopping. A special Settings
return path and disabled split control made footer navigation inconsistent.

## Decision

Use the existing layout preference for Settings as well as Meals/Shopping. At
768px and wider, split means captions on the left and Settings on the right.
Below that width use full Settings and retain the preference. Change layout without
remounting Settings so token-entry state survives. Stack preference controls by
pane width. The Settings footer icon toggles off to full captions, including when
opened from a planner. Planner drafts remain with the app-session client.

## Consequences and validation

No extra layout modes or dependencies. Listening/captions remain intact. Existing
connection/update guards still prevent unsafe navigation. Browser regressions
cover full/split/phone layouts, draft retention, caption resizing, footer focus,
and returning to captions from Settings opened via Shopping.
