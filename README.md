# Speech-to-Text MVP

[Open the app](https://h-wilderspin.github.io/speech-to-text/).

Large, readable live captions for family conversations, with shared meal and
task planners and a shopping list. The MVP uses the browser's
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
- **Settings:** text size, speech language, planner editing access, screen-awake status and About.
  Language changes are disabled during listening. The centred, full-height panel
  closes with the return button, Escape or a click outside it.
  On phone-sized screens, text size appears above speech language on separate rows.
- **Update app:** open Settings and tap Update app to download and reload the
  latest version. Stop listening and close any planner first. Reloading clears
  current captions and session-only access; remembered access and reading
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

The cutlery button opens a shared Monday–Sunday meal planner, with three meals
per day and today highlighted. Week headings use `19 Oct - 25 Oct, 2026`, showing
both years when a week crosses New Year. Its title bar has Back and Refresh on
the left, with vertical and horizontal split icons on the right. Clear and
Settings use labelled icons; Settings is a cog.
Choose **Vertical split** for captions and meals side by side, or **Horizontal
split** for captions above meals. Each pane scrolls separately and caption controls
stay available. Vertical split is disabled below 768px; a side-by-side view stacks
while the window is narrow and returns when widened. Press the active split icon again for the full planner, or use
the Close (×) button to return to captions alone. Full planner mode retains
the Back arrow. The
layout choice lasts until reload; switching layouts keeps the selected week and draft.
In a meal's editor, choose **Apply to → Every [weekday] [meal]** to save a weekly
default. Dated meals take priority; skip a single occurrence or use its weekly
default again without changing other weeks.
The public plan lives in a separate GitHub data repository; reading needs no
login. Set up a personal GitHub token under **Settings → Planner editing**. Select **Remember on
this device** to keep editing access after reopening the app; otherwise access
lasts only for the page session. Disconnect asks for confirmation before removing
saved access from that browser; Keep connected cancels.
See [meal planner setup and family editing](docs/meal-planner.md), including
GitHub's collaborator limitations, public history and conflict handling.

## Task planner

The checklist icon beside the cutlery opens a daily task list for shopping trips,
housework and other activities. Add a task for
one date, or choose **Apply to → Every Monday** (or the selected weekday) for a
recurring task. Completion ticks belong only to that date; the following week
starts unchecked. Dated edits and skips leave the weekly task unchanged.
Each week's ticks also reset once from Sunday onwards, keeping all tasks.
If the planner is closed, the reset catches up when that week is next opened.
Ticks added after its reset stay checked.

Meals and tasks share one planner pane and the same split controls, so either
can stay visible with captions. Switching icons preserves the selected week,
layout and unsaved drafts while the pane stays open; it is disabled during saves.
In split view, tap the active planner's toolbar icon again to close its pane and
return to captions alone. Tapping the other planner's icon switches panes.
Only the visible planner checks for updates. Both use the existing GitHub access
in Settings; previously remembered access continues to work. Tasks use their
own files in the same public data repository. See [task setup and data](docs/cleaning-planner.md).

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
and split controls as the planners. It replaces their pane and can stay alongside
captions. Switching among the three panes keeps drafts while the pane stays open.
Shopping changes appear immediately and save together every 30 seconds, or when
closing/switching the pane. Refresh also saves pending changes first. A failed
save keeps the local list and leaves the pane open for retry. Close the pane before quitting the browser to
finish saving; forced browser/app shutdown cannot guarantee a network save.
See [shopping setup and data](docs/shopping-list.md).

## Development

Requires Node 22.12+ and npm.

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

## Code layout

- `src/main.tsx`, `src/app/`: one engine, UI composition, wake lock, upgrade cleanup,
  styling and offline shell.
- `src/transcription/`: browser lifecycle, partial/final reconciliation, Android
  results, pause lines and voice commands.
- `src/features/listening/`: transcript, display formatting and active indicator.
- `src/features/settings/`: reading preferences and settings dialog.
- `src/features/meals/`: weekly calendar, meal editor and GitHub data adapter.
- `src/features/cleaning/`: task recurrence, dated completion and task editor (original internal name).
- `src/features/shopping/`: ordered shopping items, fixed quick-add catalogue and shared saves.
- `src/features/planners/`: shared planner frame and GitHub JSON transport.
- `src/audio/interruption.ts`: stop listening when leaving the app.
- `public/`: fonts, icons and manifest only; no speech models.
- `tests/`: browser regressions and scoped upgrade checks.

## Deployment

Push to `main`; GitHub Actions runs checks and deploys `dist/` to GitHub Pages.
Pages uses GitHub Actions as its source. Relative URLs support project paths.
The existing repository is configured; `scripts/setup-github-pages.ps1` is a
bootstrap helper for a new repository, not a normal release step.

Changes are considered published only after CI/deployment pass and the served
page is checked. New offline-shell versions wait for old tabs to close unless
Settings → Update app explicitly activates one. Captions and reading public meals need no API key or hosting
subscription. Meal editors connect their own GitHub access as described above.
