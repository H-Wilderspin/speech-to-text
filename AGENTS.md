# AGENTS.md — Codex working agreement

This file gives persistent instructions to Codex (and other coding agents) working in this repository. Read `README.md` at the start of each task. Follow these instructions unless a direct user instruction overrides them.

## Mission and priorities

Deliver a **small, accessible, static-hosted TypeScript PWA** for live speech transcription, with optional voice enrolment and multi-speaker attribution. Prioritise:

1. Correctness, accessibility and an immediately usable anonymous listening experience.
2. User privacy: local-first processing, consent for enrolled voiceprints, minimal retention.
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

**Pane order (2026-10-13):** Live comes first, then collapsible Who said what, then
the bottom controls. This supersedes earlier references to assigned speech above
Live. Preserve this visual and DOM order in both app entry points.

**Bottom controls (2026-10-13):** Listen, Clear and Settings sit after the captions
in a non-scrolling bottom bar, respecting the bottom safe area. Keep reading first
in both the visual layout and DOM order; do not overlay or duplicate controls.

**Light theme and stable reading (2026-10-13):** light backgrounds with dark text
supersede the earlier dark theme. Map saved speaker colour families to dark,
high-contrast equivalents. The newest browser utterance stays at the top of Live
in a fixed-height scrollable reading area; earlier speech scrolls independently
below. Never duplicate captions or alter recognition to implement this display.
See ADR 0039.

**Typography/settings update (2026-10-13):** locally hosted Poppins, three size
roles (small labels/descriptions, medium controls/headings, adjustable large
captions). Descriptions/captions use weight 400; labels uppercase with added
tracking/line spacing. Settings remains full-height and scrollable, but is centred
with max-width 1000px and dismisses on backdrop clicks. People first; text size
and language last, in equal adjacent columns. This supersedes the earlier
unlimited settings width. See ADR 0038.

**Browser plan restored (2026-10-13):** the PC service is inactive research, not a
required setup path. The main app's Who said what pane starts collapsed and keeps
its display choice in preferences; toggling must preserve captions and listening.
Local attribution still runs while hidden. See ADR 0037.

**Family UX update (2026-10-12, explicit user instruction):** registration uses a
name and Record action without consent text/checkboxes. Preserve legacy consent
metadata when reading old profiles; do not fabricate it for new recordings. Keep
configuration under Settings and explanations minimal. See ADR 0025. This overrides
earlier enrolment UI consent requirements, not microphone permission or the existing
ban on uploading voiceprints/audio to new services without authorisation.

**Settings update (2026-10-12):** one full-screen scrolling pane with a return icon,
inline registration and protected colour/delete speaker pills. Names automatically
prepare for registered profiles and only appear in the upper assigned transcript;
the live lower transcript never shows names. No enable checkbox. See ADR 0026.

**Speaker activity (2026-10-12):** each pill also toggles visibility in Who said what.
Keep hidden people's voiceprints in matching; filter only the upper display and
persist the choice. Completed local evidence may label provisional browser words
without changing their finalization state. See ADR 0027.

- Use **TypeScript** with React and Vite unless an approved ADR changes the choice. Keep the output statically deployable.
- Keep separate modules for `audio`, `transcription`, `diarization`, `identification`, `storage`, and UI features. UI must not directly depend on a specific inference vendor or model runtime.
- Put interfaces and pure transformation / decision logic at boundaries; use adapters for browser APIs and external providers. Prefer composition and dependency injection over global singletons.
- No backend, external authentication, paid API, tracking, analytics, or cloud persistence without an explicit product decision recorded in an ADR.
- Never ship private API keys in frontend code, environment variables embedded into bundles, service workers, or source control. Public config is not secret config.
- Keep microphone/session lifecycle explicit (`idle`, `requesting-permission`, `listening`, `stopping`, `error`) and release resources on stop/unmount/error.
- Treat interim recognition output as replaceable, not append-only. Keep final transcript data stable.
- Only assign speaker identity above an evidence-based threshold; otherwise use `Unknown`. Never equate arbitrary diarisation clusters with recognised identities.
- Do not fabricate timing alignment from APIs that do not provide reliable timing. Handle audio/ASR timing compatibility as a prerequisite for speaker attribution.
- Avoid saving raw audio and transcripts by default. Store consented embeddings only when required, locally where possible, with schema/model version and deletion support.
- Treat microphone audio and voice embeddings as sensitive. Do not log them, include them in test snapshots, or send them to third parties without explicit user-visible disclosure and consent.

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

- Add/update focused tests for new business logic and regressions; especially partial/final reconciliation, unknown-speaker handling, confidence boundaries, data deletion, and lifecycle transitions.
- Run available **typecheck, lint, unit tests and production build**. If commands are not yet configured, set up practical scripts as part of initial scaffolding.
- For microphone, PWA and ML changes, provide manual test steps and the exact devices/browsers tested. **Do not claim device verification if no physical device was tested.**
- Verify failure modes: permission denial, unsupported API, app interruption, model loading failure, microphone release, no network (where applicable).
- Meet accessibility expectations: scalable typography, contrast, touch targets, meaningful speaker labels, accessible status messages.
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
