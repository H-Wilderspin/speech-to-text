# ADR 0031: Use matched context to distinguish repeated wording

Date: 2026-10-12
Status: Accepted; refines ADR 0027

## Context

A current-build phone trace reports three local assigned spans but only one
aligned span. The user confirms all speech was theirs and supplies repeated
wording among the missing captions. Capture drains normally. The numeric trace
establishes loss during text correspondence but cannot reconstruct the private
local wording or prove the reason for every excluded word.

A synthetic regression reproduces a specific limitation: global uniqueness rejects
both occurrences of a six-word phrase even when a distinct passage between them
establishes their ordering. Browser repetition arriving ahead of local recognition
can also withdraw an earlier supported name for this reason.

## Decision

Keep existing globally unique, monotonic anchors and the one-word-difference
fallback. After building that correspondence, inspect the unmatched intervals
before, between and after mapped words. Within each interval, allow exact six-word
anchors that occur once in each recognizer's corresponding interval. Reject
reordered interval anchors and skip contextual extension if existing correspondence
has conflicts or is not strictly monotonic. Perform one bounded pass.

Context establishes occurrence correspondence only. Each assigned word still needs
its own final local speaker evidence. Do not copy the context's identity, fill
unmatched words, relax the voice cutoff, fabricate browser timestamps, deduplicate
deliberate repetition or change browser text. Recompute on provisional revisions
so withdrawn distinguishing context also withdraws unsupported estimates.

## Consequences

Repeated phrases can retain separate identities when surrounding agreement
distinguishes occurrences. Repetition that remains ambiguous within an interval
stays unknown. An isolated phrase shorter than six agreeing words, recognizer
differences and failed voice windows can still omit upper text. This is a partial
alignment improvement, not validated human speaker accuracy or a complete fix for
the phone report. No new model, storage, service, logging content or download.

## Validation

Synthetic tests fail before the change and pass after it. They cover different
speakers repeating wording around unknown but matching context, repeated ambiguity
inside one interval, unknown/provisional local speech, browser repetition preceding
local evidence, exact preservation of browser text and withdrawal after revision.
Existing tests retain short/reordered/ambiguous rejection and independent word
evidence. Execution and publication evidence are recorded in feasibility notes.
