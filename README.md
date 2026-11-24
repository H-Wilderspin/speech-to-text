# Speech-to-Text MVP

[Open the app](https://h-wilderspin.github.io/speech-to-text/).

Large, readable live captions for family conversations, with a shared meal
planner and a shopping list. The MVP uses the browser's
speech recognition service. Speaker identification, voice registration, model
downloads and the PC comparison service have been removed. See
[ADR 0046](docs/decisions/0046-live-transcription-only-mvp.md).

## Using the app

- **Listen / Stop:** start or stop captions. A green Listening indicator gently
  pulses; reduced-motion users see a steady dot. Startup/restart is amber.
- **Clear:** empty the transcript. During listening, capture restarts with a new
  session number; results from the previous session are discarded. Stop cancels
  a pending restart. Spoken **command clear** and **command stop** work on confirmed
  recognition; Android can wait until a pause. Wait for Reconnecting to finish
  before speaking after Clear.
- **Speech to text:** the speech-bubble footer icon returns directly to full
  captions from Meals, Shopping or Settings, keeping the listening session intact.
- **Settings:** caption text size, speech language, planner editing access, screen-awake status and About.
  Language changes are disabled during listening. The centred, full-height panel
  opens above the global footer. On tablet-sized screens and larger, Split view
  places captions on the left and Settings on the right. Tap Settings again to
  return to full captions.
  On phone-sized screens, caption text size appears above speech language on separate rows.
- **Update app:** open Settings and tap Update app to download and reload the
  latest version. Stop listening first; no separate planner-closing step is needed.
  Completed planner changes are kept on this device before updating. Reloading clears
  current captions, unsaved editor drafts and session-only access; remembered access and reading
  preferences stay. If offline or a download fails, reconnect and try again.

Each sentence composes inline. A provider speech-end hint, debounced for 500ms,
can start a new line; this is not an exact acoustic silence detector. Late wording
corrections remain possible. New speech scrolls into view unless you have scrolled
back to read earlier text. Clear resumes following the newest text.

Poppins, cool white surfaces, dark text and Forma 36 blue/green accents support reading.
Planner cards use consistent spacing, clear day headings and a tinted Today
marker. Controls retain large touch targets and the light-blue focus glow.
See [interface styling](docs/interface-style.md). Display-only formatting capitalises
line openings and English pronouns and tidies spacing. It does not rewrite words,
infer punctuation or correct proper names.

## Screen awake and browser limits

Listen requests a screen wake lock while the page is visible. Stop, errors and
leaving the app release it. Settings shows whether the lock is held. The OS can
refuse it, including for power saving. Safari added the API in 16.4; Home Screen
web apps need the iPadOS/iOS 18.4 fix. Use a Safari tab on older supported systems.
This does not override manual locking or enable background recording. See
[ADR 0045](docs/decisions/0045-listening-screen-wake-lock.md).

Browser recognition needs HTTPS (or localhost), microphone permission and a
supported browser. The browser provider may send audio to its service and need an
internet connection. This app does not save audio or transcripts. Text size and
language remain on the device. The cached shell/fonts can open offline; that does
not make speech recognition offline.

## Upgrading from the speaker prototype

Use Settings → Update app after deployment. For older versions without that
button, open the app online to download the release, then close all its tabs/windows
and reopen so it can activate. The upgrade
removes this app path's obsolete voiceprint database,
model caches and speaker preferences while retaining text size and language.
Blocked storage cleanup retries on later loads; old database connections may need
to close. It does not remove other GitHub Pages projects' data. The old comparison
URL is retired. Historical code remains in Git at `37835e4`; research findings are
kept in [docs](docs/README.md). Ignored private local research files are untouched.

## Meal planner

**Family connection:** a hosted service replaces recurring GitHub token entry
with a one-time pairing code. The Worker and database are deployed and live
reads, saves, pairing and pause/revocation checks passed. Pairing is available in
the published app under **Settings → Family connection**. See
[hosted editing setup](docs/hosted-editing.md). It uses Free-plan quotas, a daily
request guard and an owner pause switch; completed edits stay local during pauses.
Existing GitHub connections continue working until replaced by successful pairing.

The cutlery button opens a shared Monday–Sunday meal planner, with three meals
per day and today highlighted. Week headings use `19 Oct - 25 Oct, 2026`, showing
both years when a week crosses New Year. Previous/next week arrows sit beside
**Meal planner**, with the selected dates stacked beneath the title inside the header.
On phones and tablets, swipe left across the meal planner for the next week or
right for the previous week. Drafts are kept when returning to a week. Footer
**Refresh** checks meals and shopping together, updating changed data while
preserving drafts. On touch screens, pull down from the planner header while at
the top, then release at the prompt to sync and refresh both apps without reloading.
The footer Refresh icon appears only on desktop layouts (at least 1024px wide,
with a mouse/trackpad primary pointer). Phones and touch tablets use pull-to-refresh.
**Split view** sits
immediately left of Settings at widths of 768px and above (tablet-sized screens,
laptops and desktops). Turn it on for captions
on the left and the selected meal planner or shopping list on the right. Turn it
off for the full planner. Each pane scrolls separately; caption controls remain
available in every view. There is no top/bottom split.
On narrower screens the toggle is hidden and the selected app fills the screen.
Resizing preserves drafts, the selected week and the split preference, restoring
side-by-side view when wide enough. The global footer stays visible: select an
app icon to switch screens, or tap its active icon to return to captions. There
are no Back/Close buttons. Settings uses the same full/split layout and preserves planner drafts.
Its active footer icon returns to captions; choose Meals or Shopping to return to
that planner. The split preference lasts until reload and applies to Meals,
Shopping and Settings.
Clear and Settings retain their labelled icons.
In a meal's editor, choose **Apply to → Every [weekday] [meal]** to save a weekly
default. Dated meals take priority; skip a single occurrence or use its weekly
default again without changing other weeks.
The public plan lives in a separate GitHub data repository; reading needs no
login. To edit, enter a one-time pairing code under **Settings → Family connection**.
The family member who manages the service generates the code; access is remembered
automatically on this device with no routine expiry. Unused pairing codes last
24 hours from creation. Pairing replaces previous GitHub access without
clearing queued edits. Temporary service failures retain the connection and local
changes. The legacy token flow remains available in builds without a service URL.
See [meal planner setup and family editing](docs/meal-planner.md), including
GitHub's collaborator limitations, public history and conflict handling.

## Shopping list

The shopping-cart icon opens one shared ongoing list. Add an item, use its pencil
to edit, its bin icon to delete, and tick it when bought. Drag the item's text or
background to update the order. On touch screens, hold briefly, then drag;
swiping immediately scrolls normally. The list scrolls when dragging near its edge. With a
keyboard, focus the item text, press Space, use arrow keys and press Enter to drop
(Escape cancels). Quantities can be included in the item text.

Grey **Regular items** buttons add the household's fixed items to the main list.
Items already present show **Added**; tap again to remove them, even if marked
bought. The supplied 24-item catalogue is included in the app and can be replaced
by a JSON file in the same data repository.

Shopping uses the same GitHub editing access, Refresh button, automatic updates
and split controls as meals. It replaces the meal pane and can stay alongside
captions. Switching between meals and shopping keeps drafts while the pane stays open.
Shopping and meal changes appear immediately and are kept on this device. They
save to GitHub in the background after about two seconds of inactivity (at most
ten seconds of continuous editing). Keep editing or switch screens during saves.
Offline changes survive normal reloads and retry when connected. Conflicting
changes show **Yours** and **Family** beside the affected item, with **Keep mine**
and **Use family change**; unrelated changes continue saving. Clearing browser
site data removes local pending changes. If device storage fails, keep the app
open until GitHub saves succeed. Unapplied editor text survives navigation within
the session, but clears on reload.
See [shopping setup and data](docs/shopping-list.md).

## Removed task planner

The task planner was removed at the user's request on 24 November 2026.
Existing task files in the shared data repository are left untouched; this app
no longer reads, edits or resets them. See [ADR 0060](docs/decisions/0060-remove-task-planner.md).

## Development

Requires Node 22.20+ and npm (also used by CI).

```sh
npm ci
npm run dev
npm run check
npx playwright install chromium webkit
npm run test:e2e -- --workers=1 --max-failures=1
```

`check` runs TypeScript, ESLint, unit tests and a production build. Browser tests
exercise the production build at both root and project-subdirectory paths. They
use simulated recognition and do not prove physical microphone/browser accuracy.
See [manual testing](docs/manual-testing.md) and [evidence](docs/feasibility.md).

To use Family connection locally, set the public `VITE_SYNC_SERVICE_URL` in
an ignored `.env.development.local` and restart `npm run dev`. Vite proxies device
requests to that service; no App or owner secrets belong in the frontend.
This development-only file does not affect tests or production builds. Without
it, local Settings uses the legacy token flow. See [local setup](docs/hosted-editing.md#local-development-and-checks).

## Code layout

- `src/main.tsx`, `src/app/`: one engine, UI composition, wake lock, upgrade cleanup,
  styling and offline shell.
- `src/transcription/`: browser lifecycle, partial/final reconciliation, Android
  results, pause lines and voice commands.
- `src/features/listening/`: transcript, display formatting and active indicator.
- `src/features/settings/`: reading preferences and settings screen.
- `src/features/meals/`: weekly calendar, meal editor and GitHub data adapter.
- `src/features/shopping/`: ordered shopping items, fixed quick-add catalogue and shared saves.
- `src/features/planners/`: shared planner frame, durable local journal and GitHub sync transport.
- `src/audio/interruption.ts`: stop listening when leaving the app.
- `public/`: fonts, icons and manifest only; no speech models.
- `tests/`: browser regressions and scoped upgrade checks.
- `service/`: optional Cloudflare Worker, D1 device pairing, GitHub App access and
  owner commands. No audio/transcripts or meal data are stored in D1.

Planner reads and writes go through `PlannerSync` / `SyncDocument`, the meal and
shopping document adapters, and the shared GitHub transport. The superseded
direct-save adapters and whole-list merge helper have been removed; catalogue
loading remains in `github-shopping.ts`. Upgrade cleanup is still required for
existing installations. Historical research notes and ignored private research
files are retained; empty retired feature folders and the old service bytecode
cache are removed.

## Deployment

Push to `main`; GitHub Actions runs checks and deploys `dist/` to GitHub Pages.
Pages uses GitHub Actions as its source. Relative URLs support project paths.
The existing repository is configured; `scripts/setup-github-pages.ps1` is a
bootstrap helper for a new repository, not a normal release step.

Changes are considered published only after CI/deployment pass and the served
page is checked. New offline-shell versions wait for old tabs to close unless
Settings → Update app explicitly activates one. Captions and reading public meals need no API key or hosting
subscription. Meal editors pair their devices as described above.
The public Actions variable `VITE_SYNC_SERVICE_URL` enables the deployed family
service. Release `7e52555` passed CI and published-site pairing/read checks in
desktop Chromium and mobile WebKit on 2026-11-24; physical family devices remain
to be connected. See the [successful deployment](https://github.com/H-Wilderspin/speech-to-text/actions/runs/45444887729).
The Pages workflow tests both modes but never deploys the Worker or changes its
billing plan. See [the deployment checklist](docs/hosted-editing.md).
