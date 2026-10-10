# ADR 0007: Evaluate a shared-sample streaming ASR path

Date: 2026-10-10
Status: Accepted experiment; not a production ASR selection

## Context

Browser SpeechRecognition does not provide reliable per-utterance timing for alignment with captured speaker audio. The available custom sherpa package contains several redundant models totalling 372 MB, but also includes an English 20M streaming Zipformer with quantized encoder, decoder and joiner totalling about 44 MB. Its native result API exposes token timestamps and a segment start offset.

## Decision

Relink the existing sherpa libraries into a private, single-threaded SIMD ASR module without model preloading. Reuse the upstream C-API configuration wrapper for this experiment. Stage only the three quantized English models and token table. Keep these files in ignored `research/private/asr-runtime/`; they are not added to the public site.

Generate a non-personal fixture with Windows' Microsoft Hazel Desktop synthetic voice. Submit the same utterance twice with three-second silence gaps, in 1,600-sample blocks at 16 kHz. Measure initialization, inference time per block, memory, first text after accepted samples, interim updates and endpoint resets in Node and browser workers. Do not log transcript or sample values. Cancel by terminating the browser worker.

Treat `start_time + timestamps[i]` as a point on the recognizer input sample clock. Source inspection confirms that `start_time` is derived from processed feature frames since stream start and that token times are segment-relative. Reject missing, non-monotonic or out-of-range times. Allow only 10 ms rounding slack because both JSON components are serialized to two decimal places. Token points are not word durations or acoustic utterance boundaries: no end timestamp is fabricated.

## Consequences

The experiment demonstrates a viable input-clock API missing from native browser ASR. It does not yet supply microphone capture, resampling continuity, a bounded streaming worker queue, speech boundary detection, speaker changes or confidence calibration. A single synthetic voice repeated twice cannot evaluate diarization or identities.

The first text required 2.7 seconds of supplied input in this test. The repeated utterances also produced different token counts (23 and 31). Investigate startup behaviour and word errors before claiming responsiveness or choosing this model for live use. Faster-than-real-time batch processing on a Windows desktop does not prove acceptable phone latency, memory or battery use.

## Validation

`spike:asr` and `spike:asr-browser` each execute actual inference. Both browser engines also test cancellation and aborted encoder download. Pure tests reject malformed audio/timing and preserve the distinction between token points and spans. See [feasibility](../feasibility.md) for exact results and [research reproduction](../../research/README.md).

Sources: [official model instructions](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html), [Apache-2.0 model card](https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17/blob/d42f2d9f7ca24806fb667456a18a9f1b60f70d16/README.md), [source timing conversion](https://github.com/k2-fsa/sherpa-onnx/blob/9db1af1871ed78cee9357c23898e5a7d8702d21a/sherpa-onnx/csrc/online-recognizer-transducer-impl.h).
