# Verification and known limits

This is the current evidence summary, not a release diary. Detailed experiments
and older results are in [the archive](archive/feasibility-history.md).

## Latest published app

Release `1d5f2ec`, verified 2026-11-26:
[successful Pages workflow](https://github.com/H-Wilderspin/speech-to-text/actions/runs/45829495981).

- Typecheck, lint, 197 unit tests, two setup-helper tests, production build,
  full CI browser suites, 18 family-pairing tests, six owner-page tests, Worker
  bundle and Pages deployment passed. Additional local Monday-lunch coverage
  passed six browser cases (blank, default and dated entries in both engines);
  the later test/evidence commit does not change the deployed application.
- Served JavaScript: `assets/index-DK2lOLRP.js`.
- Actual published app: Windows Chromium 156.0.8078.4 and WebKit 27.2 (iPhone 13
  emulation). With mocked family data and access, verified Monday lunch at a
  resized 390-by-400 viewport and with visual-only shrink/pan (400px visible height,
  35px top offset). Save and Cancel remain above navigation and within the visible
  area, with 48px targets and successful hit testing. Cancel closes the editor.
  No real family data was changed. The Chromium screenshot was reviewed.
- Coverage includes repeated edits, keyboard changes during initial focus,
  closing/reopening, restoring full height and preserving layout during pinch zoom.
  The user reported intermittent overlap particularly on Monday lunch in both
  Pixel Chrome and the installed app. Simulated viewport changes do not establish
  that physical-device acceptance; confirmation of this follow-up remains pending.

## Family service

Worker version `8a54e7fa-9877-4f81-8116-062c3bdbad20` and D1 migration 0003
were deployed on 2026-11-26. The owner confirmed Cloudflare and Brevo Free plans.
The service advertises four approved addresses and uses a verified sender;
one owner-requested test email was reported delivered by Brevo. Its invitation
expires 24 hours after creation. Inbox placement and delivery to other recipients
have not been verified.

Live checks passed for manual code issuance, 24-hour expiry, claiming,
authenticated planner reads and revocation. The temporary test device was
revoked; no planner data was changed. Owner-page login, remembered session after
reload, logout and layout at 390px passed in Chromium 156.0.8078.4 and WebKit 27.2
with iPhone 13 emulation. The server sets Secure, HttpOnly and SameSite=Strict;
Windows WebKit's automation API reports SameSite=None, so its cookie flags alone
do not establish physical Safari enforcement.

Earlier live checks covered conditional saves, stale-revision rejection,
pause/resume, guessing limits, old-code compatibility and existing-device access
during the pairing limit. See [rollout evidence](archive/hosted-editing-history.md).

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
