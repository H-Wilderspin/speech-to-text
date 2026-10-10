# ADR 0008: Configure the GitHub repository before its first push

Date: 2026-10-10
Status: Accepted

## Context

The user chose GitHub Pages and asked for a repository that deploys automatically on push. ADR 0005 provided the workflow, but enabling Pages was still a manual account setting. There was no local Git repository or remote repository at the intended address.

## Decision

Create the public `H-Wilderspin/speech-to-text` repository and enable Pages with `build_type: workflow` through GitHub's API using the owner's existing Git Credential Manager sign-in. Configure the `github-pages` deployment environment to allow `main`. Initialise this app directory as the repository root and prepare an initial commit for the user to push.

Keep the reproducible setup in `scripts/setup-github-pages.ps1`. Authentication remains in memory and the existing credential manager; no token is written into source files or workflow secrets. Subsequent deployments use the workflow's scoped `GITHUB_TOKEN` and OIDC permissions.

Pin binary handling in `.gitattributes`, including the generated runtime module whose exact bytes are checked at build time. Ignore local research models, dependencies, build output and test results.

## Consequences

The user can push `main` without first visiting Pages settings. The site is expected at `https://h-wilderspin.github.io/speech-to-text/`. Hosting remains a static deployment of `dist/`; no account integration is added to the app. This setup does not constitute a successful published deployment or a phone acceptance test.

## Validation

GitHub's authenticated API confirmed repository creation, default branch `main`, enabled Actions and workflow-based Pages configuration on 2026-10-10. Rerunning the setup succeeded. Local `npm run check` passed with 58 unit tests, including asset hashes and production build. Production browser coverage and remaining physical-device gates are recorded in `docs/feasibility.md`.

References: [GitHub Pages REST API](https://docs.github.com/en/rest/pages/pages), [ADR 0005](0005-github-pages-hosting.md).
