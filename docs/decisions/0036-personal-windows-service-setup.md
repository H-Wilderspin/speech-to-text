# ADR 0036: Prepare a personal Windows computer for the comparison

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-13
Status: Accepted

Update 2026-10-13: [ADR 0037](0037-browser-plan-collapsible-attribution.md) supersedes
the personal-PC rollout. Setup remains available as inactive research.

## Context

The user confirms the failing PC uses a required work VPN. Both DNS resolver
queries return A records instead of Cloudflare's SRV records. They selected a
personal computer outside that managed network and confirmed Windows, with
hardware specifications unknown. Do not disable or work around work-network controls.

## Decision

Keep ADR 0035's separate page, CPU service and temporary Cloudflare relay. Add a
Windows x64/Python 3.13 setup script and short first-time guide. Check DNS before
large downloads, recreate the pinned environment, sign into the user's own HF
account when needed, download pinned snapshots and verify model loading offline.
Share model locations between setup and inference to prevent configuration drift.
Check the Cloudflare executable against the launcher's existing release hash.

Clone the public repo onto the personal PC; do not transfer the work PC's virtual
environment, tokens, runtime key, logs or caches. The new launcher generates its
own comparison key. Keep phone profiles in the existing browser storage. No Node
installation, frontend build, HF subscription or GPU is required for the service.

## Consequences

First setup requires model/dependency downloads and authorized Community-1 access.
Cached models remain local for offline inference. Personal-PC memory, throughput
and tunnel connectivity are unknown until tested. Preparation validates model
loading and processing silence, not speech accuracy or public connectivity.
The existing start script still requires a successful public health response.

## Validation

PowerShell syntax and the actual native Python version-check argument pass on
Windows. Setup rejects the reproduced missing SRV records before installing.
`python -m service.prepare --offline` loads the existing pinned CPU models and
processes silence successfully. Python boundary tests and dependency checks pass.
Online model preparation hits this work environment's HTTPS trust failure; no
certificate verification was disabled. Clean installation and public launch on
the personal PC remain untested. See feasibility/troubleshooting for final checks.
