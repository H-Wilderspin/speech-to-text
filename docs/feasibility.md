# Verification and known limits

This is the current evidence summary, not a release diary. Detailed experiments
and older results are in [the archive](archive/feasibility-history.md).

## Latest published app

Release `efd8347`, verified 2026-11-24:
[successful Pages workflow](https://github.com/H-Wilderspin/speech-to-text/actions/runs/45494632611).

- Typecheck, lint, 184 unit tests, two setup-helper tests, production build,
  full CI browser suites, 12 paired-browser tests, Worker bundle and Pages
  deployment passed. Local browser coverage passed with four platform skips.
- Served JavaScript: `assets/index-Cr4V10PT.js`; service worker: `a1dbf6dd1076eee4`.
- Actual published app: Windows Chromium 156.0.8078.4 (1024 by 900) and WebKit 27.2
  (iPhone 13 emulation). Verified three themes, remembered preferences, pairing
  UI, captions using simulated speech, the status divider, meal navigation,
  public planner reads, updated regular items and offline reopening. Screenshots
  were reviewed. No family data, pairing codes or remembered devices were changed.
- Planner drafts recover after reload; shopping supports Undo. The footer shows
  saving status beside Listening. Automated tests cover recovery, concurrent
  family changes and Undo during/after writes; live checks were read-only.
- Accent contrast on canvas/control fills is at least 5.85:1 for earthy green,
  4.86:1 for coral and 6.93:1 for navy. This is not a whole-app accessibility pass.
- WOFF2 fonts preserve the original glyph mappings: 103,064 bytes combined,
  down from 317,628 bytes. Physical speech and accessibility acceptance is pending.

## Family service

Worker/D1 and GitHub App access were verified on 2026-11-24: pairing, remembered
access after reload, authenticated meal/shopping reads, conditional saves,
stale-revision rejection, pause/resume and revocation. Two owner-approved writes
preserved existing JSON values; temporary test devices were revoked.
The later Worker release verified 24-hour code expiry. See
[rollout evidence](archive/hosted-editing-history.md) for exact versions/commits.

This frontend release did not deploy the Worker or change D1. Worker version
`07167713-fb46-4413-89b8-1a4b1b6c07ca` and migration 0002 remain in use.
The six-digit pairing rollout verified issuance, claiming, guessing limits,
old-code compatibility and existing-device access during the pairing limit.

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
- Local queues and unfinished planner drafts survive normal reloads, not
  browser-data deletion/eviction. Service quotas and outages can delay shared
  saves. Captions are not persisted. Do not claim guaranteed offline speech or
  background recording.
- One local WebKit app-update check timed out and passed on rerun; the full CI
  run passed. Emulation does not establish physical-device behaviour.
