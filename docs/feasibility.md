# Verification and known limits

This is the current evidence summary, not a release diary. Detailed experiments
and older results are in [the archive](archive/feasibility-history.md).

## Latest published app

Release `532f6a7`, verified 2026-11-24:
[successful Pages workflow](https://github.com/H-Wilderspin/speech-to-text/actions/runs/45470212237).

- Local checks: typecheck, lint, 164 unit tests, two setup-helper tests and build.
  Browser suite: 192 passed, four expected native-touch skips in WebKit.
  Family connection suite: eight passed. CI and Pages deployment also passed.
- Served JavaScript: `assets/index-fJvpXlYe.js`; service worker: `8e14abb03df590d8`.
- Live checks: Windows Chromium 156.0.8078.4 (1024?900) and WebKit 27.2
  (iPhone 13 emulation). Verified the accent, 11px weekly tags with 2.2px tracking,
  no horizontal overflow and 24-hour pairing instructions.
- Simulated speech/wake providers verified editing interruption, retained
  confirmed captions, no automatic restart and a wake lock while visible,
  including after stopping. Public meals were read only.

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
- Current accent `#db6931` contrast: 3.46:1 on white, 3.14:1 on `#fff1ed`,
  2.78:1 on `#ffe0d6`, and 3.27:1 on the canvas. Small accent text needs a
  readability follow-up. Earlier `#b04230` measurements in the archive describe
  a different candidate, not this release.
- Local queues survive normal reloads, not browser-data deletion/eviction.
  Service quotas and outages can delay shared saves. An unapplied editor draft
  is session-only. Do not claim guaranteed offline speech or background recording.
