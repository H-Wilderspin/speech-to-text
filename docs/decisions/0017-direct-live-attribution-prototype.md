# ADR 0017: Direct reference matching on a shared audio clock

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-10
Status: Accepted research direction; production integration pending

Follow-up: [ADR 0021](0021-experimental-local-name-suggestions.md) implements a
separately opted-in mode after the user explicitly authorized estimated names
before human negative calibration. The measurements below remain historical.

## Context

The user wants live names and colours from enrolled voices. Browser recognition
does not provide compatible audio spans. Pairing result arrival time with the
latest microphone embedding would mislabel delayed text. The previous local
segmentation candidate also merges two alternating generated voices before any
global clustering, so changing cluster names cannot fix that counterexample.

## Decision

Prototype **direct enrolled-reference matching**, alongside the local streaming
ASR candidate, on one continuous 16 kHz input clock. Reuse the existing English
speaker model and local profile format; do not adopt anonymous cluster IDs as
people's names. Keep browser recognition available for anonymous captions.

The prototype computes three-second embeddings every 1.5 seconds, ranks enrolled
references, and rejects insufficient score/margin. Each token point requires at
least two distinct covering windows that agree. Wait until three seconds of audio
after that point have arrived before committing its estimated identity. This is
lookahead, not measured end-to-end caption latency. ASR text can appear immediately
as provisional/Unknown and later receive a name/colour. Stop leaves insufficient
or ambiguous evidence Unknown. Token points are not word-duration boundaries.

The original instantaneous VAD gate skipped windows during pauses inside a phrase.
An optional experiment gates the *whole history window* by energy instead. Silence
then produces no embedding, while windows ending in short pauses retain speech
evidence. Energy does not establish single-speaker speech or reject arbitrary noise.

Do not ship the synthetic runner's derived thresholds. They separate two installed
TTS voices, not the target human population. The production caption component now
accepts paired speaker ID/name metadata and uses consistent high-contrast text
colours; missing metadata remains Unknown. This is display support, not a claim
that production live matching is enabled.

## Reproduced evidence

Windows, Node 22.20.0, same pinned ASR/embedding pipeline as ADR 0012. Generated
Hazel/Zira voices use three different passages: reference, calibration, held-out.
Seven calibration windows had minimum own-voice cosine 0.7993 and maximum
other-voice cosine 0.3837. The runner derived its synthetic-only score gate 0.5915
and margin gate 0.2135 before running held-out passages.

| Held-out input | Token points correctly named | Unknown | Wrong solo name | Named during overlap |
|---|---:|---:|---:|---:|
| A/A/A | 90 | 3 | 0 | 0 |
| A/B/A with gaps | 81 | 12 | 0 | 0 |
| A/B/A without added gaps | 67 | 26 | 0 | 0 |
| Equal-volume overlap | 20 | 28 | 0 | 0 |
| B at 20% amplitude during overlap | 15 | 8 | 0 | 8 |
| B removed from enrolled references | 0 | 22 | 0 | 0 |

Silence produced no tokens or embeddings. Counts are based on token **points**
inside generated playback intervals (which include pauses), not annotated words
or human accuracy. The unenrolled voice was present as a calibration negative,
so it is not a test of an entirely unseen identity. Unequal overlap is a genuine
unresolved ambiguity: eight token positions in mixed playback received a solo
name; the aggregate check does not establish which voice produced each word.

The follow-up `npm run spike:overlap-veto` measures the existing segmentation
model independently of its identity labels. Two ten-second windows detected
equal-level overlap at approximately 4.807–7.169 and 5.007–7.150 seconds, taking
81–118 ms per call. Both returned **no overlap** with B at 20% amplitude. This
candidate therefore does not repair the counterexample. A five-second-window
probe (`-- --short`) failed the existing segment-bound validation and is not a
supported workaround; outputs were not clamped into invented bounds.

In the expanded run, 23.685 seconds of A/B/A processed in 5.232 seconds; maximum
frame processing was 327 ms. Across these fixtures the worst frame was 500 ms.
This is accelerated desktop processing, not paced phone capture, battery,
wall-clock latency or an iPhone/Pixel acceptance pass. Reproduce with
`npm run spike:generate-attribution-fixtures` and `npm run spike:attribution`.

## Production implementation path

1. Add an opt-in local attribution engine implementing `TranscriptionEngine`.
   It owns one microphone capture and sends identical numbered frames to local
   ASR and speaker processing. Reuse interruption, Stop, command-stop and bounded
   retention behaviour; do not attach independent browser-ASR events to this clock.
2. Cache the additional pinned ASR/VAD assets after an explicit model preparation
   action. The research pipeline currently needs about 85 MB total; do not
   silently download it when opening Settings or starting anonymous captions.
3. Load consented compatible profiles into worker memory. Calibrate score and
   margin on separate human positive/negative sessions, including unenrolled
   people. Store calibration model/version and evidence metadata, not raw audio.
   Missing/incompatible calibration must preserve Unknown.
4. Add independent overlap evidence and reject ambiguous/mixed windows. The earlier
   segmentation model's tested overlap **veto** also missed the quiet voice;
   evaluate a better overlap detector or separation model on this retained case. Keep
   uncertain boundaries and short interjections Unknown. Similarity agreement
   alone cannot prove that only one person spoke.
5. Maintain bounded pending token/window evidence. Replace interim hypotheses by
   ASR segment ID, revise labels while evidence arrives, then emit caption groups
   with speaker ID and display name. Preserve word assembly across subword tokens;
   measure timestamp error and use a boundary guard rather than inventing ends.
6. Verify paced Pixel 8 throughput and longer sessions before making this the
   default. Measure false attribution, Unknown coverage, delay, overlap, rapid
   turns and profile deletion during/after a session; verify iPhone when available.

This route keeps GitHub Pages hosting and local voice processing. It needs no
server or private key. A server-based diarizer is an alternative product decision,
not a silent fallback. Diart demonstrates rolling segmentation/embedding with
incremental clustering, but its Python stack is not a drop-in static browser
library. Larger streaming models likewise need separate mobile benchmarks.

Sources: [Web Speech timing proposal](https://github.com/WebAudio/web-speech-api/blob/main/explainers/speech-recognition-result-timestamps.md),
[Diart implementation](https://github.com/juanmc2005/diart),
[NVIDIA streaming model card](https://huggingface.co/nvidia/diar_streaming_sortformer_4spk-v2).
