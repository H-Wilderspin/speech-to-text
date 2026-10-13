"""Download pinned assets once, then check the service can initialize offline."""
import argparse
import hashlib
import os
from pathlib import Path

from .model_assets import CACHE, MODELS, VOICE, VOICE_SHA256, model_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Verify existing files without downloading")
    args = parser.parse_args()
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["PYANNOTE_METRICS_ENABLED"] = "0"
    os.environ["NLTK_DATA"] = str(CACHE / "nltk")
    if args.offline:
        os.environ["HF_HUB_OFFLINE"] = "1"
    if not VOICE.is_file() or hashlib.sha256(VOICE.read_bytes()).hexdigest() != VOICE_SHA256:
        raise SystemExit("Voice model missing or checksum incorrect. Restore public/speaker/v1/embedding.onnx from the repository.")

    from huggingface_hub import snapshot_download
    from huggingface_hub.errors import GatedRepoError
    from requests.exceptions import SSLError
    import nltk

    for name, (repo, revision, directory, patterns) in MODELS.items():
        print(f"Preparing {name} ({revision[:8]})...", flush=True)
        try:
            path = snapshot_download(repo, revision=revision, cache_dir=str(CACHE / directory),
                                     allow_patterns=patterns, local_files_only=args.offline)
        except GatedRepoError:
            raise SystemExit("Community-1 access is required. Accept its conditions at https://huggingface.co/pyannote/speaker-diarization-community-1, then run research/private/service-venv/Scripts/hf.exe auth login and retry setup.") from None
        except SSLError:
            raise SystemExit("Hugging Face HTTPS certificate verification failed. Check this PC's trusted certificates/network; do not disable TLS verification. Existing caches can be checked with python -m service.prepare --offline.") from None
        if model_path(name).resolve() != Path(path).resolve():
            raise RuntimeError("Downloaded model location differs from the service configuration")
    if not args.offline:
        nltk.download("punkt_tab", download_dir=str(CACHE / "nltk"), quiet=True, raise_on_error=True)
    nltk.data.find("tokenizers/punkt_tab/english/", paths=[str(CACHE / "nltk")])

    # Inference imports force offline mode; setup never records microphone audio.
    print("Checking offline model loading and silence processing...", flush=True)
    from .pipeline import Pipeline
    import numpy as np
    result = Pipeline().process(np.zeros(16000, dtype=np.float32), [])
    if result["words"]:
        raise RuntimeError("Silence unexpectedly produced words")
    print("Model preparation passed. Start service/start-comparison.ps1 next.", flush=True)


if __name__ == "__main__":
    main()
