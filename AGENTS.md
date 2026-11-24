# Contributor working agreement

Build a small, accessible captions and family-planning app. Prefer simple changes,
durable local edits and clear evidence over new infrastructure or dependencies.

## Working process

- Read README.md, relevant code/tests and the relevant guide in docs/README.md.
  Consult decisions or archived investigations when they explain the affected area;
  do not read or update every document for every task.
- State the intended result and useful checks. Keep scope aligned with the user's
  request; preserve unrelated work and use existing patterns.
- Keep feature UI in src/features, domain logic beside its adapters and app
  composition in src/app. Avoid duplicate helpers, circular dependencies and
  unexplained constants. Use accessible HTML and feature detection.
- For code changes, run typecheck, lint, unit tests and build (`npm run check`),
  plus relevant browser regressions. For documentation-only changes, check links,
  paths, commands and consistency; application tests need not be repeated.
- Publishing is complete only after CI/deployment passes and the served app is
  verified. Report checks and material limits. Mocks/emulation do not establish
  physical microphone, iPad, sleep or accessibility behaviour.

## Product constraints

### Captions and privacy

- Keep one chronological transcript. Preserve interim replacement, Android
  cumulative-result handling and late corrections.
- Clear invalidates the session, aborts capture and restarts only after native
  end. Ignore stale callbacks; Stop cancels restarts. Formatting is display-only
  and must not alter command recognition or invent wording.
- Opening/restoring a meal or shopping editor, or focusing text entry, aborts
  listening before focus. Keep confirmed captions; resume only on explicit Listen.
  Browsing panels alone preserves listening.
- Request a wake lock while visible, release on hide/disposal and reacquire on
  return without restarting recording. Respect OS denial/revocation.
- Never persist/log captions or audio. Disclose browser-provider processing.
  Keep capture cleanup explicit. Scope cache/storage cleanup to this app path.
- Speaker identification, voice registration, models and the task planner are
  retired. Do not restore them without a new request; leave historical task data
  untouched. Separate-device caption transmission is not implemented.

### Navigation and interaction

- Keep the global footer. App icons select screens; the active icon and Speech
  to text return to captions. No modal Back/Close controls or outside dismissal.
- At 768px+, Split view puts captions left and Meals, Shopping or Settings right.
  Below that width use full view while retaining the preference/drafts. Settings
  behaves like the other apps. Never infer tablet hardware from user-agent strings.
- Preserve week, drafts, focus and caption reading position across navigation.
  Navigation waits for local persistence, not network saves; active dragging can
  temporarily block it. Hidden planners stop polling but pending writes continue.
- Shared Refresh checks meals/defaults and shopping/catalogue. Show its icon only
  at 1024px+ with a hover-capable fine pointer; touch devices use pull-to-refresh.
  Horizontal meal swipes change weeks without claiming editor/vertical gestures.
- Keep Poppins, light surfaces, shared colour/spacing tokens, reduced motion,
  zoom support and 48px action targets. Use [the style guide](docs/interface-style.md).
- Update app preserves connection/preferences and durable completed edits.
  Block while listening/connecting, or when edits are neither durable nor remotely
  saved. Do not require closing a hidden planner. Failed updates leave a usable shell.

### Data and access

- Meals and shopping use a separate public GitHub repository. Validate documents
  and use conditional writes; never overwrite malformed files.
- Dated meals override weekly defaults. Version 2 null entries skip a dated meal;
  absent entries inherit. Read version 1 files and preserve dated exceptions when
  changing defaults.
- Shopping uses stable IDs and ordered rows. Keep whole-row dragging, separate
  embedded controls, touch hold-to-drag, keyboard move/cancel, direct bin deletion
  and duplicate-aware regular-item toggles.
- Keep completed edits in a path-scoped IndexedDB journal. Batch after two idle
  seconds, at most ten seconds during continuous edits; serialize writes per tab.
  Read latest+SHA, merge independent changes and acknowledge only captured edits.
  Overlay newer edits on responses; keep unapplied planner drafts locally across
  reloads with their original edit base. Never submit recovered drafts automatically.
- Same-field, delete/edit and incompatible-order conflicts require per-item
  Yours/Family resolution. Unrelated edits can save. Refresh never erases drafts.
  If local storage fails, preserve memory state, allow navigation and warn before
  exit; require remote save before updating. See [sync design](docs/decisions/0066-local-first-planner-sync.md).
- Pair devices once; remember access automatically. Legacy token builds validate
  replacement access before swapping, without disconnecting or losing drafts.
  Deliberate disconnect requires confirmation, initially focused on Keep connected.
  Network/rate-limit/service failures must not masquerade as invalid credentials.
- Keep App and owner credentials server-side; device credentials never go to
  GitHub. Never commit secrets or put them in VITE variables or frontend assets.
- **Free hosting only:** syncing must pause rather than incur charges. Do not
  enable paid plans, metered extras or automatic upgrades without explicit user
  approval. Verify current provider terms before service deployment. The daily
  counter and owner pause are supplementary; they are not a guaranteed billing
  cap. Retain local edits during outages. See [service operations](docs/hosted-editing.md).

## Documentation discipline

- Each fact has one home: README for quick start, feature guides for behaviour/data,
  hosted-editing for operations, feasibility for current evidence/limits.
- Update only documents affected by the change. Do not append a release diary,
  repeated test counts or an ADR for routine copy/style fixes.
- Add an ADR for significant architecture, data-handling or non-obvious tradeoffs.
  Keep old decisions as history; link superseding decisions rather than silently
  rewriting them. Existing duplicate 0072 prefixes have distinct filenames; keep
  those stable and use an unused number for future records.
- Troubleshooting entries should capture a reusable symptom, proven cause,
  fix and verification. Label hypotheses and unresolved physical issues.
- Record meaningful measurements with environment and limitations. Keep the
  latest release evidence concise; archive detailed history when it obscures it.
- Never add credentials, personal audio/transcripts or unrelated user data to docs.
