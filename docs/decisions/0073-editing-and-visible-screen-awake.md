# ADR 0073: Stop speech for editing and keep the visible app awake
Date: 2026-11-24
Status: Accepted (published in 532f6a7; physical-device checks pending)

## Context
The user reports that speech sometimes enters an edit field on their devices.
They want listening stopped when editing opens and the screen kept awake whenever
the app is open. They also requested priority over another app's microphone use.

## Decision
Abort recognition before opening or restoring a meal/shopping editor and before
its programmatic focus. A shared focus guard covers text fields, including family
connection fields and keyboard navigation. Reuse the interruption lifecycle with
an editing-specific message: detach callbacks, keep confirmed captions, discard
provisional speech and cancel automatic restarts. Saving, cancelling and leaving
an editor never restart recognition. An explicit Listen remains available.
Browsing a planner or Settings without entering text still preserves listening.

Replace the listening-only wake lock in ADR 0045 with a visible-document lock.
Request on mount/return, release on visibility loss, pagehide and unmount, and
release stale asynchronous acquisitions. Keep the lock through Stop and errors.
Respect provider denial or revocation without a retry loop. Retain Settings status.
No silent audio/video workaround, additional microphone stream or dependency.

Browser APIs provide no way to force other apps to release their microphone or
to override OS permissions/resource policy. Keep explicit Listen and the existing
audio-capture recovery message. Do not claim automatic microphone takeover.

## Consequences
The screen may use more battery while the app remains visible. The OS can deny
the wake lock, release it for power policy or honour manual locking. Recognition
still stops on leaving the app and never restarts automatically on return.
Independent keyboard dictation and device-specific focus behaviour need physical
testing; aborting this app's recognizer does not control another app's dictation.

## Validation
Unit tests cover editing interruption during permission/listening, late callbacks,
retained confirmed captions, wake-lock visibility, late results, denial, missing
support and OS revocation. Browser tests cover editing in full/split planners,
text-field focus, drafts, caption retention and wake lock across Stop/return.
See feasibility and manual-testing notes for observations and device acceptance.

Sources checked 2026-11-24:
- [Screen Wake Lock specification](https://www.w3.org/TR/screen-wake-lock/)
- [Web Speech API](https://webaudio.github.io/web-speech-api/)
- [Microphone permissions and contention in Edge](https://learn.microsoft.com/en-us/troubleshoot/microsoft-edge/development/edge-camera-microphone-not-working)
