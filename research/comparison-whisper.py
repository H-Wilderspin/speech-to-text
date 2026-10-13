"""Local synthetic benchmark only. No API calls/audio uploads; model download on first run."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import time
import wave
import sys
import numpy as np

ROOT = Path(__file__).resolve().parent / "private" / "comparison"
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
from huggingface_hub import snapshot_download
from faster_whisper import WhisperModel
from faster_whisper.vad import get_speech_timestamps, VadOptions

speech_regions = "--speech-regions" in sys.argv

model_path = snapshot_download("Systran/faster-whisper-small.en", cache_dir=str(ROOT / "models"),
                               revision="d1d751a5f8271d482d14ca55d9e2deeebbae577f",
                               allow_patterns=["config.json", "model.bin", "tokenizer.json", "vocabulary.*"])
started = time.perf_counter()
model = WhisperModel(model_path, device="cpu", compute_type="int8", cpu_threads=4, num_workers=1)
report = {"model": "Systran/faster-whisper-small.en", "revision": Path(model_path).name,
          "modelSha256": hashlib.sha256((Path(model_path) / "model.bin").read_bytes()).hexdigest(),
          "versions": {name: importlib.metadata.version(name) for name in ["faster-whisper", "ctranslate2", "huggingface-hub"]},
          "initializationMs": round((time.perf_counter() - started) * 1000),
          "device": "cpu", "computeType": "int8", "threads": 4, "beamSize": 5, "fixtures": []}
report["chunking"] = "silero-regions" if speech_regions else "whole-fixture"
report["vadParameters"] = {"min_silence_duration_ms": 500, "speech_pad_ms": 200, "max_speech_duration_s": 25} if speech_regions else None
for fixture in json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["fixtures"]:
    # Fixtures are already mono PCM16/16 kHz: use the standard-library decoder.
    # This also avoids faster-whisper 1.2.1's incompatible PyAV 19 file argument.
    with wave.open(str(ROOT / (fixture["id"] + ".wav")), "rb") as audio_file:
        assert (audio_file.getnchannels(), audio_file.getsampwidth(), audio_file.getframerate()) == (1, 2, 16000)
        audio = np.frombuffer(audio_file.readframes(audio_file.getnframes()), dtype="<i2").astype(np.float32) / 32768
    started = time.perf_counter()
    regions = get_speech_timestamps(audio, VadOptions(**report["vadParameters"])) if speech_regions else [{"start": 0, "end": len(audio)}]
    words = []
    for region in regions:
        segments, info = model.transcribe(audio[region["start"]:region["end"]], language="en", beam_size=5,
                                         word_timestamps=True, vad_filter=False, condition_on_previous_text=False,
                                         temperature=0)
        words.extend({"text": word.word, "start": word.start + region["start"] / 16000, "end": word.end + region["start"] / 16000}
                     for segment in segments for word in segment.words or [])
    result = {"id": fixture["id"], "processingMs": round((time.perf_counter() - started) * 1000), "words": words}
    report["fixtures"].append(result)
    result["regions"] = regions
    (ROOT / ("whisper-regions.json" if speech_regions else "whisper.json")).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"fixture": fixture["id"], "processingMs": result["processingMs"], "words": len(words)}), flush=True)
