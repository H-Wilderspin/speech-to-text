# ADR 0015: Three controls above full-height captions

Date: 2026-10-10
Status: Accepted; supersedes ADR 0001's visible disclosure placement and the original transcript controls

The later name/colour request adds compact speaker labels within the transcript,
including a neutral Unknown label when identity metadata is missing. See
[ADR 0017](0017-direct-live-attribution-prototype.md). The three-button layout remains.

## Context

The user explicitly requests only Listen, Clear and Settings at the top of the page, with text occupying the remaining space. The original branding, status row, text controls, language selector and footer reduce the caption area. The Unknown banner also made the unfinished identification feature look like an attempted match.

## Decision

Use a three-button top bar and an independently scrolling transcript filling the rest of the dynamic viewport. Listen becomes Stop during capture; Clear retains its existing stopped-session behaviour. Remove branding, the Unknown banner, large empty-state artwork and the floating Newest speech button. Scroll to the bottom to resume following; reading earlier speech keeps its position. Screen-reader status and provisional-text annotations remain available; actionable errors and offline notices appear when needed.

Move text size, language, voice profiles, listening help, provider disclosure and installation information into a native modal Settings dialog. The existing provider disclosure remains attached to Listen as an accessible description. This placement follows the user's explicit request rather than adding a new first-use gate. Opening Settings does not interrupt listening; language stays locked while active. Opening Speakers stops live capture as before. Back/Escape returns from Speakers to Settings and then to captions, restoring focus to the relevant launch button. No microphone, model download or profile store opens merely from viewing Settings.

The limitation on speaker identification is explained in Settings and Speakers. Hiding the Unknown banner does not enable or waive live identification requirements. No storage, provider, voice consent or matching policy changes.

## Validation

Update existing app and speaker browser tests for the Settings route, focus return and scroll-to-bottom behaviour. Check exactly three main-page buttons, viewport use at phone size, settings during listening, existing 320 px/enlarged-text layouts, offline shell and real synthetic enrolment/storage flows. Record actual results in feasibility notes. Native dialogs, dynamic viewport changes and assistive technology still need physical-device checks.
