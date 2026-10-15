# ADR 0009: Continuous capture with bounded acknowledgement flow

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-10
Status: Accepted experiment; production ASR unchanged

## Context

ADR 0007 demonstrated ASR timestamps on a supplied sample clock. M3 also needs continuous microphone audio shared with speaker processing. Finite enrolment recording resamples after capture; resampling each small live block independently would not establish continuity.

## Decision

Add `src/audio/streaming.ts` and an AudioWorklet for a context explicitly running at 16 kHz. Require the actual context sample rate to match; let the browser continuously resample its MediaStream source. Each session has an opaque clock ID and each mono frame has an integer starting sample index. Validate the render-frame clock in the worklet and consecutive sample indices at the capture and research-ASR boundaries. Token points remain distinct from acoustic speech boundaries.

Send 1,600-sample frames with at most eight unacknowledged frames plus one partial frame. Return capacity only after the consumer finishes processing. An overrun or missing input ends the session with an error; never silently omit audio. Stop flushes the partial frame and drains processing, bounded by five seconds. Abort, page interruption, microphone mute/end, context suspension and startup/input timeout stop capture and discard unfinished buffers. Late permission grants are stopped. Consumers that transfer buffers to workers must terminate those workers on cancellation.

Exercise the real capture adapter in the development-only `research/live-asr.html`, with the existing ASR worker candidate. The model prepares before the Listen gesture. Recognition stays local, transcript display is temporary and labelled Unknown, and no research assets are added to the deployed app. Speaker windows, turn detection and calibrated identity matching remain subsequent work.

## Consequences

The consumer receives the clock needed by both future ASR and speaker analysis, with bounded queued PCM and explicit failure semantics. The first frame starts at zero; wall-clock time is used only for watchdogs, never audio alignment. Devices unable to create a 16 kHz context receive an unsupported error. Browser resampling latency, phone performance and acoustic timing still require measurements.

## Validation

Five worklet tests cover sample order, variable render quanta, partial-frame flushing, acknowledgement capacity, interruption, invalid input and cancellation. Five capture tests cover orderly drain, discontinuity, late permission, stalled input and drain timeout. The Chromium research smoke test runs a generated phrase through a 48 kHz MediaStream source, the real 16 kHz worklet and real ASR. It also verifies denied/late permission, pagehide and deliberately stalled consumption. Windows WebKit verifies the unsupported fallback; physical microphones were not tested. See [feasibility](../feasibility.md).

Source: [Web Audio specification](https://www.w3.org/TR/webaudio-1.0/), AudioContext options and MediaStreamAudioSourceNode resampling. This defines API behaviour, not verified device support.
