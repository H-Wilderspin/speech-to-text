# ADR 0045: Keep the screen awake while listening

Date: 2026-10-15
Status: Accepted

## Context

The target user's tablet sleeps during listening. Its exact model, OS version and
Safari/Home Screen mode are unknown. The app previously requested no screen wake
lock. Recognition and delayed attribution must remain independent of power policy.

## Decision

Use the native Screen Wake Lock API, with feature detection and no new dependency,
setting, audio workaround or network request. A shared lifecycle observer follows
the main engine (and browser engine in the comparison entry): acquire during
permission/listening/restarting while visible; release on stopping, idle, error,
hidden document, pagehide and disposal. Keep the lock through session Clear.

Generation checks immediately release late acquisitions after Stop/disposal or a
new listening cycle. Incoming captions do not initiate duplicate requests. OS
revocation or denial is respected, with no retry loop; a new Listen or visibility
transition can retry if listening is still active. The existing interruption
handler still stops recording on leaving the page; returning never restarts it.
Settings reports held/unavailable status without adding caption controls.

## Consequences

This prevents automatic screen sleep only while the browser/OS grants the lock.
It increases screen-on power use. It cannot override manual locking, OS power
policy or background microphone restrictions. Failure never stops transcription.
[Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)
introduced the API; [Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
fixed it in Home Screen Web Apps. Use a Safari tab on older supported iPadOS.
See the [Screen Wake Lock specification](https://www.w3.org/TR/screen-wake-lock/)
for visibility, release and power-policy semantics.

## Validation

Unit tests cover lifecycle transitions, late results, unsupported/denied access,
visibility, pagehide, disposal and OS revocation. Browser integration tests cover
caption continuity, Settings status, Clear, button/spoken Stop and interruption.
These use a mocked wake-lock provider and cannot prove physical Auto-Lock behavior.
Results and tablet acceptance steps are in [feasibility](../feasibility.md).
