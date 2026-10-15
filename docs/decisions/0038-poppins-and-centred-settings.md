# ADR 0038: Poppins typography and centred Settings

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-13
Status: Accepted; supersedes ADR 0026's unlimited settings width

## Context

The user requests three UI font sizes, Poppins, weight-400 captions/descriptions,
small uppercase labels with more spacing, and a centred Settings panel capped at
1000px with outside dismissal. People must come first; Text size must be a label,
with its preview matching the selected size, alongside language at the bottom.

## Decision

Use three size roles: .875rem small labels/descriptions, 1rem medium headings and
controls, and the existing adjustable large caption size (2rem initially). Retain
28–56px caption choices; changing this size changes the large role and its preview,
not the small/medium UI. Keep browser text scaling and zoom available.

Bundle unmodified Poppins Regular (400) and SemiBold (600) with the OFL licence,
provenance and hashes. Precache both fonts and the licence with the offline shell;
no runtime Google Fonts request or new script dependency. Use 400 for description
and caption text, 600 for controls/labels, .08em tracking and 1.7 line height for
uppercase labels. User-entered values and transcript words retain their casing.

Keep the native full-height scrolling dialog, centred horizontally with a 1000px
maximum width. Only a primary pointer gesture that starts and ends outside its
bounds closes it; dragging out from inside does not. Keep Escape, the return icon,
focus restoration and existing session disposal. Backdrop clicks do not activate
the controls behind the dialog.

Move People and registration first, supplementary settings/help after, then a
final flex row with equal-width text-size and language fields. Text size is a
span label naming its control group rather than a heading. Its number uses the
selected caption size. On narrow screens the number sits above its two buttons
inside its half-column; the language field stays adjacent.

## Validation

Typecheck/lint/unit/build, focused Chromium/WebKit UI and offline font checks,
desktop/mobile screenshots and the full Linux deployment suite. See feasibility
for results; physical phone testing is not inferred from viewport emulation.
