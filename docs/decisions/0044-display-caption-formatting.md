# ADR 0044: Format captions at the display boundary

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-15
Status: Accepted

## Context

The user chooses lightweight local formatting to improve sentence-start casing
without changing live recognition or adding a grammar service. Formatting each
speaker fragment independently would incorrectly capitalise words in the middle
of a sentence, and formatting before alignment could change its character offsets.

## Decision

Use a pure presentation formatter in Transcript for both app entry points. Group
contiguous slices by original source line and session, format their combined text,
then distribute display characters back to the original slices. A replacement
array indexed by original UTF-16 positions handles changed whitespace and Unicode
uppercase expansion without changing source offsets or speaker metadata. Filter
inactive/unknown speakers after formatting; rejoin slices for Live as before.

Capitalise original line openings and clear sentence starts after existing `.?!`
punctuation and whitespace. Treat new pause lines as readable starts, without
claiming they are grammatical sentences. Avoid common abbreviations, initials,
ellipses, decimals, addresses and paths. Preserve existing case, including acronyms
and mixed-case words. For English, capitalise standalone `I`, `I'm`, `I'd`, `I'll`
and `I've`, including curly apostrophes. Collapse repeated whitespace and trim
line edges; remove spaces before English punctuation while retaining French
punctuation spacing. Never add punctuation or correct spoken wording.

Recompute from the current source snapshot when recognition revises it. Keep
recognition snapshots, command parsing, alignment, speaker names, line/session IDs
and revision numbers untouched. No additional setting, model, worker, microphone,
network request or storage is needed. This complements the existing local-ASR
uppercase renderer; it does not replace that recognizer-specific conversion.

## Consequences and validation

Heuristics cannot identify every abbreviation, proper name or missing sentence
boundary. They preserve the provider's existing mixed case rather than guessing.
No general grammar correction is claimed. Rules follow the selected display/speech
language; English pronoun rules are disabled for other supported languages.

Unit tests cover wording/metadata preservation, source slices, hidden speakers,
Unicode expansion, changing hypotheses, new lines, punctuation, abbreviations,
technical tokens and non-English text. Browser tests verify rendered revisions,
language selection and continued Clear/Stop command handling. Run results and
publication verification are recorded in [feasibility](../feasibility.md).
