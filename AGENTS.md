# AGENTS.md — Codex working agreement

This file gives persistent instructions to Codex (and other coding agents) working in this repository. Read `README.md` at the start of each task. Follow these instructions unless a direct user instruction overrides them.

## Mission and priorities

Deliver a **small, accessible, static-hosted TypeScript PWA** for browser live captions and a shared family meal planner (ADR 0047). Prioritise:

1. Correctness, accessibility and an immediately usable anonymous listening experience.
2. User privacy: no saved audio/transcripts, accurate provider disclosure, minimal retention.
3. Simplicity and clean module boundaries; avoid framework churn and infrastructure by default.
4. Explicit evidence about browser / model limitations instead of unsupported claims.
5. Maintainable code and concise, durable documentation that accumulates verified knowledge.

## Start-of-task protocol

1. Read `README.md`, this file, relevant modules, and recent entries in `docs/decisions/`, `docs/troubleshooting.md`, and `docs/feasibility.md` if they exist.
2. State the smallest deliverable, acceptance criteria, potential platform issues and intended tests.
3. Prefer existing patterns; search the repository before creating a new abstraction or package.
4. If a requirement appears infeasible, isolate a measurable experiment and document findings rather than silently changing requirements.
5. Implement an independently testable increment. Do not add unrelated features.

## Architecture rules

**Meal planner (2026-10-19, explicit user instruction):** separate public GitHub
data repository, authenticated conditional meal commits, no embedded/shared
credentials. The user subsequently approved opt-in device persistence for editor
tokens (ADR 0048): save only after successful connection, restore on reopen, and
remove on Disconnect. Handle blocked storage without losing caption access or
claiming persistence succeeded. Keep caption and meal state independent.
Token entry, Remember and Disconnect belong in Settings → Planner editing; the
planner contains the calendar and meal editor, not credential setup.
Disconnect requires a confirmation with Keep connected focused by default;
opening or cancelling that prompt must not change session or remembered access.
ADRs 0047–0048 record the extension and GitHub collaborator limitations.
Weekly defaults (ADR 0049) live in defaults.json. Dated entries take priority;
version 2 weekly null entries mean skip, absent entries inherit. Retain version 1
read compatibility and never overwrite dated exceptions when editing defaults.
The optional combined view (ADR 0050) keeps one mounted planner alongside the
live transcript, preserving week/drafts during layout switches. Keep caption
controls reachable and the panels independently scrollable in this mode.
ADR 0051 replaces the checkbox/automatic direction with explicit vertical and
horizontal split icons; pressing the active icon restores the full planner.
ADR 0054 disables vertical split below 768px and temporarily displays a selected
vertical split as horizontal, preserving the mounted planners and drafts.
Split planner headers use Close (×); full planner headers retain Back.
In split view, the active planner's toolbar icon toggles its pane closed;
the other icon switches planners. Keep listening and the split preference intact.
Tasks (originally cleaning, ADR 0052) use daily checklists with weekly recurrence,
dated overrides and date-specific completion. The checklist icon replaces meals
in the same pane. The user broadened the label to Task planner for shopping trips
and other activities; retain existing cleaning data paths for compatibility.
ADR 0058 resets each week's completion ticks once from its Sunday onwards,
including catch-up on reopening. Preserve tasks/defaults and ticks made after
the reset. Version 2 weekly files carry a shared completionReset marker; keep
version 1 reads and use conditional writes so devices cannot repeat the reset.
Keep separate cleaning files in the existing data repository and reuse the
existing token namespace. Settings calls the shared connection Planner editing.
Preserve both drafts on pane switches, pause hidden polling, block switching
during saves and keep caption controls independent.

Shopping (ADR 0055) shares that pane and token. Use an ongoing ordered list in
shopping/list.json, with stable item IDs, text and bought state. Rows
support pointer/touch dragging and keyboard pickup/move/drop (ADRs 0056/0059); update
local state on drop, cancel cleanly and suspend refresh/navigation during a move.
ADR 0059 extends dragging to the entire row background/text. Keep embedded
controls separate. Touch rows use a short hold for pickup so immediate swipes
still scroll; the item text provides keyboard access and pending holds cancel cleanly.
The user removed the separate grip icon; do not restore it.
Bin icons delete directly using the existing conflict checks. Grey regular-item buttons toggle items from the user-supplied catalogue;
selected tiles remove matching items (including bought items) through local batched changes.
shopping/regular-items.json can override the bundled list. Prevent duplicate
quick adds. Read latest data before conditional writes, merge independent fields,
and reject stale item/order changes without discarding drafts. Pause hidden
polling and retain all three drafts on pane switches.
ADR 0057 batches shopping changes in memory: save every 30 seconds while dirty,
and flush before closing/switching or manual Refresh. Failed flushes retain local
state and keep the pane open. Never replace pending edits during polling. Compare
base/local/latest lists to merge independent changes and detect conflicts; show
the shared list for explicit resolution. Close routes must await the flush before
unmounting; restore focus after controls re-enable. Page exit is best effort with
a dirty beforeunload guard, not a guaranteed background or durable offline save.

**MVP scope (2026-10-15, explicit user instruction):** Who said what is removed,
including voice registration, identification, models/workers, comparison service,
research executables and associated tests. Do not reintroduce this feature without
an explicit new product decision. ADR 0046 supersedes the older speaker/two-pane
requirements; historical documents are not the current implementation plan.

- One BrowserTranscriptionEngine feeds one chronological Live transcript. Preserve
  accurate interim replacement, Android cumulative-result handling and pause lines.
- Clear/confirmed command clear invalidate the session, empty captions, abort native
  capture and restart only after native end. Discard old-session payloads. Stop
  cancels restart. Preserve session IDs and late-correction behavior (ADR 0043).
- Display-only casing/spacing must not mutate recognition text used by commands.
  Respect selected language; do not infer punctuation or rewrite words (ADR 0044).
- Keep light colours, Poppins, three size roles, bottom controls, active indicator,
  reduced-motion support, centred scrolling Settings and text/language preferences.
  Use the Forma 36 blue/green/grey palette and shared control/card tokens in
  styles.css (docs/interface-style.md). Retain light-blue focus, compact spacing
  and 48px action targets; shopping has no visible drag-hint or status rows.
- Keep the native wake lock best effort and release it on stop/error/interruption.
  Returning to the page must never restart recording automatically (ADR 0045).
- TypeScript/React/Vite, static deployment. No backend, paid API, tracking, models
  or additional dependencies without a recorded product/architecture decision.
- Never embed private credentials. Browser speech may use its provider; disclose
  this accurately. Never persist transcripts/audio or log recognised text.
- Keep microphone/session lifecycle explicit and clean up on stop/unmount/error.
- Scope storage/cache cleanup to this application's exact namespace; never clear
  another project on the same origin. Retain reading preferences on upgrades.
- Settings → Update app (ADR 0053) explicitly activates a fully installed worker
  and reloads the requesting page. Preserve remembered access and preferences;
  block updates during listening or while a planner is open. Background updates
  still wait, and failed updates must leave the existing shell usable.
- Use feature detection, accessible controls/status, reduced motion and scalable
  typography. No pinch-zoom prevention or additional capture stream.

## Repository structure and code hygiene

- Follow the repository layout described in `README.md`. Create directories only when needed.
- Organise by responsibility; keep feature UI in `src/features`, interfaces/adapters in their domain modules, and application composition in `src/app`.
- Avoid circular dependencies, huge components, mystery constants, duplicated state and generic `utils` dumping grounds.
- One module should have one clear responsibility; split files when distinct reasons to change emerge, not to meet an arbitrary line count.
- Prefer descriptive names and explicit types. No unexplained `any`, swallowed errors or implicit model defaults.
- Keep model downloads lazy and cancellable where possible. Explain cache size and offline consequences.
- Make accessible HTML the default: semantic controls, labels, focus management and visible states. Do not prevent pinch zoom.
- Use platform feature detection and fallbacks instead of assuming one browser implementation.
- Keep third-party packages to a minimum and justify significant dependencies in the PR/task summary or ADR.

## Testing and completion standards

For each change:

- Add/update focused tests for new business logic and regressions; especially partial/final reconciliation, session resets, data cleanup, and lifecycle transitions.
- Run available **typecheck, lint, unit tests and production build**. If commands are not yet configured, set up practical scripts as part of initial scaffolding.
- For microphone, PWA and ML changes, provide manual test steps and the exact devices/browsers tested. **Do not claim device verification if no physical device was tested.**
- Verify failure modes: permission denial, unsupported API, app interruption, model loading failure, microphone release, no network (where applicable).
- Meet accessibility expectations: scalable typography, contrast, touch targets and accessible status messages.
- Before marking done, check acceptance criteria; report what passed, what was untested and any known limitations.
- When publishing changes, follow CI through deployment and verify the served page.
  A successful push alone does not confirm publication; investigate failed checks.

## Self-documentation and continuous learning

**Every meaningful task must leave behind reusable knowledge.** Maintain the following files. Create them on first relevant use, not as empty documentation scaffolding.

### 1. Architecture decision records — `docs/decisions/`

Write an ADR whenever selecting/replacing an ASR or speaker model, choosing a significant dependency, changing data handling, introducing a server/service, altering architectural boundaries, or resolving a non-obvious technical trade-off.

Use sequential files, e.g. `0001-browser-asr-for-m1.md`. Template:

```md
# ADR 0001: Short decision title
Date: YYYY-MM-DD
Status: Accepted | Superseded | Proposed

## Context
Problem, constraints, evidence and alternatives.

## Decision
What we chose and why.

## Consequences
Benefits, trade-offs, privacy/performance impact, fallback.

## Validation
How it was tested; links to relevant tests/measurements.
```

Do **not** quietly edit past decisions to change history: add a superseding ADR and link both.

### 2. Troubleshooting knowledge base — `docs/troubleshooting.md`

When diagnosing a non-trivial bug, environment issue, build failure or device-specific behaviour, add a compact entry **after reproducing and verifying the outcome**:

```md
## YYYY-MM-DD — Symptom / short title
- **Context:** OS/browser/device, module, relevant versions.
- **Symptoms:** Error or observed behaviour; safe reproduction steps.
- **Root cause:** Proven cause, or explicitly labelled hypothesis.
- **Solution:** Exact change/workaround and why it works.
- **Verification:** Test command or device observation confirming the fix.
- **Prevention:** Regression test, guardrail, or monitoring where applicable.
- **Related:** Issue/commit/ADR references if available.
```

If the issue is **not** solved, mark it `Unresolved`, record experiments and next steps, and do not present a guess as a confirmed fix. Search existing entries before repeating diagnostics.

### 3. Feasibility and benchmarks — `docs/feasibility.md`

Record experiments involving browser recognition, iOS PWA restrictions, audio processing, diarisation, voice embeddings and model inference. Include:

- Hypothesis and experiment setup.
- Device model, OS, browser/PWA mode, relevant package/model versions.
- Sample sizes, scenarios and reproducible test method.
- Observed start-up time, transcript delay, inference latency, memory, approximate battery impact where measurable, and speaker match/mismatch rates.
- Constraints, failure cases, confidence in conclusions and the next decision.

Never replace measurements with claims such as “works on iOS” without specifying a tested configuration.

### 4. README upkeep

Update `README.md` when product requirements, deployment steps, supported platforms, milestone status, or architecture materially change. Keep it aligned with reality. Put long exploratory logs in `docs/`, not the README.

## End-of-task learning loop

At the end of each substantive change:

1. Summarise **what changed** and how it satisfies the requirement.
2. Record significant **decisions** as ADRs.
3. Record any **verified troubleshooting** and reusable solutions; label unresolved investigations accurately.
4. Capture new **device/model performance evidence** in feasibility notes.
5. Update tests and user-facing documentation affected by the change.
6. Report executed checks, unexecuted checks, limitations and next suggested step.

This is a repository-based learning loop: it **does not imply the agent learns autonomously across sessions** beyond what is persisted in committed project files. Documentation must be reviewed like code. Never add secrets, personal audio, voiceprints, identifiable transcript content or unrelated user data to docs.

## Change discipline

- Make small, reviewable commits or patches aligned to a single milestone or defect.
- Avoid speculative abstraction, gold-plating and broad refactoring during feature work.
- Prefer straightforward recoverable error handling and explain unavoidable compromises.
- When external APIs are needed, check current documentation, licence, pricing/free-tier terms, CORS, mobile browser support and privacy before integrating.
- If constraints conflict (for example, static hosting vs protected API credentials, or local-only inference vs acceptable latency), **surface the conflict explicitly** with measured options and a recommended minimal compromise. Never silently add infrastructure.
