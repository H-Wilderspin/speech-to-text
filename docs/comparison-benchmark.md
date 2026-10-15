# Local comparative benchmark — 2026-10-13

> Historical research: this feature was removed from the MVP by [ADR 0046](decisions/0046-live-transcription-only-mvp.md). Commands and source paths below refer to earlier Git history.

**Follow-up completed:** [Community-1, per-turn identity and word alignment](community-benchmark.md)
reach 120/123 correctly named words and 9/11 complete utterances with zero false
names on 41 unknown words in this generated set. The original comparison below
is retained as evidence; the follow-up supersedes its pending Community-1 test.

**Recommendation: pursue a separate delayed Python pipeline, starting with
speech-region Whisper transcription. Replace and test the speaker-turn model
before connecting that pipeline to the app.** The tested delayed diarizer makes
identity errors, so none of the tested complete replacements is ready to deploy.

This is a local technical screen, not a human accuracy result or a managed API
comparison. The user requested local work first because API access is unavailable.
The live app, its browser transcription and production deployment are unchanged.

## What ran

Eight generated recordings, 117 seconds total, using Windows **Microsoft Hazel
Desktop** and **Microsoft Zira Desktop**. These are synthetic voices, not family
recordings. Enrollment uses a separate passage. Cases cover longer speech,
known/unknown/known turns without added gaps, two enrolled voices, short speech,
a five-second pause, deliberate repetition, an unknown voice alone, overlapping
voices and silence. Some scenarios reuse the same clips, so these are not eight
independent speakers or independent language samples.

Non-overlap cases contain 164 reference words, including 123 enrolled-speaker
words and 41 unknown-speaker words, across 11 known utterances. One utterance can
contain multiple sentences. Overlap has no single reference word ordering and is
excluded from WER and the table's word denominators.

Host: Windows build 26200, Intel Core Ultra 7 255H; Node 22.20.0 and Python 3.13.
Whisper small.en uses CPU int8, four threads, beam size five. The Intel Arc GPU was
not used. Version pins and model/fixture hashes are in the
[machine-readable results](comparison-benchmark-results.json).

## Results

| Actual inference route | Word errors / 164 | Correctly named known words / 123 | False names on unknown words / 41 | Complete correctly named utterances / 11 |
|---|---:|---:|---:|---:|
| Current local ASR + strict voice windows | 19 (11.6%) | 104 (84.6%) | 0 | 0 |
| Same local ASR + delayed speaker turns | 19 (11.6%) | 75 (61.0%) | 13 | 0 |
| Whole-recording Whisper + delayed turns | 14 (8.5%) | 67 (54.5%) | 14 | 1 |
| Speech-region Whisper + delayed turns | **2 (1.2%)** | 75 (61.0%) | 13 | 0 |

“Current local” means the actual shipped local Zipformer model and voice-window
rule **before** browser text correspondence. It does not measure the browser
recognizer supplying the live pane or reproduce end-to-end app coverage. The
baseline therefore omits an additional source of upper-pane word loss.

Correctly named coverage requires both the right word and right identity; an
omitted word counts against it. False names include aligned substitutions on
unknown reference words. Named insertions are reported separately in the JSON
(six for each Zipformer route, zero for either Whisper route). Complete means
every reference word was recognized and correctly named; WER separately penalizes
extra inserted words. Scores use case/punctuation-normalized edit alignment.

The tested delayed diarizer is the existing **sherpa segmentation-3.0 + ERes2Net**
experiment, not pyannote Community-1 or a managed model. It merged the two voices
in the known/unknown/known case. Aggregating that mixed cluster's audio produced
a match to the enrolled voice, falsely naming the unknown person's words. When
both voices were enrolled, the merged cluster matched both references and the
ambiguity rule withheld the name. This is direct evidence against deploying this
particular turn/identity implementation.

Whole-recording Whisper omitted one deliberately repeated phrase and generated
one word on silence. Transcribing separate Silero speech regions retained both
repetitions and emitted no word on silence. The follow-up uses a 500 ms silence
split and 200 ms padding, and was explored on this same set. Those settings still
need fresh recordings; they are not independently validated tuning.

Whisper's speech-region pass took **25.8 seconds of CPU processing for the 117
seconds of input**, excluding model loading and collection delay. This suggests
desktop throughput is viable. It does not establish Pixel 8 performance, live
queue behaviour, network overhead or a p95 end-to-end delay. The JSON includes
per-fixture timings and separately measured serial sums with diarization.
Reported timings are individual offline passes, not averages; the baseline was
rerun once with a token-assembly check and produced identical accuracy counts.
The Zipformer delayed timing also includes its redundant baseline voice-window
work, so it is not an optimized service runtime comparison.

## Why improved transcription alone is insufficient

Even with the reference words and their synthesizer-provided onset times, the
existing delayed speaker model correctly labels only 78/123 known words and
falsely names 14 unknown words. This evaluation-only probe removes ASR error;
speaker segmentation/identity remain a bottleneck.

Conversely, combining speech-region Whisper with **scripted correct speaker
intervals and identities** yields 119/123 correctly named words and 8/11 complete
utterances. That is an oracle diagnostic, **not an implemented solution**. Even
this artificial advantage does not fix all boundary timing errors. Playback
intervals include clip-edge silence, so this is not a human word-boundary audit.

All inference joins remain strict: a whole Whisper word interval must lie within
one identified speaker, without an overlapping cluster or uncovered gap. The
older ASR only supplies token points, which provide weaker boundary information.
No name is stretched across a gap or copied over uncertain sentence endings.
No route assigned words during the scripted overlap interval, but the delayed
diarizer withheld every cluster there; this is not evidence of useful overlap
transcription or reliable human overlap rejection.

## Next comparison

1. Keep browser transcription for Live. Use the speech-region Whisper result as
   the delayed transcription candidate, with stable audio coordinates.
2. Evaluate **modern pyannote Community-1** and forced word alignment, keeping
   non-exclusive overlap evidence and conservative word-level assignment. Match
   voiceprints only after finding clean speaker turns; test mixed-cluster rejection
   before aggregating a whole cluster into one identity sample.
3. Repeat with held-out human enrollment/test speech, an unenrolled person and
   recorded audio. Measure boundaries, false names and complete assigned sentences;
   do not lower the threshold merely to improve known-speaker coverage.
4. Compare a managed service on the same authorized recordings when access is
   available. There is currently no evidence to rank managed versus modern local
   diarization, and no hosted audio processing or charges occurred in this screen.

[Community-1 requires accepting the model's conditions and a Hugging Face token](https://huggingface.co/pyannote/speaker-diarization-community-1).
It runs locally once downloaded. That access was unavailable for this run.
[WhisperX](https://github.com/m-bain/whisperX) provides a candidate alignment/diarization
integration, but was not installed or measured here. Merely changing JavaScript
to Go would not address the measured segmentation and timing failures.

## Reproduce

From the repository root, with Node dependencies installed and the existing
private diarization runtime prepared as described in [research instructions](../research/README.md):

```powershell
python -m venv research/private/benchmark-venv
research/private/benchmark-venv/Scripts/python.exe -m pip install -r research/comparison-requirements.txt
powershell -NoProfile -File research/generate-comparison-fixtures.ps1
node research/comparison-fixtures.mjs
node research/comparison-local.mjs
research/private/benchmark-venv/Scripts/python.exe research/comparison-whisper.py
research/private/benchmark-venv/Scripts/python.exe research/comparison-whisper.py --speech-regions
node research/comparison-report.mjs
npm run check
```

Run inference commands sequentially to avoid CPU contention. The first Whisper
run downloads its pinned public model; subsequent runs reuse the cache. All WAVs,
models, embeddings in memory and intermediate synthetic transcripts are local.
Only aggregate results are committed. To regenerate the public JSON deliberately,
pass `docs/comparison-benchmark-results.json` to `comparison-report.mjs`.

Validation: scoring regression tests, typecheck, lint, **221 unit tests**, pinned
asset verification and production build passed. Browser assets retain the same
hashes; no new device or browser microphone acceptance is claimed.
