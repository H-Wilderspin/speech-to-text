# Speech-to-Text MVP

[Open the app](https://h-wilderspin.github.io/speech-to-text/).

Large, readable live captions for family conversations. The MVP uses the browser's
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
- **Settings:** text size and speech language, plus screen-awake status and About.
  Language changes are disabled during listening. The centred, full-height panel
  closes with the return button, Escape or a click outside it.

Each sentence composes inline. A provider speech-end hint, debounced for 500ms,
can start a new line; this is not an exact acoustic silence detector. Late wording
corrections remain possible. New speech scrolls into view unless you have scrolled
back to read earlier text. Clear resumes following the newest text.

Poppins and a light theme support reading. Display-only formatting capitalises
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

Close all app tabs and reopen after deployment so the new offline shell can
activate. The upgrade removes this app path's obsolete voiceprint database,
model caches and speaker preferences while retaining text size and language.
Blocked storage cleanup retries on later loads; old database connections may need
to close. It does not remove other GitHub Pages projects' data. The old comparison
URL is retired. Historical code remains in Git at `37835e4`; research findings are
kept in [docs](docs/README.md). Ignored private local research files are untouched.

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
- `src/audio/interruption.ts`: stop listening when leaving the app.
- `public/`: fonts, icons and manifest only; no speech models.
- `tests/`: browser regressions and scoped upgrade checks.

## Deployment

Push to `main`; GitHub Actions runs checks and deploys `dist/` to GitHub Pages.
Pages uses GitHub Actions as its source. Relative URLs support project paths.
The existing repository is configured; `scripts/setup-github-pages.ps1` is a
bootstrap helper for a new repository, not a normal release step.

Changes are considered published only after CI/deployment pass and the served
page is checked. New offline-shell versions wait for old tabs to close, preserving
in-memory captions. No API keys, Python service or hosting subscription is needed.
