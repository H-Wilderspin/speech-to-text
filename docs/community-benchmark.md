# Community-1, turn identification and word alignment — 2026-10-13

> Historical research: this feature was removed from the MVP by [ADR 0046](decisions/0046-live-transcription-only-mvp.md). Commands and source paths below refer to earlier Git history.

**The strongest measured candidate is delayed speech-region Whisper, Community-1
speech turns, identity matching separately for each turn, and forced word alignment.**
It correctly recognizes and names 120/123 known-speaker words (97.6%), assigns no
name to the 41 unknown-speaker words, and produces 9/11 complete known utterances.
This is an exploratory result on generated speech, not validated family accuracy.

## Controlled comparison

The same eight fixtures and enrollment passages as the [initial screen](comparison-benchmark.md)
were reused: 117 seconds, two Windows synthetic voices, 164 non-overlap reference
words, 123 known and 41 unknown words. The earlier speech-region Whisper output
was reused unchanged, including its two recognition errors. No ground-truth words,
speaker count or scripted turn boundaries enter inference.

Community-1 was downloaded after the user confirmed Hugging Face login/access.
It ran locally using pyannote.audio 4.0.7 on the same Core Ultra 7 255H CPU with
four threads. Regular overlapping diarization was used, not exclusive output.
Model revisions, checksums, versions, scores and per-case aggregates are in the
[results JSON](community-benchmark-results.json). No human audio was uploaded.

| Route, all using identical Whisper words | Correctly named known words / 123 | False names on unknown words / 41 | Complete known utterances / 11 |
|---|---:|---:|---:|
| Older delayed model, cluster-wide identity | 75 | 13 | 0 |
| Community-1, cluster-wide identity | 75 | 13 | 0 |
| Community-1, identity separately for each turn | 108 | 0 | 0 |
| Community-1, cluster-wide identity + aligned words | 83 | 15 | 6 |
| **Community-1, per-turn identity + aligned words** | **120** | **0** | **9** |

Complete means every reference word was recognized and correctly named; the
separate WER metric accounts for insertions. There were no named insertions here.
Overlap is excluded from these denominators because it has no unique linear
reference transcript. No words in the scripted overlap interval were named by
the winning variant, but this single mixture does not validate human overlap
handling. The silence case produces neither words nor speaker turns.

## What the comparison establishes

**Replacing the diarizer alone did not fix identity.** Community-1 also merged the
alternating voices into one anonymous cluster. Combining that cluster's audio
into one voiceprint contaminated the identity sample: with one enrollment it
named the other voice; with both enrolled it became ambiguous and withheld names.
That result cannot establish Community-1's general accuracy on human voices.

**Matching individual detected turns avoids that specific contamination.** The
follow-up reuses model-predicted turn intervals but assigns each interval its own
identity comparison. It does not inherit a name from other turns in the same
anonymous cluster. Enrollment, the ERes2Net model, the experimental 0.60 cutoff,
unknown fallback and overlap exclusion are unchanged. A turn needs at least one
second of usable non-overlapping speech. No threshold was tuned on these cases.
This does not prove that every future predicted turn contains one speaker.

**Forced alignment addresses a separate timing failure.** Whisper's original word
intervals often started before the diarizer's speech onset, so strict joining
discarded opening words. WhisperX's alignment module plus the English wav2vec2
model aligned the already recognized words to the same PCM. Interpolation was
disabled; missing timing remains unknown. The runner asserts that alignment
preserves the exact recognized word sequence. Every word in this set received
timing, and complete utterances rose from zero to nine with per-turn matching.

The remaining three incorrect/unassigned known words are two ASR substitutions in
the short-phrase case and one unassigned opening word in the deliberate-repeat
case. All eleven known utterance endings are correctly retained. Unknown-only
speech stays unnamed, and both enrolled speakers receive all 37 correct words in
the alternating two-profile case. No boundary was extended to force a match.

## Timing and limits

For the strongest variant, separately measured serial stages total **56.1 seconds
for 117 seconds of input**: transcription 25.8 s, Community-1 21.0 s, identity
comparisons 4.5 s, alignment 4.8 s. Model initialization/downloads, collecting audio,
transport, frontend updates and queueing are excluded. This suggests sufficient
offline desktop throughput; it does not measure end-to-end caption delay, phone
performance or real-time streaming. No p95 latency or battery result is claimed.

These are two generated voices, with clips reused across scenarios. Per-turn
matching and alignment were follow-ups selected after observing failures on this
same set. A held-out human test is necessary before trusting the improvement.
The identity threshold remains experimental, not a calibrated probability.
Continuous speech through a speaker change, background voices and overlapping
human conversation need additional tests. Managed APIs remain unmeasured.

## Recommended implementation direction

Keep browser Live captions. In a separate delayed service, retain timestamped
audio and independently obtain transcription, speech turns and aligned word times.
Compare each usable turn against enrolled references; do not spread one matched
cluster identity to all its turns. Join by audio intervals, retaining unassigned
words internally and displaying only confidently assigned words above.

First validate this flow on held-out human enrollment and speech, then add bounded
queueing, overlapping context, stable payload IDs/revisions and session cancellation
as proposed in [ADR 0032](decisions/0032-delayed-audio-timeline-service-proposal.md).
There is no app/backend deployment in this benchmark. GitHub Pages remains the
frontend host; a future Python service needs separate hosting or a companion PC.

## Reproduce

Generate/run the initial fixtures and Whisper pass first using the initial report.
With the model conditions accepted and CLI login saved locally:

```powershell
python -m venv research/private/community-venv
research/private/community-venv/Scripts/python.exe -m pip install -r research/community-requirements.txt
research/private/community-venv/Scripts/python.exe research/comparison-community.py
node research/comparison-community.mjs
```

For the alignment-only exploratory environment used here:

```powershell
research/private/community-venv/Scripts/python.exe -m pip install --no-deps -r research/community-alignment-requirements.txt
research/private/community-venv/Scripts/python.exe research/comparison-alignment.py
node research/comparison-community.mjs --aligned docs/community-benchmark-results.json
npm run check
```

The alignment snapshot deliberately installs WhisperX without its full ASR/CLI
dependencies and bypasses its automatic torchaudio model loader. Its alignment
function is supplied a Transformers wav2vec2 model directly. These module calls
were exercised; this is **not a supported full WhisperX environment**. `pip check`
will report WhisperX's missing/conflicting full-application requirements. Resolve
a supported service dependency set before production rather than copying this
research environment wholesale. The original Whisper benchmark environment is
unchanged. Model caches, synthetic WAVs and intermediate transcripts remain ignored.

Checks: typecheck, lint, **223 unit tests**, pinned asset verification and build
passed; final report lint also passed. All eight Community-1 and alignment cases
completed, with word-preservation assertions. The production bundle is unchanged.

Sources: [Community-1](https://huggingface.co/pyannote/speaker-diarization-community-1),
[WhisperX alignment implementation](https://github.com/m-bain/whisperX/blob/main/whisperx/alignment.py).
