# MVP cleanup review

Date: 2026-10-15

## Completed

- One browser engine feeds one transcript. Removed the speaker pane/settings,
  enrolment/identification/diarisation, extra audio capture, local/remote inference,
  comparison endpoint/service, model assets, research executables and their tests.
- Removed attribution fields, slice reconstruction, diagnostics, model build
  scripts, Python CI and capture/model test stages. Retained command-parser
  behavior while deleting its local-only adapter and unused return data.
- Simplified Settings and reading preferences. Added scoped cleanup for obsolete
  voiceprints/models/settings, with upgrade coverage that preserves sibling apps.
- Kept live recognition, session resets, formatting, scrolling, accessibility,
  wake lock, listening indicator, offline shell and their regression coverage.
- Public assets: 288,435,984 to 335,180 bytes. Source files: 95 to 27 (including
  retained tests and the new upgrade module). The production site is approximately
  0.59 MB total, with no model files or WASM workers. Git history still contains
  the deleted binaries; deleting current files does not shrink old clones/history.

## Further candidates (not implemented)

1. **Clarify recognition state/counters.** `src/transcription/browser.ts` uses
   `sessionId` for native recognition cycles and `sessionNumber` for logical Clear
   generations. Rename these first, then consider grouping lifecycle state and
   timers. Keep the existing platform and stale-callback tests; this is the highest
   regression-risk cleanup and should not be bundled into a visual change.
2. **Remove write-only pause metadata.** `pauseAfter` is copied through snapshots
   and results, but the renderer no longer reads it. Actual line splitting uses
   the separate `PauseLines` boundary map. Verify that contract, then remove the
   redundant flag/bookkeeping while retaining pause/correction tests.
3. **Organise CSS by component.** `src/app/styles.css` still mixes global element
   rules and component styles in compact single-line blocks. Expand/group it and
   scope broad dialog/button selectors; introduce shared spacing/colour tokens.
   This would improve maintenance without a new styling dependency.
4. **Avoid duplicate TypeScript work in CI.** `npm run check` typechecks, then
   `npm run build` typechecks again. Separate checked build from Vite bundling so
   CI runs one check while keeping the standalone build command safe.
5. **Separate historical material.** Historical research documents are labelled,
   but could move into a dedicated archive with an index. Ignored private research
   environments and large models remain on this PC. Removing them is a separate,
   explicit housekeeping action; preserve any wanted recordings first. A future
   repository-history cleanup would require coordination and should not be done
   as an automatic force-push.

The remaining production dependency list is already just React/React DOM; there
is no inference package to uninstall. I would prioritise CSS organisation and the
duplicate build check before changing recognition lifecycle code.
