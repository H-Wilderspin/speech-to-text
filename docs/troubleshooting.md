# Troubleshooting

## 2026-10-12 - CI clock interruption recurred during console-format update (Unresolved)

- **Evidence:** `7a55792`, run `38289809827`, first attempt: 55/56 browser cases
  passed. Chromium's paced local capture reported "The audio clock was interrupted"
  and released the generated microphone; one live caption remained and no assigned
  label rendered. The production clock-continuity guard fired again; the underlying
  cause remains unknown. All other cases, including Linux WebKit audio, passed.
- **Action:** one unchanged rerun, retaining every assertion and the continuity
  guard. This repeats the previously documented failure from run `38270736803`.
  It is separate from the user's one-reference/0.59 trace, which drained successfully.
- **Retry outcome:** the unchanged second attempt passed the full workflow and
  deployed. This confirms non-recurrence on that retry, not a resolved clock cause.
- **Prevention/next:** retain failure evidence and investigate render-clock jumps
  independently if they recur; passing retries must not be reported as a clock fix.

## 2026-10-12 - One profile, zero matches and a short phrase (partially diagnosed)

- **Evidence:** after the user removed a duplicate recording of their own voice,
  the new trace reports one reference, three checked windows and zero matches.
  Settings reports zero ambiguous windows, best similarity displayed as 0.59 and
  minimum 0.60. This establishes below-cutoff rejection in this run; the earlier
  duplicate explanation was incomplete. The user confirms it was their own live
  speech: an observed false rejection. The actual acoustic cause is unverified.
- **Processing:** 107,776 captured samples (6.736 seconds at 16 kHz) were processed
  and drained. A sampled frame took 895 ms during the first voice check; the queue
  subsequently caught up. Finish returned in 15 ms. No stall/overflow was reported.
- **Independent limitation:** the displayed utterance contains four words. Current
  correspondence requires six matching words, so even successful voice matching
  alone would not attribute this isolated phrase. Unknown omission works as coded;
  useful short-phrase attribution remains a product limitation, not a completed fix.
- **Logging defect:** copied DevTools object previews omitted later score/ambiguity
  fields behind an ellipsis. Emit one numeric-only JSON string per console line,
  including best/minimum similarity and rejected-window counts. No private speech,
  raw traces, identities or recordings are checked into the repository.
- **Next:** compare complete per-window scores and known same/different-person
  recordings before changing identity acceptance. A single near-cutoff score does
  not establish a safe replacement cutoff. Live words and matching rules are unchanged.

## 2026-10-12 - One assigned statement, no follow-ups (Unresolved)

- **Context:** latest user phone report says one payload had correct words and
  identity, then no follow-up statements appeared. OS/browser versions and whether
  the reference was updated to twenty seconds are unconfirmed.
- **Cause:** not established. Code inspection shows a sequential frame RPC with
  concurrent capture, not a gate that waits for one assigned sentence. Local
  endpoint/evidence, voice matching, cross-recognizer wording and display filtering
  are distinct gates. No phone console trace has yet located the stalled stage.
- **Action:** add opt-in numeric-only console diagnostics at these boundaries,
  including pending requests, queue lag, cumulative progress and current window
  similarity. Keep browser words, clock validation and identity rules unchanged.
- **Verification:** regression coverage exercises queued frames, follow-up local
  sentences and delayed browser statements. Executed results are in feasibility;
  generated speech cannot establish the physical root cause or matching accuracy.
- **Next:** use [the diagnostic procedure](speaker-diagnostics.md) for three varied
  statements and Stop; compare progress before/after the first visible assignment.
- **Related:** [ADR 0030](decisions/0030-speaker-stage-console-diagnostics.md).

## 2026-10-12 — Linux CI audio-clock interruption (Unresolved)

- **Context:** guided registration commit `2082598`, first attempt of
  [run 38270736803](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38270736803).
  Linux CI passed 55/56 tests, including twenty-second registration/update in both
  Chromium and WebKit. Deployment was correctly withheld.
- **Failure:** existing Chromium paced live-attribution test reported
  "The audio clock was interrupted. Browser captions continue." One capture was
  opened and stopped, one browser caption remained, and no estimated name appeared.
- **Evidence:** the worklet rejects discontinuous `currentFrame` progression. This
  establishes its clock guard fired; the underlying scheduler/audio interruption
  cause is unconfirmed. Guided registration does not modify this worklet or test's
  audio source. No physical microphone was involved.
- **Action:** retain the continuity guard and every assertion; rerun the unchanged
  failed CI job to check recurrence. A passing retry would not prove this underlying
  interruption fixed. Record the rerun outcome in feasibility notes.
- **Rerun:** the unchanged second attempt passed all build/browser checks and
  deployed successfully. The interruption did not recur in that run; its cause
  remains unresolved. Production clock validation was not changed or bypassed.

## 2026-10-12 — Voice decisions lost before delayed words (phone issue unresolved)

- **Context:** Pixel 8 user reports perfect live listening, eye on, empty upper
  pane after Stop and "Speech received; no saved voice matched yet." The user
  confirms only their own profile is saved, ruling out competing profiles for
  this run. Versions remain unreported. No private speech/audio was collected.
- **Proven defect:** a unit sequence with accepted matching windows followed by
  empty recognizer hypotheses discards each window at its end sample. Delayed
  token timestamps then find no evidence. A backward token revision can also lose
  an earlier covering window. Neither observation proves the physical root cause.
- **Correction:** retain 30 seconds of window decisions as well as pending-word
  coverage. Keep the same voice threshold and two-window agreement. Settings now
  reports matched/total/ambiguous windows, best similarity and word evidence stage;
  the previous message conflated all local attribution failures.
- **Interpretation:** zero matches with low best similarity means threshold
  rejection; ambiguous windows mean multiple saved profiles pass; accepted windows
  with insufficient word evidence mean timing/coverage/consistency has failed.
  Tokenizer mismatch is reported separately. A best score is not a probability.
- **Verification:** the late-first-token regression failed before the correction;
  all 201 unit tests, typecheck, lint, asset checks and build pass afterward.
  Real-worker/browser and publication results are recorded in feasibility notes.
- **Next:** physical retest. If still empty, report the new Settings status after
  Stop and the number of saved profiles, including duplicates. Do not tune the
  identity threshold or automatically name a lone profile from this symptom.
- **Related:** [ADR 0028](decisions/0028-retain-delayed-voice-evidence.md).

## 2026-10-12 — Empty Who said what (phone resolution unconfirmed)

- **Report:** the user sees no upper-pane text during listening or after Stop and no preparation/error message. Device remains presumed Pixel 8; no new browser version, recording or diagnostic trace supplied.
- **Reproduced gates:** `reconcileAndroidResults` intentionally keeps native-cycle text provisional; the old `delayedNames` and `assignedSegments` each rejected it even with final matching local evidence. Also, six contiguous matching words failed on a single recognition difference in a seven-word phrase. These limitations are proven by deterministic fixtures; neither alone proves the full cause of the user's after-Stop failure.
- **Change:** separate final speaker evidence from browser finality, replace matched provisional slices in place, and allow six uniquely agreeing words across at most one differing word, with a consistent final local identity. Never label unmatched words or change browser wording. Settings now reports no local recognized words, no voice match, a voice match without phrase correspondence, or matching names.
- **Verification:** new unit fixtures cover corrections, ambiguity, speaker boundaries and unchanged live text. The generated AudioWorklet integration simulates Android and requires upper names before native end/Stop, then exercises activity off/on without restarting capture. Executed results are in feasibility.
- **Unresolved:** physical dual capture, human voice matching, short/repeated/differing recognitions and the exact phone failure. Retest the deployed app; if empty after Stop, request the short Settings matching status, not private audio or transcript text. See ADR 0027.

## 2026-10-12 — Preparation-only browser tests and Windows WebKit audio support

- **Context:** Windows Playwright WebKit 27.2, automatic names preparation test.
- **Symptoms:** the first browser run timed out clicking the disabled Prepare voice model button.
- **Root cause:** the test reached enrolment through its real capability guard; this Windows WebKit build lacks the required audio APIs. Model inference itself does not need a microphone.
- **Solution:** reuse the preparation-only capability fixture from the direct-worker test. It advertises the required APIs but throws immediately if any audio constructor or getUserMedia is called. Model downloads, workers, cache, profile storage and retry remain real. Do not bypass this guard in production or report a microphone pass from the fixture.
- **Follow-up:** WebKit then reached Ready instead of Retry: page-level routing did not inject the expected failure after the reload under service-worker control. Inject rejection of the one targeted model fetch at the page fetch boundary instead; assert that the rejection actually occurred, disable it and retry the real download. This is a deterministic recovery fixture, not evidence about physical network failures.
- **Verification:** the original failure log identifies the disabled button. Focused rerun results are in feasibility; Linux CI continues to run all real generated-capture integration tests.
- **Related:** ADR 0026, `tests/local-listening.spec.ts`.

## 2026-10-11 — Local upgrade still transcribes poorly (phone retest pending)

- **Evidence:** the user reports that transcription remains inaccurate after the upgraded model. Generated/public test clips did not predict their conversational result. No device audio was collected; a specific acoustic/model cause is unproven.
- **Change:** browser captions now supply all displayed words. Delayed local estimates may add names only through unique matching phrases; they cannot overwrite spelling, casing, punctuation or corrections. Local processing failure leaves transcription running. Old local-only preferences are not reused for the new provider-processing mode; enable delayed estimates explicitly in Settings, reusing cached assets.
- **Verification:** new unit tests exercise text preservation, ambiguous/reordered evidence, failure isolation, Stop and session boundaries. The integration uses generated audio plus simulated browser results; it cannot prove physical dual-microphone support or browser-service accuracy. Counts/publication evidence are in feasibility.
- **Unresolved:** real conversational recognition, matching accuracy, phone microphone coexistence and resource cost. If enabling names affects capture, turn them off to remove local capture while keeping browser transcription. No reliable full diarization is claimed.

## 2026-10-11 — Intermittent larger-model live test failure on CI (Unresolved)

- **Observed:** first upgrade run [38133551744](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38133551744) passed 49/50 tests. Chromium paced capture timed out waiting for an estimated name; WebKit paced capture and both direct-worker known/other comparisons passed. The failure log omitted the app status, so overload versus failed matching cannot be concluded from this run.
- **Investigation:** model preparation and accelerated inference can run concurrently with paced capture under the two-worker configuration. Resource contention is a hypothesis, not a proven production bug. Run all CI browser checks with one worker to isolate the real-time experiment; keep the production queue bound, timeout, required label and Stop assertions unchanged. Add status/caption-count/microphone diagnostics to the failed assertion without printing speech or vectors.
- **Follow-up:** the first serial run [38133975638](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38133975638) also failed that label check (49/50 passed), so parallel-test contention alone is not established. `toMatchObject` printed only the failed field; diagnostics now explicitly print the safe status/count/track summary on failure. The next run [38134351664](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38134351664) passed all 50 tests without a production-code change. This intermittent failure is unexplained, not fixed by the diagnostic change. Keep the assertion and investigate the status if it recurs.
- **Local Linux check:** the real paced Chromium workflow passed in the official `mcr.microsoft.com/playwright:v1.64.0-noble` container (digest `sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f`). The repository mount was read-only; copied build/tests and Linux dependencies lived in the disposable container. Initial npm installation failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`; supplying exported public Windows trusted-root certificates through container-only `NODE_EXTRA_CA_CERTS` allowed installation without disabling TLS checks. No private keys were exported or committed.
- **Limit:** a serial pass establishes this isolated workload only; it does not prove phone throughput or eliminate the need to investigate recurrence.

## 2026-10-11 — Large model push reset during upload

- **Symptom:** the first push of the 190 MB ASR upgrade failed with curl 55 / connection reset, including a buffered HTTP/1.1 retry. `ls-remote` confirmed main had not advanced despite Git printing “Everything up-to-date”. The connection's underlying failure was not isolated.
- **Recovery:** create a temporary asset-only branch using a separate Git index; upload the first two 64 MiB encoder parts in separate commits/pushes, then push the original complete app commit to main. The smaller uploads and final push succeeded. Remove the temporary branch after confirming main contains the complete change. No main history rewrite or Git LFS pointer was introduced.
- **Verification:** remote main advanced to `96692b8` and its Actions run started. GitHub warned about files over its recommended 50 MB size but accepted them below the enforced per-file limit. This is one successful workaround, not proof of the network root cause; verify the actual remote ref after ambiguous push output.

## 2026-10-11 — All-caps and inaccurate local captions (phone retest pending)

- **Context:** optional local name mode; user confirms clear speech with people taking turns. The recognizer emits raw uppercase words; the previous renderer showed them unchanged. Desktop fixtures also reproduce omissions with the original 20M model. The exact contribution of that model versus phone acoustics to the user's wrong words is unmeasured.
- **Correction:** upgrade the local speech recognizer and apply sentence casing after token/identity grouping. Existing voiceprints are reused. Uppercase source text contains no trustworthy proper-noun casing or punctuation to restore; the formatter does not invent them. Turn off experimental names for browser captions if local recognition remains poor.
- **Rejected change:** four-path beam decoding on the small model improved clip accuracy but lost `COMMAND` in the spoken Stop fixture. Other beam widths and the FP32 decoder did not provide a satisfactory fix. Keep the real command regression; do not accept a near-match command to hide recognition errors.
- **Verification:** the larger model reduces generated/public example word edits and passes actual worker/capture Stop tests. Unit tests preserve speaker metadata and words through casing. Browser tests verify no silent upgrade download and reuse of cached shared files; full counts and deployment results are in feasibility.
- **Upgrade recovery:** Settings → Prepare name suggestions downloads about 190 MB once. Existing runtime and voice files are reused; completed downloads survive cancellation/retry. Missing upgraded weights produce an explicit preparation message without requesting the microphone. More processing/memory is required; phone throughput and conversational accuracy remain unresolved until retested.
- **Related:** [ADR 0022](decisions/0022-upgrade-local-transcription.md), [reproduction](../research/README.md), [asset provenance](local-speech-assets.md).

## 2026-10-11 — Saved voiceprints still show Unknown

- **Context:** user-reported Pixel 8, OS/browser versions unknown; one saved speaker, no other consenting participant available. Opening-word loss is now reported resolved.
- **Root cause:** the production browser adapter never compared live audio with stored profiles and lacks usable sample-clock alignment. This report was not evidence of a rejected similarity score. Separately, the first new local integration reproduced all-Unknown output because its word parser expected `▁` while the real sherpa API emitted spaces; the exact-text guard correctly refused malformed attribution.
- **Solution:** after explicit user authorization, add opt-in English local name suggestions using common-clock ASR and reference windows. Recognize both tokenizer boundary forms, preserve words, and mark names `(estimate)`. Enrolment alone does not select this mode: prepare/enable it in Settings. Cached models are reused. Browser captions stay anonymous.
- **Verification:** Chromium generated-audio integration passes known/other voice, coloured captions, no repeated sentence, offline model reuse, paced capture, command/button Stop and second-session reset. Unit tests cover ambiguity, window agreement, word integrity, lifecycle failures and erased temporary vectors. Full suite/deployment results are recorded in feasibility.
- **Unresolved:** human accuracy, especially overlap/short turns, physical Pixel throughput and iPhone capture. An estimate is not confirmed identity; Unknown can still be appropriate. Turn off experimental names for browser captions if local processing cannot keep up.
- **Related:** [ADR 0021](decisions/0021-experimental-local-name-suggestions.md), [manual protocol](manual-testing.md), [local asset manifest](../local-assets.json).

## 2026-10-11 — Continuous-mode Android repeated-line regression (phone retest pending)

- **Report:** the user reports the latest pause update is "back to spamming out the same line over and over". This fails the physical retest; the earlier generic desktop result simulation was insufficient.
- **Reproduction:** Android-shaped final-marked slots containing equal copies, a strict extension and a spelling revision produce extra rows with the generic prefix/group logic. Chromium's Android continuous bridge promotes partial callbacks to final; see ADR 0020 for primary implementation references. Exact phone event payloads remain uncollected.
- **Correction:** Android Chromium uses one provisional current slot, replaced by the latest native hypothesis and committed once on normal native end. No confidence cutoff or blanket transcript-wide duplicate deletion. Previous completed cycles and deliberate in-phrase repetition remain. Error/interruption/timeout cannot confirm a partial.
- **Checks:** `npm run check` passed typecheck/lint, 151 unit tests, model-asset hashes and production build. Android-specific browser regressions exercise composition via an injected UA, not a real phone engine. Browser/deployment results are recorded in feasibility.
- **Limit:** the compatibility path assumes cumulative hypotheses within each native cycle. Multi-sentence physical testing and capture across pauses remain pending. Voice Stop waits for provider completion. The missing live-speaker feature is unaffected.

## 2026-10-11 — Sentence openings lost after pauses (physical retest pending)

- **Context/symptom:** user confirms opening-word loss after pauses, presumed same Pixel 8; OS/browser versions remain unknown.
- **Diagnosis:** the previous adapter sets `continuous=false` and schedules a restart at least 200 ms after native end. That application-created gap is proven by code and regression fixtures. It is the leading explanation, not a captured trace of the phone's acoustic loss.
- **Change:** continuous native recognition; productive native endings restart on the next task without the extra 200 ms. Speech-start groups constrain cumulative-prefix collapse so separate prefix-extending sentences survive. Empty-cycle backoff and all Stop/interruption cleanup remain.
- **Verification:** `npm run check` passed 136 tests plus typecheck/lint/asset checks/build. Windows Chromium/WebKit browser suite passed 36 tests with four existing unavailable-WebAudio skips. The new simulated 15-second pause/second-sentence/voice-Stop regression passed in both. Sandbox Vite preview again required the previously documented outside-sandbox run.
- **Unresolved:** physical Pixel 8 pause retest; browsers may still terminate native capture. No audio buffering is claimed. Live Unknown labels are also unresolved: production recognition never reads saved profiles, and ADR 0017's prototype is not ready for reliable human attribution.
- **Prevention/related:** browser and reconciliation regression tests; ADR 0019; manual-testing pause trials. Do not treat the automated recognizer simulation as a physical-device pass.

## 2026-10-10 — Publishing selected the wrong GitHub account

- **Symptom:** `git push origin main` returned HTTP 403, denied to `labiraus`, for `H-Wilderspin/speech-to-text`.
- **Verified state:** Git Credential Manager lists only `labiraus`; an explicit `credential.username=H-Wilderspin` noninteractive push found no saved credentials. No token values were printed or stored.
- **Resolved sign-in:** the user requested another login and `git credential-manager github login --username H-Wilderspin --browser` completed. GCM then listed both accounts. Use the owner's account explicitly for this repository; do not silently change its remote.
- **Publication verified:** configured the repository-local GitHub username as `H-Wilderspin`, pushed successfully, and [Actions run 38125696202](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38125696202) deployed `bc8991b` after all 38 Linux browser tests passed. Global credentials and other repository remotes were not changed.

## 2026-10-11 — WebKit lost model files after worker disposal

- **Context:** Windows WebKit 27.2, no Web Audio dependency. A new test prepares the actual model and closes its worker before an offline retry.
- **Observed:** CacheStorage writes resolved and immediate worker reads succeeded, but the named cache was empty after worker termination. Retaining network responses and avoiding concurrent cache creation did not fix it. The underlying WebKit cause was not established.
- **Verified fix:** move public asset download/hash/cache work into the page and transfer verified buffers to the worker. Chromium and WebKit now pass UI preparation, dialog disposal, offline reload, automatic preparation and real inference with exactly three initial model requests and no further requests.
- **Prevention:** `tests/model-cache.spec.ts` runs on both engines even where microphone capture is unsupported. Cancellation tests ensure aborted preparation cannot create a late worker and does not prevent an immediate retry. See [ADR 0018](decisions/0018-page-owned-public-model-cache.md).

## 2026-10-10 — Repeated model preparation and lost return focus

- **Cause:** disposable dialog workers only tracked readiness in memory; no persistent complete-model detection existed. Automatic cache restore then exposed a second bug: the comparison launch button lost restored focus when preparation disabled it.
- **Fix:** versioned CacheStorage for verified public model/runtime files; cache-only automatic restore on both screens, explicit network repair, and cancellation guards. Allow the comparison navigation button during model checking/preparation; navigating cancels that worker safely.
- **Verification:** Chromium completed real enrolment, offline reload and comparison with no additional model requests. The focused-button regression initially failed and passed after the fix. All 32 available Windows browser checks passed; four WebKit audio checks remain unsupported. Cache corruption, quota, absence and delayed cancellation have unit coverage.
- **Related:** [ADR 0016](decisions/0016-reuse-cached-voice-model.md). Browser cache eviction remains a legitimate reason to download missing files again.

## 2026-10-10 — Live attribution: progress and remaining overlap failure

- **Context:** local shared-clock ASR plus English embeddings; generated Hazel/Zira reference, calibration and held-out passages. No user recordings or stored profiles are used.
- **Finding:** the instantaneous VAD gate skipped embedding windows that still contained speech. Optional whole-window energy gating restored coverage. Direct enrolled-reference matching bypasses the previously failed cluster assignments: A/B/A now names 81/93 token points with 12 Unknown in the fixture, versus 10/93 previously.
- **Unresolved:** energy and agreeing embeddings do not prove one speaker. Unequal overlap still produces solo labels at eight mixed token points; the existing segmentation candidate also misses that quiet voice. Five-second segmentation output fails existing time-bound validation, so the ten-second model cannot simply be shortened.
- **Next:** follow [ADR 0017](decisions/0017-direct-live-attribution-prototype.md). Do not map browser result arrival time to microphone windows, copy synthetic thresholds into production, or describe playback schedules as annotated word truth.

## 2026-10-10 — Growing repeated captions (user-reported Pixel 8 fix)

- **Context/symptom:** the user reports that captions repeat the phrase with each new word. Android/browser versions and native event payload remain unknown.
- **Cause:** unconfirmed on the device. A fixture containing successive cumulative final slots reproduces the visual failure in the old reconciliation logic; it rendered every slot as an independent paragraph. This is a candidate explanation, not evidence of the phone's exact event sequence.
- **Change:** single-utterance native recognition with automatic application restart, plus strict cumulative-prefix normalization within each native utterance. Independent repeated utterances remain intact. See [ADR 0014](decisions/0014-persistent-listening-and-voice-stop.md).
- **Verification:** regression unit tests and Chromium/WebKit app tests show only the growing phrase once. All 112 unit tests and 30 available local browser tests passed; four existing Windows WebKit audio cases skipped. After deployment, the user reported “command stop worked and the text only writes once” on Pixel 8. This verifies the reported symptom's resolution in their test, without establishing the exact native event cause or broader browser behaviour.
- **Prevention:** preserve raw final slots for interrupted interim recovery, scope normalization to one native utterance, and retain fixtures for both provider-like cumulative output and intentional repetitions. No personal transcript or audio is logged.

## 2026-10-10 — Windows sandbox blocks build-tool configuration

- **Context:** Node 22.20.0, Vite 7.3.7/Vitest 3.2.7, restricted Windows workspace.
- **Symptoms:** npm could not write its user cache (`EPERM`). After dependencies installed, esbuild reported `Cannot read directory "../..": Access is denied` while loading `vite.config.ts`.
- **Root cause:** filesystem permissions outside the workspace, confirmed by successful execution of the same commands with approved permissions.
- **Solution:** approve `npm install` and `npm run check` outside the restricted sandbox when requested. No app/config workaround or disabled security setting is needed.
- **Verification:** install succeeded; typecheck, lint, 32 unit tests and production build passed under approved execution.
- **Prevention:** distinguish build-tool access errors from application defects; retain the lockfile and documented Node version.

## 2026-10-10 — Generated offline worker missed shell assets

- **Context:** custom Vite `generateBundle` hook.
- **Symptoms:** initial `dist/sw.js` lacked `index.html`, and a precache marker remained in executable code.
- **Root cause:** Vite emits HTML after this hook; first-occurrence string replacement replaced a marker in an ESLint comment instead of the declaration.
- **Solution:** explicitly enumerate `index.html`, hash source HTML, use `replaceAll` and remove the duplicate marker comment.
- **Verification:** generated worker contains all explicit assets and no unresolved markers; production browser offline-reload regression tests passed in Chromium and WebKit, at root and a subdirectory.
- **Prevention:** keep the service-worker browser test in `npm run test:e2e`; include HTML and icon changes in the cache version.

## 2026-10-10 — Playwright download certificate chain

- **Context:** Node 22.20.0 on Windows; Playwright 1.64.0 needed browser revisions different from the existing local cache.
- **Symptoms:** browser download failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.
- **Root cause:** Node's default trust configuration could not validate the download certificate chain. The exact certificate issuer was not investigated.
- **Solution:** use the OS certificate store for the installation process, keeping verification enabled. In PowerShell: `$env:NODE_OPTIONS = '--use-system-ca'`, then `npx playwright install chromium webkit`. Preserve existing Node options if your shell already defines them; do not disable TLS verification.
- **Verification:** download succeeded and Chromium/WebKit launched for the 16 passing browser tests.
- **Prevention:** install the browsers matching the pinned Playwright version; use `--use-system-ca` on managed Windows machines when their trusted certificates are needed.

## 2026-10-10 — Chromium opened a blank shell offline

- **Context:** Chromium 156, Vite preview, service-worker precache.
- **Symptoms:** cached HTML loaded but JS/CSS requests fell through to the disconnected network; WebKit passed the same scenario.
- **Root cause:** trace showed module requests with an Origin header and host responses with `Vary: Origin`. Precache request headers differed, so header-sensitive cache matching missed the enumerated public files.
- **Solution:** match the exact allowlisted URL with `ignoreVary: true`. This is only valid because these are public, invariant build assets; dynamic or personalized requests are never intercepted/cached.
- **Verification:** root and subdirectory offline reloads passed in Chromium and WebKit.
- **Prevention:** preserve the cross-browser offline regression and the strict request allowlist.

## 2026-10-10 — WebKit did not restore dialog trigger focus

- **Context:** desktop WebKit 27.2 with iPhone emulation.
- **Symptoms:** after tapping Speakers and pressing Escape, focus did not return to the trigger.
- **Root cause:** relying on native dialog focus restoration was insufficient when the tapped trigger was not the previously focused element in this browser.
- **Solution:** hold the trigger ref and explicitly focus it in the dialog close callback.
- **Verification:** focus entry, Escape closing and trigger restoration passed in both tested engines.
- **Prevention:** retain dialog focus assertions; still verify VoiceOver on a physical iPhone.

## 2026-10-10 — Speaker experiment failed before browser inference

- **Context:** research runtime initially emitted as CommonJS/UMD and loaded through a classic worker on Vite's development server.
- **Symptoms:** Node inference succeeded but the browser worker failed before reporting model inference; the UI recovered with a worker-load error.
- **Root cause:** the initial classic-worker loading arrangement was incompatible with the development module pipeline. The exact generated statement was not isolated, so a narrower syntax diagnosis is not claimed.
- **Solution:** emit native Emscripten ES-module output (`-sEXPORT_ES6=1`, `.mjs`), import it from a module worker, and reuse that module in Node. No eval or global `importScripts` bridge.
- **Verification:** the final Node module and both browser workers produced three valid embeddings each; browser cancellation and aborted model requests recovered successfully.
- **Prevention:** keep the research browser smoke runner alongside the Node check. Do not assume a Node-only inference pass proves browser loading compatibility.

## 2026-10-10 — Windows WebKit has no Web Audio capture APIs

- **Context:** Playwright 1.64.0, desktop WebKit 27.2 on Windows, secure localhost; iPhone viewport does not change the engine's compiled capabilities.
- **Symptoms:** full enrolment tests could not press Prepare because the application correctly reported local recording unsupported. The initial synthetic microphone fixture also failed to install.
- **Root cause:** direct page inspection returned `undefined` for `navigator.mediaDevices`, `AudioContext`, `AudioWorkletNode` and `OfflineAudioContext`, with `isSecureContext === true`. This is a test-runtime capability limit, not evidence about physical iPhone Safari.
- **Solution:** keep the product's feature-detected fallback. The fixture explicitly skips the four audio-dependent tests only for this Windows/WebKit configuration after checking capability. Other platforms must satisfy the APIs to run those tests. Continue testing profile deletion, unavailable storage, accessibility and anonymous flows in both engines.
- **Verification:** Chromium completed real AudioWorklet/resampling/WASM/IndexedDB enrolment. WebKit exercised the unsupported-recording message and disabled Prepare control; physical Safari capture remains pending.
- **Prevention:** do not present desktop WebKit viewport emulation as iOS microphone coverage. Keep skip reasons and device gates visible in reports.

## 2026-10-10 — Streaming recognizer initialization returned null

- **Context:** isolated English Zipformer WASM experiment, sherpa source `9db1af1871ed78cee9357c23898e5a7d8702d21a`.
- **Symptoms:** valid model files were staged but recognizer creation returned null before audio input.
- **Root cause:** explicitly setting `modelingUnit: 'bpe'` triggers a requirement for a SentencePiece vocabulary file in `OnlineModelConfig::Validate`, even with hotwords unused. This parameter is used for hotword encoding; the recognizer still decodes the supplied BPE token table without it. WASM validation logs go to stdout, not just stderr, which initially hid the diagnostic.
- **Solution:** retain the upstream no-hotword default `modelingUnit: 'cjkchar'`; collect stdout/stderr only during initialization and disable diagnostic collection before audio input.
- **Verification:** Node, Chromium and WebKit produced timestamped utterances across endpoint reset using the staged quantized models.
- **Prevention:** consult the wrapper and native configuration validation together; model family and optional hotword configuration have distinct meanings.

## 2026-10-10 — Whole-region speaker inference exceeded the live queue budget

- **Context:** shared single-threaded WASM ASR/VAD/English embedding experiment on Windows, Node 22.20.0. Capture permits eight unacknowledged 100 ms frames.
- **Symptoms:** a ten-second generated speech region took 909 ms to embed, producing a 911 ms processing step. A live producer cannot safely wait this long with its current queue budget.
- **Root cause:** embedding cost grows with input duration; delaying all work until a long speech region ends creates a processing burst. Separately, native VAD's maximum-duration setting only adjusts thresholds and cannot guarantee a hard region-storage limit.
- **Solution:** keep a three-second PCM ring and compute bounded windows at most every 1.5 seconds when current VAD state reports speech. Force marked VAD window cuts every 10.24 seconds without resetting the sample clock. These cuts and windows do not prove a speaker turn.
- **Verification:** Node maximum processing steps fell below 310 ms in these fixtures; Chromium's complete capture/pipeline run peaked at 381 ms without queue overrun. Forced-cut and sample-window tests verify continuity and exact sample values. Physical-phone throughput is unverified.
- **Prevention:** benchmark worst processing bursts and simultaneous model memory, not only average real-time factor. Preserve the explicit overrun stop and Unknown labels until turn/identity evidence exists. Related: ADR 0010.

## 2026-10-10 — VAD failed after two minutes of repeated speech

- **Context:** combined WASM pipeline, Node 22.20.0/Windows, generated speech with three-second gaps, forced 10.24-second VAD cuts.
- **Symptoms:** `spike:pipeline-stress -- 3` reproducibly rejected a zero-length region at sample 1,966,080 after processing 1,969,152 samples (123.072 seconds). The short 24-second continuous fixture passed.
- **Root cause:** using native Flush midstream without resetting. Flush is documented for final input; outer region state was cleared while Silero's pending-silence state survived. Source inspection explains the empty sample range after continuing input.
- **Solution:** flush/drain, reset native VAD, and add the analysis-window starting offset to subsequent native indices. Keep capture/ASR clocks continuous and reject malformed spans. This changes the implementation detail in ADR 0010; see ADR 0012.
- **Verification:** the formerly failing three-minute input completed with exact sample-slice and monotonically increasing ASR-final checks. The unit fixture now refuses continuation after Flush without Reset and verifies global indices across resets. Longer-run results are in feasibility.
- **Prevention:** test repeated silence transitions across many window cuts, and distinguish end-of-stream APIs from streaming operations. Mapping indices correctly does not establish speech-boundary accuracy near a reset.

## 2026-10-10 — Correct cluster count with incorrect speaker assignments (Unresolved)

- **Context:** offline pyannote 3.0 int8 segmentation plus English ERes2Net, sherpa source `9db1af1`, Windows Node 22.20.0 / Chromium 156 / WebKit 27.2; default unknown-count clustering distance 0.5.
- **Symptoms:** generated A/B/A reports two speakers but splits A's first solo clip between both clusters. A/B overlap reports two simultaneous clusters and then reuses A's earlier cluster for B's solo speech.
- **Cause:** the output is demonstrably inconsistent with the exact generated playback schedule. The relative contribution of segmentation, embedding extraction and clustering has not been isolated; do not attribute this to a particular model component yet.
- **Containment:** keep the candidate outside live captions. Preserve clusters as per-call anonymous metadata. Do not force two clusters, tune identity thresholds on these two voices, or treat a correct count as successful attribution.
- **Verification:** `npm run spike:diarization` and `npm run spike:diarization-browser` reproduce identical segment/cluster output in all three engines. Browser worker termination keeps cancellation responsive during expensive inference.
- **Next:** isolate local segmentation from cross-window clustering, evaluate conservative overlap exclusion and use consented held-out human data before enabling identification. Native `NumSpeakers()` counts distinct IDs rather than promising dense numbering; the adapter preserves sparse IDs and has a regression test.
- **Follow-up:** `spike:diarization -- --local-windows` now isolates the native ten-second path, which bypasses embedding/clustering. All four alternating-voice windows return one local label. Incorrect merging therefore already exists in local segmentation for these synthetic voices; cross-window clustering is not the only issue. The overlap window similarly reuses one label for both voices' solo speech. The result remains unresolved for human speech; obtain consented held-out evidence rather than treating lower latency as successful diarization.
- **Related:** [ADR 0013](decisions/0013-offline-diarization-candidate.md), [measurements](feasibility.md).

## 2026-10-10 — Worker-download failure simulation bypassed in Linux WebKit

- **Context:** first GitHub Actions Linux run, WebKit 27.2, real local enrolment worker. Windows WebKit cannot run this audio-dependent test and had skipped it locally.
- **Symptoms:** `page.route` was set to abort `embedding.onnx`, but preparation reached Ready instead of the expected download error. The other 31 browser tests passed; deployment correctly stopped.
- **Cause:** the page-level interception did not make the dedicated worker's model fetch fail in this environment. The exact WebKit routing mechanism was not isolated; this was a failed fault injection rather than evidence that the app ignored a failed download.
- **Solution:** the test now serves the real production app through a temporary loopback HTTP server, returning HTTP 503 for the model file. It asserts that the server actually received and rejected the model request, checks the app's error/retry state and verifies no microphone was requested. The production worker, model checksums and error handling are unchanged.
- **Verification:** focused Chromium regression and all 87 unit tests/typecheck/lint/build passed locally. The next Linux run passed this test, including WebKit. That run exposed a separate intermittent comparison timeout; its assertion now reports the actual comparison status for diagnosis, rather than only a missing success element.
- **Prevention:** verify a simulated fault actually occurs; use a real server response when browser interception cannot cover worker traffic. Do not skip the model failure check to publish. [First failure](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38051147409), [follow-up run](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38051447339).

## 2026-10-10 — Linux WebKit synthetic microphone sometimes records silence

**Follow-up:** the same too-quiet comparison recurred in the [layout deployment](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38055482454) at commit `23b61f0`; 35 browser tests passed and one failed. The silent-output connection described below did not eliminate the intermittent synthetic-source problem. Production recording correctly rejected the input, and publication was blocked. One unchanged retry also failed, this time awaiting the first saved profile; that assertion did not expose the recording status, so the second failure's exact cause is unconfirmed.

**Revised fixture:** synthesize the 173 Hz tone in the application's recording AudioContext when it asks for the fixture's media source. Keep real MediaStream tracks for permission/cancellation cleanup, real AudioWorklet collection, resampling, quality checks, WASM inference and IndexedDB. The test now explicitly replaces both getUserMedia and the synthetic stream's MediaStreamAudioSourceNode, avoiding cross-context OS audio routing. It does not establish correctness of a real microphone source node; physical tests remain required. An enrolment status assertion now exposes errors directly. Production recording thresholds and capture code are unchanged. Verification of this replacement is tracked in feasibility notes.

**Replacement verification:** all eight local Chromium speaker tests and all 36 Linux Chromium/WebKit tests passed with the revised fixture at `bd7154d` ([successful workflow](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38056062154)). The layout then deployed and passed published-site checks. This verifies the replacement in those runs, without claiming that the earlier native cross-context routing issue was repaired.

- **Context:** full Linux CI suite; the test creates an oscillator feeding a MediaStream destination, consumed by the application's separate recording AudioContext.
- **Symptoms:** enrolment succeeded but the later comparison sometimes failed. An assertion on the actual status revealed `The recording was too quiet. Move closer and try again.` The app correctly rejected the silent input rather than producing a voiceprint. An initial diagnostic selector also matched the similarity `<output>`'s implicit status role; it now explicitly selects the status paragraph.
- **Cause:** silence was observed in this generated cross-context test path. An idling source graph with no connection to its own output destination was the working hypothesis; physical microphone behaviour was not implicated or tested by this result.
- **Solution:** also connect the generated signal through a zero-gain node to the source context's destination, keeping the source graph rendering without playing a tone. Closing the synthetic track still closes that context. Do not reduce the app's quality threshold or skip the comparison.
- **Verification:** local checks and both affected Chromium tests passed (Windows WebKit audio remains unavailable). The subsequent full Linux [run](https://github.com/H-Wilderspin/speech-to-text/actions/runs/38051991375) passed all 32 browser checks in 51.6 seconds and deployed successfully. This verifies the observed test correction, not universal WebKit audio reliability.
