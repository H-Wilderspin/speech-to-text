# ADR 0002: Cache the static app shell only

Date: 2026-10-10
Status: Accepted

## Context

The application must install as a PWA and deploy under either a host root or a project subdirectory. It has no routes, data API or persistent transcript store. Offline opening and offline recognition are different capabilities.

## Decision

Use a small service worker emitted by the Vite build. Enumerate the exact application files, including `index.html`, manifest and PNG icons. Hash bundle, source HTML, worker and public files into the cache version. Resolve assets against service-worker scope, with scope-specific cache names. Never cache arbitrary requests or recognition data.

Updates wait for old tabs to close: no `skipWaiting`, automatic reload or forced takeover that could lose in-memory captions. On activation delete only old caches for this application's exact scope. No third-party runtime caching. No service worker in development mode.

Use relative asset paths and a relative manifest scope/start URL. Include regular, maskable and Apple PNG icons, derived from the project's vector icon. Hosts must serve the supplied files over HTTPS and must not rewrite missing asset requests to HTML. Serve `sw.js`, `index.html` and the manifest with revalidation; hashed assets can be immutable.

## Consequences

No PWA library/runtime is necessary for this one-screen app. Its narrow worker needs browser regression tests. App opening works offline after a successful initial cache installation; recognition may still need the browser's remote service. Browser storage eviction can remove the cache. Users close all app windows then reopen to pick up an update.

## Validation

The browser suite reloads the production app offline after worker activation and inspects cached URLs. Manifest/icon presence and subdirectory hosting also need checking. Device installation still requires the [manual matrix](../manual-testing.md).
