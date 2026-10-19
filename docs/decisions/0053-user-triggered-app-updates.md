# ADR 0053: Update app from Settings

Date: 2026-10-19
Status: Accepted

## Context

Family members struggle with clearing browser caches and hard refreshes on Apple
tablets. The offline shell previously waited for every old app tab to close before
activating a release. The user requests a quick update button.

## Decision

Put a large Update app button near the top of Settings. Register/check the exact
app-scoped worker with updateViaCache none. Wait for installation, explicitly
message the waiting worker to skipWaiting, then reload only the requesting page
after activation. Each network/worker wait has a 20-second timeout. Routine
background installations still wait; other open pages are not forcibly reloaded.

Precache requests use cache reload to refresh stable filenames such as index.html
and icons from the network. An incomplete download cannot activate. Keep the
working offline shell on failure and offer retry. Do not unregister workers or
clear localStorage, tokens or unrelated app caches. Activation retains the
existing exact app-scope cache cleanup.

Disable the button while listening, while a planner is open (including drafts or
saves), or while connecting GitHub. Keep Settings open during the update and
disable its other form controls. Explain that reloading clears current captions;
saved preferences and remembered access remain. Session-only access still lasts
only until reload. Unsupported/restricted browsers report an error without
claiming success. No automatic microphone restart after reload.

## Consequences and validation

The tablet must receive this release once before it can show the button. This
does not force a release to reach the hosting CDN sooner. Updates need a working
connection. A successful update also refreshes the offline shell.

Browser tests serve two real releases over a local HTTP server with cacheable
responses. They exercise root and subdirectory deployment, another open tab,
saved preferences/access, unrelated caches, repeated updates, offline reload,
offline failure and failed-asset recovery in Chromium and WebKit. Physical iPad
Safari and installed Home Screen acceptance remain manual checks.

API references: [update](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update)
and [skipWaiting](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting).
