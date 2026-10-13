# PC comparison service

Original app: <https://h-wilderspin.github.io/speech-to-text/>.
Separate page: <https://h-wilderspin.github.io/speech-to-text/compare.html>.
The separate page requires a running PC service. Its Settings accepts the service
address and private access code; the launcher's private link supplies both.
Existing profiles on the original GitHub origin/path are reused automatically.

**New personal Windows PC:** follow [the one-time setup](WINDOWS-SETUP.md).
`setup-comparison.ps1` installs the tested environment and prepares the pinned
models; it does not need the work PC's caches, credentials or Node.js installation.

## Start and stop (Windows)

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File service/start-comparison.ps1
```

The launcher binds Python to `127.0.0.1:8765`, starts a hidden Cloudflare Quick
Tunnel, and checks its public health response. It writes the private phone link
to `research/private/comparison-service/private-link.txt`. Open/copy that link to
the phone. Keep it private: it contains the comparison access code, not an HF key.
The frontend consumes and removes the fragment; Settings retains it for that tab.
The link changes whenever the tunnel is restarted. Keep this PC awake.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File service/stop-comparison.ps1
```

The stop helper verifies executable paths before terminating recorded PIDs.
Delete `research/private/comparison-service/key.txt` while stopped to rotate the
access code. This invalidates older private links after the next start.

## Runtime and cached models

The existing comparison installation is in `research/private/service-venv`.
`requirements-windows.txt` pins the complete tested Python 3.13 Windows environment;
`python -m pip check` must pass. Core versions: WhisperX 3.8.6, pyannote.audio 4.0.7,
Torch/torchaudio 2.8.0, Transformers 4.57.6, faster-whisper 1.2.1, sherpa-onnx 1.13.8.
To rebuild that environment:

```powershell
python -m venv research/private/service-venv
research/private/service-venv/Scripts/python.exe -m pip install -r service/requirements-windows.txt
```

The service uses the already downloaded, pinned benchmark model snapshots and
NLTK files in `research/private/comparison` (see `pipeline.py` and the Community-1
benchmark report). It starts offline and never downloads models in response to
phone audio. Model preparation on another PC requires the approved HF model
access and `setup-comparison.ps1`; don't commit or publish gated weights.
The voice model's checksum is verified at startup.

Cloudflare client: official `cloudflare/cloudflared` release **2026.10.0**, Windows
amd64 executable in `research/private/comparison-service/cloudflared.exe`; the
launcher verifies SHA256 `86aee4017b26625cee8484c113558f48effa4cd47f7aa05fcf425604e5d2b23c`.
Do not disable TLS checks or change system DNS to work around a failed tunnel.
If its log says SRV returned zero regions, run the launcher from a normal local
PowerShell terminal and check the network. A printed temporary URL alone does not
prove a connected tunnel; public `/health` must succeed.

If the normal-terminal launch also fails with zero SRV records, run these read-only
checks in that terminal:

```powershell
Resolve-DnsName _v2-origintunneld._tcp.argotunnel.com -Type SRV
Resolve-DnsName _v2-origintunneld._tcp.argotunnel.com -Type SRV -Server 1.1.1.1
```

The result should contain SRV records with target names and ports. An A record
alone is not a successful SRV lookup. If only the second lookup works, investigate
the current DNS resolver. If neither works, investigate DNS filtering or network
restrictions with the network administrator. The responsible component has not
been isolated here. Switching QUIC to HTTP/2 does not fix this earlier discovery
failure. No Hugging Face payment is needed to resolve it. See
[Cloudflare DNS troubleshooting](https://developers.cloudflare.com/tunnel/troubleshooting/#dns-resolution-failures).

## Data flow and limits

Browser speech recognition supplies only the lower live pane. The PC independently
transcribes, aligns and identifies the upper pane. It receives up to 24 seconds
mono PCM16/16 kHz, up to 16 compatible voiceprints, opaque IDs and audio-clock
coordinates per job. Names remain in the browser. HTTPS is relayed by Cloudflare.
Nothing saves audio/transcripts; request logs are disabled, telemetry is disabled,
and temporary mutable PCM/vector buffers are erased when released. Python/JS and
inference libraries can retain transient internal copies until garbage collection;
this is not a secure-memory-erasure guarantee.

24-second windows advance every 20 seconds; the 4-second overlap supplies context.
Word midpoints select disjoint ownership intervals. Stop flushes the remaining
audio and releases the mic immediately, while pending names finish. A new Listen
or Clear discards old pending work. Only one HTTP job is processed at a time;
concurrent clients receive 503. The client waits at most 90 seconds for a job and
queues at most three additional jobs. Network/inference failure leaves live
captions usable and reports a short status. Strict unknown/overlap exclusion and
speaker eye-toggle filtering apply only to the upper pane.

## Tests

```powershell
research/private/service-venv/Scripts/python.exe -m unittest service.test_service
npm run check
npm run test:e2e -- --workers=1
node research/service-references.mjs
research/private/service-venv/Scripts/python.exe -m service.smoke
node research/service-verify.mjs
research/private/service-venv/Scripts/python.exe -m service.http_smoke --local
# With an established tunnel, repeat without --local.
```

All model/HTTP probes use generated benchmark voices, not human recordings.
The packaged pipeline reproduces 120/123 correctly named known words, 0/41 false
unknown names, 9/11 complete known utterances, and no assigned overlap words on
the original eight fixtures. Native/browser reference-vector cosine exceeds
0.9999999 for both generated voices. This does not establish family-voice accuracy.
An additional 49.95-second HTTP replay spans three windows and retains all 78
words, correct identities and all six full sentences, including deliberate repeats.
The deployment workflow runs the lightweight HTTP/policy tests without model
downloads or inference credentials. `?debugSpeakers=1` enables safe client queue,
dispatch and completion counts/timings, without transcript/identity values.

On Pixel 8, open the private comparison link in the same browser used for the
original app, confirm existing profiles in Settings, then Listen and speak several
sentences for 30–60 seconds, pausing between them. Compare complete words, names
and intentional repeated phrases between pages. Stop and wait for pending names;
check the microphone turns off. Repeat with another registered person and unknown
audio, one at a time, then test overlap. Confirm hidden speakers stay absent above
and visible below. Physical-device testing has not yet been performed for this route.
