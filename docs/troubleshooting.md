# Troubleshooting

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
