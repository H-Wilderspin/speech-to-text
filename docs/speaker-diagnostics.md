# Diagnosing Who said what

Open <https://h-wilderspin.github.io/speech-to-text/?debugSpeakers=1>, then open the
page's developer console and filter **who-said-what**. Enable Info messages and
Preserve log. On Pixel 8, inspect that Chrome tab from desktop Chrome's connected
device tools if a phone console is unavailable. The URL must be open in the tab
being inspected; an installed app may open a different URL. Remove the query and
reload to turn diagnostics off.

Speak three different full sentences with short pauses, wait several seconds,
then Stop. Copy the filtered metadata from start through drain/failure. Logs omit
words, names, profile IDs, recordings and voiceprints; no log is saved by the app.
Debugging itself adds some overhead. Physical matching remains experimental.

Each line has `atMs` (time since page navigation), `trace` (one component instance)
and a stage. Worker lines share numeric `request` IDs. Pipeline `segment` is the
local recognizer's sentence counter, not a person. These counters reset with a new
worker/session and can be correlated by stage timestamps. No audio clock IDs are
logged. Counts generally accumulate within a session; compare consecutive lines.

| Stage | What to check |
| --- | --- |
| `local.preparation-*`, `local.references-ready`, `capture.ready` | Models, saved reference count and capture actually started. |
| `capture.received` / `capture.processed` | Both sample positions should advance. `queuedFrames` excludes the active frame; `lagMs` includes it. Rising lag means processing is falling behind input. |
| `worker.frame-request` / `frame-response` | One request at a time; `elapsedMs` is its round trip. Routine frames are sampled approximately once a second, so request IDs may jump and slow-response lines may lack a sampled request line. |
| `worker.frame-waiting` / `timeout` / `busy-rejected` | Waiting means the specific request has taken at least one second. Timeout terminates that worker. Busy rejection indicates an attempted concurrent RPC. |
| `worker.pipeline` | `acceptedSamples`, `localCharacters`, `tokens`, `segment`, `endpoint` show local recognizer progress. `pipelineMs` combines ASR and voice extraction; `attributionMs` covers word attribution/output preparation. |
| Pipeline voice fields | Increasing `voiceChecks` with flat `voiceMatched` indicates failed or ambiguous matches. `lastCandidates` / `lastSimilarity` refer to the latest window; two agreeing covering windows are still required per word. |
| Pipeline pending fields | `pendingFinal` and `evidenceWaitMs` identify completed sentences waiting for later evidence. `committedThrough` should advance. `wordsMatched`, `tokenMismatch`, `missingTiming`, `invalidTiming` describe the last settled word decision, not necessarily the currently growing hypothesis. |
| `alignment.updated` | Compare `localAssigned` with `alignedCharacters`. Local identities with no increase in aligned characters point to the wording/alignment gate. Growing browser characters with stopped local processing point upstream. |
| `display.upper-pane` | `visibleSegments` / `visibleCharacters` are the actual upper display after visibility filtering. `hiddenProfiles` explains deliberate filtering. |
| `capture.stop-requested`, `input-ended`, `drained`, `worker.finish-*`, `local.idle` | Stop ends input, drains queued audio, finalizes the recognizer and settles pending evidence. |
| `clock-interrupted`, `queue-or-continuity-failure`, `input-stalled`, `interrupted`, `failed` | Capture/worker failure; compare Settings' short error message. The console deliberately does not print arbitrary exception contents. |

Live browser text runs independently. Local audio frames are serialized, while
capture continues to queue them. There is no one-completed-sentence-at-a-time
permission gate. Upper attribution nevertheless waits for completed local words,
voice evidence and browser-word agreement. A single successful statement does not
establish that later statements passed all three gates.
