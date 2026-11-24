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

**Hosted editing service cost constraint (2026-11-24, explicit user request):**
The GitHub App/device-pairing service must pause syncing rather than
incur hosting charges. ADR 0071 is implemented; the Worker and D1 are deployed,
with live reads/saves, pairing and pause/revocation verified. Frontend pairing
is published and verified in Chromium/WebKit (2026-11-24, release 7e52555).
The GitHub App is configured. Target free-only
hosting and storage plans with provider-enforced quotas; do not enable paid
plans, metered add-ons or automatic paid upgrades without explicit user approval.
Verify current plan limits before deployment. Application counters, alerts and
paid-plan spending caps are supplementary controls, not a guaranteed zero-cost
ceiling. During quota pauses retain durable local edits, distinguish device-only
saves from shared saves, and retry conservatively when service becomes available.
The Worker accepts only allowlisted data paths and conditional writes. Keep App
and owner credentials server-side; device credentials must never go to GitHub.
An optional VITE_SYNC_SERVICE_URL enables one-time device pairing. Legacy tokens
remain valid until replaced. Owner service failures must not request re-pairing;
only revoked/invalid device access does. See docs/hosted-editing.md for account
setup, pause/revocation commands and required deployment verification.

**Meal planner (2026-10-19, explicit user instruction):** separate public GitHub
data repository, authenticated conditional meal commits, no embedded/shared
credentials. ADR 0063 replaces opt-in persistence: always save a token after
successful validation, restore on reopen, and remove on deliberate Disconnect.
There is no Remember checkbox. Failed/expired access offers a new-token form in
Settings; validate the replacement before swapping access, without disconnect
confirmation or draft loss. Keep the old connection if validation fails. Handle
blocked storage without losing caption access or claiming persistence succeeded.
Token entry and Disconnect belong in Settings; the planner contains editing UI.
Allow Settings recovery after a shopping authentication failure while retaining
its pending batch; failed network saves must not block navigation (ADR 0066). Rate limits and
network failures must not be treated as expired tokens.
Disconnect requires a confirmation with Keep connected focused by default;
opening or cancelling that prompt must not change session or remembered access.
ADRs 0047–0048 record the extension and GitHub collaborator limitations.
Weekly defaults (ADR 0049) live in defaults.json. Dated entries take priority;
version 2 weekly null entries mean skip, absent entries inherit. Retain version 1
read compatibility and never overwrite dated exceptions when editing defaults.
The optional combined view (ADR 0050) keeps one mounted planner alongside the
live transcript, preserving week/drafts during layout switches. Keep caption
controls reachable and the panels independently scrollable in this mode.
ADR 0061 replaces ADRs 0051/0054 with one Split view toggle. ADR 0064 places it
in the global footer immediately left of Settings. Show it only at viewport
widths of 768px and above (including
laptops/desktops). Split means captions always left and the selected app right;
there is no top/bottom mode. Off means full planner. Below 768px hide the toggle
and use full planner, retaining the split preference and mounted drafts for when
the viewport widens. Do not infer tablet hardware from user-agent strings.
The meal header holds Previous week, Meal planner and Next week, with dates stacked
beneath the title inside the same header. Touch swipes left/right change the visible
meal week forward/backward (ADR 0070); retain drafts and avoid claiming vertical
scrolling, pull-to-refresh or editor-control gestures. Footer Refresh checks meals/defaults and shopping/catalogue, including the
hidden app, replacing only changed data and retaining drafts. Hidden automatic
polling stays paused. Overlay pending operations on refreshed data and retain
active drafts and per-item conflict handling (ADR 0066). Refresh needs an open planner; Split view needs
a visible planner or Settings (ADR 0067). Show the footer Refresh icon only at
1024px and wider with a hover-capable fine primary pointer. Phones and touch
tablets use pull-to-refresh (ADR 0069); preserve sync announcements when hiding it.
ADR 0062 replaces modal navigation with a global footer in every layout.
The Speech to text footer icon explicitly selects full captions from any screen,
closing planner/Settings after waiting for local persistence (ADR 0066). Keep the
listening session, captions and split preference intact. Highlight it only when
captions are the sole selected screen; do not start recording by navigating.
Meals and Shopping icons switch the main screen; the active icon returns to
captions. ADR 0067 gives Settings the same full/split layout and toggle-off to
full captions. In split mode captions stay left and Settings right; hide the retained
planner. Preserve Settings inputs when changing layout or resizing. No Back/Close buttons, Escape dismissal or outside-click dismissal.
Preserve mounted drafts while switching apps/Settings, pause hidden polling, and
persist completed planner actions locally before footer navigation and start a background save. Keep listening and split preference
intact. The explicit Disconnect confirmation remains a native alert dialog.
**Task planner removed (2026-11-24, explicit user instruction):** ADR 0060
supersedes the task feature in ADRs 0052/0058. Do not restore task UI, recurrence,
completion resets, polling or adapters without a new product decision. Existing
cleaning files in the shared data repository are historical data; leave them
untouched. Meals and shopping retain the shared pane and Planner editing access.
Preserve their drafts on pane switches, pause hidden polling, block switching
only during active drag gestures and keep caption controls independent.

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
polling and retain meal and shopping drafts on pane switches.
ADR 0066 supersedes ADR 0057: keep completed shopping/meal/default actions in a
base-path-scoped IndexedDB journal. Save after two seconds of inactivity with a
ten-second maximum batch window; serialize writes per tab, read latest+SHA,
merge independent operations and acknowledge only the captured IDs. Keep newer
edits overlaid on responses. Retry transient errors with backoff; retain durable
queues across reload/update. Visible documents poll every minute; hidden pending
queues still save. Refresh preserves active drafts and untouched family fields.
Per-item/cell Yours/Family choices resolve only the affected key; other keys can
save. Same-field, delete-versus-edit and incompatible ordering conflicts must not
silently overwrite family changes. Draft text is session-only until applied.
Navigation waits for local persistence, not network. If storage fails, navigation
still works using app-owned memory; warn before page exit and require a successful
network save before Update app. Never store credentials, captions or audio in the
planner database. See ADR 0066 for browser eviction and multiple-tab limitations.

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
  Use coral actions/highlights and shared control/card tokens in
  styles.css (docs/interface-style.md). Retain coral focus, compact spacing
  and 48px action targets; shopping has no visible drag-hint or status rows.
- ADR 0073 supersedes the listening-only wake lock: request it whenever the app
  is visible, including reading/editing; release on hide/pagehide/disposal and
  reacquire on return. Returning must never restart recording automatically.
- Opening a meal/shopping editor or focusing a text-entry field aborts listening,
  retaining confirmed captions and cancelling pending restarts. Resume only by
  an explicit Listen action. Browsing panels still preserves listening. The web
  app cannot pre-empt microphone use by another app (ADR 0073).
- TypeScript/React/Vite, static deployment. No backend, paid API, tracking, models
  or additional dependencies without a recorded product/architecture decision.
- Never embed private credentials. Browser speech may use its provider; disclose
  this accurately. Never persist transcripts/audio or log recognised text.
- Keep microphone/session lifecycle explicit and clean up on stop/unmount/error.
- Scope storage/cache cleanup to this application's exact namespace; never clear
  another project on the same origin. Retain reading preferences on upgrades.
- Settings → Update app (ADR 0053) explicitly activates a fully installed worker
  and reloads the requesting page. Preserve remembered access and preferences;
  block updates during listening or GitHub connection. ADR 0065 removes the hidden
  planner guard: update directly from Settings. ADR 0066 requires pending completed
  actions to be durable on the device or saved remotely before reload. Network
  failures alone do not block updates when the local queue is durable. Background updates
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
