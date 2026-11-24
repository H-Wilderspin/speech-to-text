# Verification and known limits

This is the current evidence summary, not a release diary. Detailed experiments
and older results are in [the archive](archive/feasibility-history.md).

## Latest published app

Release `85e3ae8`, verified 2026-11-24:
[successful Pages workflow](https://github.com/H-Wilderspin/speech-to-text/actions/runs/45475898615).

- Local checks: typecheck, lint, 173 unit tests, two setup-helper tests, production
  build, 12 paired-browser tests, Worker bundle and local Worker/D1 smoke checks
  passed. Full CI browser suites and Pages deployment passed.
- Served JavaScript: `assets/index-BHC-zNBY.js`; service worker: `4c8833ead49a25c6`.
- Actual published app: Windows Chromium 156.0.8078.4 (1024 by 900) and WebKit 27.2
  (iPhone 13 emulation). Verified six-digit instructions, numeric-keypad/autofill
  hints, live pairing, access after reload and authenticated meal/shopping reads.
  Temporary devices were revoked; no family data changed.
- Worker version `07167713-fb46-4413-89b8-1a4b1b6c07ca`; migration 0002 applied.
  Local Worker/D1 verified issuance, claiming, 429/Retry-After and existing-device
  access during the pairing limit. Unit tests cover time boundaries, concurrency,
  leading zeros/collisions, old-code compatibility and fail-closed behaviour.
  Live checks deliberately did not exhaust the family's pairing budget.
- Earlier editing/wake-lock checks used simulated speech/wake providers;
  detailed evidence remains in the archive. Physical acceptance is still pending.

## Family service

Worker/D1 and GitHub App access were verified on 2026-11-24: pairing, remembered
access after reload, authenticated meal/shopping reads, conditional saves,
stale-revision rejection, pause/resume and revocation. Two owner-approved writes
preserved existing JSON values; temporary test devices were revoked.
The later Worker release verified 24-hour code expiry. See
[rollout evidence](archive/hosted-editing-history.md) for exact versions/commits.

These checks establish observed operation at that time, not a continuing uptime
or physical-device guarantee.

## Known limits

- Physical family-device speech-to-editor behaviour, screen sleep, microphone
  contention, touch gestures and VoiceOver acceptance remain pending.
  [Manual checks](manual-testing.md) must record actual device/OS/browser/mode.
- Browser recognition can miss overlapping speech and favour a nearby speaker.
  No speaker filtering or separate-device caption transmission is implemented.
- A browser cannot take microphone priority from another app. Independent OS
  dictation is outside this app's control. Wake locks can be refused/revoked.
- Published accent `#db6931` contrast: 3.46:1 on white, 3.14:1 on `#fff1ed`,
  2.78:1 on `#ffe0d6`, and 3.27:1 on the canvas. Small accent text needs a
  readability follow-up. Earlier `#b04230` measurements in the archive describe
  a different candidate, not this release.
- Local queues survive normal reloads, not browser-data deletion/eviction.
  Service quotas and outages can delay shared saves. The published release keeps
  unapplied drafts for the session only. Do not claim guaranteed offline speech
  or background recording.

## Local changes awaiting deployment

Settings now offers earthy green, high-contrast coral and navy/grey themes.
Calculated accent contrast on canvas/control fills is at least 5.85:1, 4.86:1
and 6.93:1 respectively.
Planner drafts now recover locally after reload; shopping has Undo;
the footer shows saving status beside Listening with a conditional divider. Fonts are
WOFF2 with unchanged glyph mappings: 103,064 bytes combined, down from 317,628.
Local checks passed: typecheck, lint, 184 unit tests, two setup tests and build;
202 Chromium/mobile-WebKit browser checks passed (four platform-specific skips),
plus all 12 paired-device frontend checks. Screenshots were reviewed for colour
and footer layout. One WebKit app-update check timed out on the first run and
passed on rerun. Physical-device acceptance remains separate from emulation.
