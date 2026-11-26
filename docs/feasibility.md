# Verification and known limits

This is the current evidence summary, not a release diary. Detailed experiments
and older results are in [the archive](archive/feasibility-history.md).

## Latest published app

Release `e3b615d`, verified 2026-11-26:
[successful Pages workflow](https://github.com/H-Wilderspin/speech-to-text/actions/runs/45846194688).

- Typecheck, lint, 211 unit tests, two setup-helper tests, production build,
  228 app browser tests (four platform-specific skips), 22 family-connection tests, six owner-page tests,
  Worker bundle and Pages deployment passed.
- Served JavaScript: `assets/index-z2JNrAKR.js`; the live service worker includes
  the same asset in its precache.
- Actual published app: Windows Chromium 156.0.8078.4 and WebKit 27.2, at 390px.
  With simulated segmented Android recognition, four completed sentences survive
  multiple pause/resume sequences in one native capture session, screen changes
  and Stop. Deliberate repeats and sentences extending an earlier opening remain
  separate. No real microphone, email or family data was used.
- The new regression failed against the previous adapter by discarding the first
  sentence when the next interim arrived. Tests now cover both legacy cumulative
  and segmented results, including Clear and voice commands. See
  [ADR 0079](decisions/0079-adaptive-android-result-slots.md).
- Local Chrome retention was accepted before the Pixel follow-up exposed this
  different failure on resuming speech. Physical Pixel acceptance of this fix
  remains pending; desktop fixtures do not establish the phone's event sequence.
- Regression coverage retains remembered legacy/paired connection status and
  verifies saves retry while another screen is open. Stalled device storage
  cannot trap navigation or discard pending in-memory edits.
- Keyboard regression coverage includes Monday lunch with blank, weekly-default
  and dated meals, repeated edits, visual-only resize/pan and restoring full
  height. Physical confirmation of the Pixel keyboard follow-up remains pending.

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
