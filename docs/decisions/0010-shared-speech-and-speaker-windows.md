# ADR 0010: Speech regions and bounded speaker windows on the ASR clock

Speaker/two-pane scope superseded by [ADR 0046](0046-live-transcription-only-mvp.md); non-speaker decisions and historical evidence remain.

Date: 2026-10-10
Status: Accepted experiment; no production diarization or identity selection

The native-state continuation after forced Flush described below is superseded by [ADR 0012](0012-vad-window-reset.md), following a longer-stream failure. Other decisions remain in effect.

## Context

The continuous capture adapter supplies ordered 16 kHz samples. M3 still needs speech boundaries and speaker evidence from those exact samples. Browser ASR timing cannot supply this association. The existing sherpa checkout contains a small Silero VAD export and the already evaluated English embedding model.

## Decision

Relink a private `pipeline` WASM runtime exposing ASR, VAD and speaker embedding APIs in one instance. Feed the same captured frames to ASR, a 512-sample VAD adapter and a bounded PCM history. Evaluate the existing Silero 16 kHz model with threshold 0.5, minimum speech 0.25 seconds and minimum silence 0.5 seconds. These are experiment settings, not calibrated speaker thresholds.

Drain detected regions promptly and force a VAD flush every 10.24 seconds. Native `max_speech_duration` changes thresholds and is not a hard memory bound. Keep the detector clock continuous; mark forced cuts `window-limit`, ordinary detector endings `detector`, and Stop flushes `end-of-input`. Do not pad the last partial VAD window: up to 511 samples remain unclassified at Stop.

Compute embeddings from exact three-second history windows, at most once every 1.5 seconds, and only when the detector currently reports speech. This gate saves work; it does not establish that the entire window contains speech or a single speaker. Store only bounded PCM in memory and erase returned region/window arrays and embedding values after processing. Do not compare these uncalibrated outputs to enrolled identities or claim speech regions are speaker turns.

## Consequences

The runtime now exercises concurrent model residency and interleaved processing from a common sample clock. Initial whole-region embedding took about 0.9 seconds per ten-second region, exceeding capture's 0.8-second acknowledgement budget; fixed windows reduced observed worst steps to about 0.31 seconds in Node and 0.38 seconds in Chromium. Phone throughput remains unverified, and the capture adapter still stops on overrun.

The pipeline remains in development research and is not added to the published model download. It produces Unknown text plus timing/count reports. Actual speaker-change detection, overlap handling, held-out identity calibration and physical-device acceptance are still required. Three-second windows can straddle voices and silence; exact sample coordinates alone cannot validate an identity assignment.

## Validation

Native inference tests cover silence, two separated generated phrases and a 24-second repeated speech fragment. Every returned region and embedding window is compared byte-for-byte in float representation to its declared slice of the original input. Unit tests cover ring wraparound, erasure, VAD chunk framing, forced cuts and incomplete final input. A Chromium capture test exercises all three models plus permission/cancellation/interruption/overrun cleanup. See [feasibility](../feasibility.md) for versions, hashes and measurements.

Sources: [sherpa Silero model documentation](https://k2-fsa.github.io/sherpa/onnx/vad/silero-vad.html), [Silero MIT licence](https://github.com/snakers4/silero-vad/blob/master/LICENSE), [native detector implementation](https://github.com/k2-fsa/sherpa-onnx/blob/9db1af1871ed78cee9357c23898e5a7d8702d21a/sherpa-onnx/csrc/voice-activity-detector.cc).
