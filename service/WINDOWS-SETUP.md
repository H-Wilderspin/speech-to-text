# Run the comparison on a personal Windows PC

**Inactive experiment:** personal-PC hosting is no longer the active plan. Use
the [main browser app](https://h-wilderspin.github.io/speech-to-text/) for normal use.

Use a personal **Windows x64** computer on an unmanaged home connection. Keep the
work computer and its required VPN unchanged. No paid hosting is involved.
The phone continues using the existing GitHub Pages comparison page; this PC does
the delayed processing. An NVIDIA GPU is not required.

## One-time setup

1. Install [Git for Windows](https://git-scm.com/install/windows) and
   [Python 3.13, Windows installer (64-bit)](https://www.python.org/downloads/windows/).
   Include the Python launcher. Use 3.13 specifically, not the latest Python series.
   Reopen PowerShell after installation. Allow several GB of downloads and, as a
   planning allowance, 20 GB of free disk space. 16 GB RAM is suggested; the minimum
   usable memory and speed on this personal PC have not been measured.
2. Sign into your existing Hugging Face account in the browser and confirm access
   to [Community-1](https://huggingface.co/pyannote/speaker-diarization-community-1).
   Create a **read** token at [Access Tokens](https://huggingface.co/settings/tokens).
   The setup asks for it locally if you are not already signed in. Do not paste it
   in chat. No PRO subscription or billing setup is needed.
3. In PowerShell, choose a short local path (outside OneDrive), then run:

```powershell
git clone https://github.com/H-Wilderspin/speech-to-text.git
cd speech-to-text
powershell -NoProfile -ExecutionPolicy Bypass -File service/setup-comparison.ps1
```

If the repo is already cloned there, run `git pull --ff-only` inside it and then
the setup command. Setup checks DNS first, creates its own Python environment,
installs pinned packages, verifies the Cloudflare executable, downloads the exact
model revisions, and verifies offline model loading plus a silence-processing
check. Cached files are reused if setup is rerun. When Hugging Face asks about
saving a Git credential, answer **No**; GitHub cloning is public and needs no token.

Do not copy the work computer's Python environment, credentials or private runtime
directory. Setup creates the environment on this PC and the launcher generates a
new private comparison key. Node.js and a frontend build are not needed here.

## Start and use

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File service/start-comparison.ps1
```

After it reports a connected service, open
`research/private/comparison-service/private-link.txt` and send that private link
to your phone. Open it in the **same browser** you used for the original app so
your saved speaker profiles are available. Do not post the link publicly.

Keep this PC awake. Tap Listen on the phone and speak for 30–60 seconds. Live text
appears below; assigned text arrives above after audio collection and processing.
Press Stop and let pending names finish. The first check is that a full sentence
reaches the upper pane with the correct name; compare it against the original app.
Personal-PC speed and family-voice accuracy still need this test.

To stop the service and its temporary link:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File service/stop-comparison.ps1
```

Each restart makes a new private phone link. If DNS discovery fails on the personal
PC too, use the [DNS checks](README.md) and report the results. A personal computer
does not guarantee that its network allows Cloudflare Tunnel.
