# Speech to Text

[Open the app](https://h-wilderspin.github.io/speech-to-text/).

Live captions, a shared meal planner and a shopping list for family use.
The frontend runs on GitHub Pages; an optional Cloudflare Worker handles editing
through a GitHub App. Meals and shopping data live in a separate public repository.

## Using the app

- **Listen / Stop** controls captions. Opening an editor or focusing a text field
  stops listening; tap Listen to resume. Confirmed captions stay visible.
- **Clear** empties captions. During listening, wait for Reconnecting before
  speaking again. Spoken **command clear** and **command stop** also work.
- The **footer icons** switch between captions, meals, shopping and Settings.
  Tap the active app icon again, or Speech to text, to return to captions.
- **Split view** is available from 768px: captions left, the selected app right.
- In meals, use the week arrows or swipe left/right on touch screens.
  Pull down from a planner's header to refresh both planners; desktop layouts
  have a Refresh icon.
- **Settings ? Family connection:** enter a code from the family administrator
  once per device. Unused codes last 24 hours; connected devices have no routine
  expiry. Viewing public meals and shopping needs no code.
- **Settings ? Update app** installs the latest release. Stop listening first.
  Connection and reading preferences remain; captions and unapplied drafts clear.

Completed meal/shopping changes appear immediately, stay on the device and save
in the background. Offline edits retry later. Competing edits show **Yours** and
**Family** beside the affected item. Do not clear browser data to fix a sync
problem: it removes unsynced edits and the remembered connection.

## Browser limits and privacy

Speech needs a supported browser, microphone permission and HTTPS (or localhost).
The browser's speech provider may process audio remotely and require a connection.
This app does not save audio or captions, and neither goes to the family service.

The app requests that the screen stay awake while visible, but the OS can refuse.
Leaving the app stops capture; returning does not restart it. The app cannot
force another app to release its microphone. Physical-device checks remain
separate from automated tests.

## Development

Requires Node 22.20+ and npm.

```sh
npm ci
npm run dev
npm run check
npx playwright install chromium webkit
npm run test:e2e -- --workers=1 --max-failures=1
npm run test:family
```

`check` runs typecheck, lint, unit/setup tests and a production build.
Browser suites cover root and project paths with simulated recognition.
For pairing locally, set the public `VITE_SYNC_SERVICE_URL` in ignored
`.env.development.local` and restart Vite. See [local setup](docs/hosted-editing.md#local-development-and-checks).

Code lives in `src/app` (composition/PWA), `src/transcription` (speech lifecycle),
`src/features` (UI and planner sync), and `service` (Worker/D1/owner tools).
Browser regressions are in `tests`; unit tests sit beside their modules.

## Deployment and documentation

Push to `main` to run checks and publish GitHub Pages. Follow CI through deployment
and verify the served app. Pages CI does not deploy the Worker or change its plan.

- [Documentation index](docs/README.md) ? current guides and historical records.
- [Family service operations](docs/hosted-editing.md) ? pairing, revocation and deployment.
- [Latest verification and known limits](docs/feasibility.md).
- [Contributor rules](AGENTS.md).
