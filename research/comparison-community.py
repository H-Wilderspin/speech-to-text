"""Community-1 on the existing synthetic fixtures; local inference, no audio uploads."""
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parent / "private" / "comparison"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["PYANNOTE_METRICS_ENABLED"] = "0"

import hashlib
import importlib.metadata
import json
import time
import wave
import numpy as np
import torch
from huggingface_hub import snapshot_download
from pyannote.audio import Pipeline

torch.set_num_threads(4)
torch.set_num_interop_threads(1)
model_path = Path(snapshot_download("pyannote/speaker-diarization-community-1",
                                  revision="3533c8cf8e369892e6b79ff1bf80f7b0286a54ee",
                                  cache_dir=str(ROOT / "community-models")))
started = time.perf_counter()
pipeline = Pipeline.from_pretrained(model_path)
pipeline.to(torch.device("cpu"))
report = {"model": "pyannote/speaker-diarization-community-1", "revision": model_path.name,
          "versions": {name: importlib.metadata.version(name) for name in ["pyannote.audio", "torch", "torchaudio", "huggingface-hub"]},
          "device": "cpu", "threads": 4, "initializationMs": round((time.perf_counter() - started) * 1000),
          "hashes": {str(path.relative_to(model_path)).replace("\\", "/"): hashlib.sha256(path.read_bytes()).hexdigest()
                     for path in model_path.rglob("*") if path.is_file()}, "fixtures": []}
for fixture in json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["fixtures"]:
    with wave.open(str(ROOT / (fixture["id"] + ".wav")), "rb") as audio_file:
        assert (audio_file.getnchannels(), audio_file.getsampwidth(), audio_file.getframerate()) == (1, 2, 16000)
        audio = np.frombuffer(audio_file.readframes(audio_file.getnframes()), dtype="<i2").astype(np.float32) / 32768
    started = time.perf_counter()
    # No expected speaker count and no scripted boundary enters model inference.
    output = pipeline({"waveform": torch.from_numpy(audio).unsqueeze(0), "sample_rate": 16000})
    elapsed = round((time.perf_counter() - started) * 1000)
    turns = [{"start": turn.start, "end": turn.end, "cluster": speaker}
             for turn, _, speaker in output.speaker_diarization.itertracks(yield_label=True)]
    report["fixtures"].append({"id": fixture["id"], "processingMs": elapsed, "turns": turns})
    (ROOT / "community-turns.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"fixture": fixture["id"], "processingMs": elapsed, "clusters": len(set(t["cluster"] for t in turns))}), flush=True)
