# Troubleshooting

Use these current recovery steps. Original diagnoses and test evidence are in
[the history](archive/troubleshooting-history.md); retired speaker/service
experiments there are not current setup instructions.

## Local Settings shows tokens instead of Family connection

Actions variables do not configure Vite locally. Put the public
`VITE_SYNC_SERVICE_URL` in ignored `.env.development.local`, then restart the
correct dev process. See [local setup](hosted-editing.md#local-development-and-checks).
If the old app persists, check for competing Vite processes before stopping
anything. Use the exact printed URL; `127.0.0.1` worked where localhost probes
failed on the development machine.

## The installed app looks old

Stop listening, open Settings and choose Update app. If offline, reconnect and
retry. For versions without that button, open online, then close all app tabs
and reopen. Do not clear browser data: pairing and unsynced edits can be lost.
A push alone does not prove publication; inspect CI and the served release.

## Family edits are not reaching other devices

Keep the app and its local edits. Check the owner `status` command, pause state,
daily allowance and GitHub App installation. Service/network failures do not
require new pairing. Revoked/invalid device access does.
After recovery, retry or reopen; existing service backoff can delay a retry.
See [owner commands and pause behaviour](hosted-editing.md#pairing-and-owner-commands).

If the GitHub App key/installation fails, repair service credentials without
disconnecting family devices. Never remove the service URL to troubleshoot
paired access; device credentials must not be sent directly to GitHub.

## Speech enters an edit field or the microphone is unavailable

The app now aborts listening before editors open and when text entry gains focus
(ADR 0073). Save/Cancel does not resume it. The reported physical iPad behaviour
has not yet been retested: record OS/browser and keyboard dictation/Voice Control
settings. Independent OS dictation is not controlled by this app.
If another app holds the microphone, stop that app's capture and tap Listen again.

## Speech cannot connect inside the IDE preview

On 2026-11-26 the IDE's integrated preview reported a speech-service connection
error, while the owner confirmed recognition and caption retention worked in
Chrome using both localhost and the local IP address. Isolated installed Chrome
and Edge sessions also returned recognition results from synthetic speech at
`http://127.0.0.1:5173/`, without recording the real microphone.

Open the local app directly in Chrome or Edge for speech testing. The precise
embedded-browser failure remains unverified; this symptom does not establish a
fault in the app server or the family connection. No extra app API key is needed.

## Windows certificate or login failures

For `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, Node's `--use-system-ca` successfully
used the Windows trust store. Apply it to the affected process, preserving and
restoring any existing NODE_OPTIONS. Never disable TLS verification.
A new workers.dev endpoint initially had a separate transient handshake failure
that cleared after waiting; keep syncing paused until HTTPS works.

## Test and runtime pitfalls

| Symptom | Verified fix / guard |
| --- | --- |
| Browser suites lose trace files | Give independent configurations separate output directories, not just separate ports. Family output is under .wrangler. |
| WebKit sticky-heading test fails after resize | Wait for fonts and two animation frames; scroll relative to the current position. Keep the geometry assertions. |
| WebKit update tests bypass GitHub route fixtures | For these fixtures, mock page GitHub fetches with addInitScript while keeping real service-worker/asset requests. |
| Moving a newly added shopping item is lost | Replay dependent moves after pending adds; retain the add-then-move regression in sync-document.test.ts. |
| Worker GitHub calls fail before reaching GitHub | Use redirect: manual and reject non-OK responses. Workers rejected redirect: error; Node mocks alone missed it. |

Keep production preview assets unchanged during browser runs. Do not weaken
assertions to mask build/server races. For a new issue, record only the reusable
cause, fix and verification here; label unproven explanations.
