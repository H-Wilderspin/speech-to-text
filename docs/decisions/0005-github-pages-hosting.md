# ADR 0005: Deploy the static app with GitHub Pages

Date: 2026-10-10
Status: Accepted

## Context

The user selected GitHub hosting under `H-Wilderspin`. Their Pixel 8 could not open the development LAN URL. An HTTPS deployment is needed for physical microphone and installation tests. The app already builds a static, relatively addressed shell and has production browser coverage at `/` and `/speech-to-text/`.

## Decision

Treat this directory as the repository root. Use GitHub Actions to install the lockfile, run the required checks and production browser tests, and upload only `dist/` to GitHub Pages. Pull requests receive checks; deployment is restricted to the default branch and the `github-pages` environment. Pin actions to the revisions in Vite's official deployment example as reviewed on this date. Keep Pages write/OIDC permissions in the deployment job.

Retain Vite's relative base, relative manifest paths and scoped service worker. No repository-name-specific build setting, custom domain, API keys or backend is required. GitHub controls response cache headers; the previous general recommendation for configurable hosts is not a Pages setup requirement.

## Consequences

For a repository named `speech-to-text`, the expected address is `https://h-wilderspin.github.io/speech-to-text/`. This is a proposed address until the user creates/uploads the repository, selects GitHub Actions in Settings → Pages, and a deployment succeeds. The workflow belongs at the GitHub repository's `.github/workflows/pages.yml`, not nested under another project directory.

The current deployment contains the anonymous caption app. Research assets and its private model directory are excluded from `dist/`; publishing this app does not publish the synthetic speaker benchmark or close M2/M3 gates. No phone success is inferred from the inaccessible LAN address or local browser emulation.

## Validation

Local `npm run check` passed (typecheck, lint, 32 unit tests and production build), followed by all 16 Playwright checks on Windows Chromium and desktop WebKit. Root/subdirectory tests cover asset URLs, manifest icons, service-worker scope and offline reopening. A filesystem assertion verified that the artifact has its shell/worker and excludes research, private files and model binaries. GitHub-hosted workflow execution and live HTTPS/device behavior remain pending the user's repository setup. Follow [manual testing](../manual-testing.md) once deployed.

Sources: [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Vite's deployment workflow](https://github.com/vitejs/vite/blob/main/docs/guide/static-deploy-github-pages.yaml), [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).
