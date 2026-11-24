# ADR 0072: CLI-assisted GitHub App registration
Date: 2026-11-24
Status: Accepted

## Context
The user asked to set up the GitHub App through the CLI. GitHub's supported
manifest flow automates registration parameters and credential retrieval but
requires browser approval. The local `gh` command is unavailable; installing
another tool or sharing personal tokens is unnecessary.

## Decision
Use a dependency-free Node helper (`npm run service:setup`) with a loopback
HTTP listener and GitHub's manifest conversion API. Prefill a private App,
Contents read/write and inactive webhooks. Require browser approval and explicit
selection of only the data repository. Save credentials directly into the
existing ignored service secrets file; never emit them into logs or HTML.
Validate state and Host, reject callback replay, expire the listener and refuse
to overwrite existing credentials. Verify the installed App and repository list
before recording the installation ID; preserve the App key during file updates.
Use Windows/system CA trust with TLS verification enabled, as established in
the Cloudflare login troubleshooting. The command does not deploy anything.

## Consequences
The owner still clicks approval/install in GitHub, but no longer has to configure
permissions by hand, download a key or transcribe IDs. If conversion loses its
response before the key is saved, recover from GitHub App settings. A saved key
can resume installation checking with `--finish`. Manual setup remains documented.

## Validation
Native Node tests mock GitHub while exercising actual loopback requests, state
validation, replay rejection, secret storage, installation scope checks and
existing-file protection. Included in `npm run check`.

Source: https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest
