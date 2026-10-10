# ADR 0013: Measure offline speaker turns without enabling live attribution

Date: 2026-10-10
Status: Accepted for research only

## Context

The shared VAD/embedding experiment has exact input coordinates but cannot establish speaker changes or single-speaker intervals. A model with explicit segmentation and overlap output is needed. The existing sherpa checkout provides offline pyannote segmentation plus embedding/clustering; it can reuse the approved English ERes2Net model and native libraries without a new package.

The public sherpa export of pyannote segmentation 3.0 is 1,540,506 bytes, with an MIT licence (Copyright 2022 CNRS). The original model handles ten-second chunks with up to three local speakers and two simultaneous voices. Local labels require reconciliation across windows and are not enrolled identities.

## Decision

Keep a separate, ignored diarization runtime and checksum-pinned model under `research/private/`. Add reproducible Node/browser experiments using Windows-generated Hazel and Zira audio. Test silence, one repeated voice, A/B/A and an overlapping mixture. Use unknown speaker count with the upstream distance threshold 0.5, explicitly uncalibrated. Do not force the expected answer with a known cluster count.

Bound each input to thirty seconds. Preserve native anonymous IDs, overlapping spans and input-relative seconds; reject invalid results, release handles/results, and erase accessible PCM allocations. Cluster IDs are scoped to each independent call. Run browser inference in a separate worker, terminated on cancellation, interruption, timeout or completion. No microphone, saved profile, identity decisions or public deployment assets are added.

## Consequences

The model finds two speakers in the alternating fixture, but assigns 1.097 seconds of A's first clip to B's dominant cluster. It also detects overlap but assigns B's subsequent solo speech to A's earlier cluster. A correct speaker count does not establish correct attribution. The known playback intervals contain pauses and are not a hand-annotated speech reference; no human diarization error rate is claimed.

Approximately 24 seconds of speech input takes 9–11 seconds on the tested desktop engines. This batch operation cannot share the sequential live-capture acknowledgement path. Even in a separate worker, rolling context, delayed revisions, global label reconciliation, overlap handling and physical-device performance remain unresolved. Production captions therefore remain Unknown.

## Validation

Native and browser results, model/runtime hashes and exact timing are in [feasibility](../feasibility.md). Regression tests cover invalid input/output, overlapping and sparse IDs, allocation cleanup and overlap-duration accounting. Browser tests run inference and check cancellation during native processing, pagehide and a failed model download. Reproduction steps are in [research instructions](../../research/README.md).

Sources: [pinned public export](https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/tree/9403a6902bb58e3d5ae8c7e77c3422de279db2e0), [included MIT licence](https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/blob/9403a6902bb58e3d5ae8c7e77c3422de279db2e0/LICENSE), [original model card](https://huggingface.co/pyannote/segmentation-3.0), [native API and ABI](https://github.com/k2-fsa/sherpa-onnx/blob/9db1af1871ed78cee9357c23898e5a7d8702d21a/sherpa-onnx/c-api/c-api.h).
