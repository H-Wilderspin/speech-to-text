"""Alignment-only WhisperX probe; uses recognized words, never reference scripts."""
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parent / "private" / "comparison"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["PYANNOTE_METRICS_ENABLED"] = "0"
os.environ["NLTK_DATA"] = str(ROOT / "nltk")
import hashlib
import importlib.metadata
import json
import time
import wave
import numpy as np
import torch
import nltk
from huggingface_hub import snapshot_download
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
from whisperx.alignment import align

torch.set_num_threads(4)
torch.set_num_interop_threads(1)
nltk.download("punkt_tab", download_dir=str(ROOT / "nltk"), quiet=True, raise_on_error=True)
model_path = Path(snapshot_download("facebook/wav2vec2-base-960h", cache_dir=str(ROOT / "alignment-models"),
                                  revision="22aad52d435eb6dbaf354bdad9b0da84ce7d6156",
                                  allow_patterns=["*.json", "model.safetensors", "pytorch_model.bin"]))
started = time.perf_counter()
model = Wav2Vec2ForCTC.from_pretrained(model_path).eval()
processor = Wav2Vec2Processor.from_pretrained(model_path)
metadata = {"language": "en", "dictionary": {char.lower(): code for char, code in processor.tokenizer.get_vocab().items()}, "type": "huggingface"}
report = {"model": "facebook/wav2vec2-base-960h", "revision": model_path.name,
          "versions": {name: importlib.metadata.version(name) for name in ["whisperx", "transformers", "torch", "nltk"]},
          "initializationMs": round((time.perf_counter() - started) * 1000),
          "hashes": {str(path.relative_to(model_path)): hashlib.sha256(path.read_bytes()).hexdigest()
                     for path in model_path.rglob("*") if path.is_file()}, "fixtures": []}
transcription = json.loads((ROOT / "whisper-regions.json").read_text(encoding="utf-8"))
for fixture in transcription["fixtures"]:
    with wave.open(str(ROOT / (fixture["id"] + ".wav")), "rb") as audio_file:
        assert (audio_file.getnchannels(), audio_file.getsampwidth(), audio_file.getframerate()) == (1, 2, 16000)
        audio = np.frombuffer(audio_file.readframes(audio_file.getnframes()), dtype="<i2").astype(np.float32) / 32768
    text = " ".join(word["text"].strip() for word in fixture["words"])
    started = time.perf_counter()
    result = align([{"start": 0, "end": len(audio) / 16000, "text": text}], model, metadata, audio, "cpu", interpolate_method="ignore") if text else {"word_segments": []}
    aligned = result["word_segments"]
    # A failed alignment must not silently delete or replace recognized words.
    if [w["word"] for w in aligned] != [w["text"].strip() for w in fixture["words"]]:
        raise ValueError("Alignment changed the recognized word sequence")
    words = [{"text": word["word"], **{key: word[key] for key in ["start", "end", "score"] if key in word}} for word in aligned]
    elapsed = round((time.perf_counter() - started) * 1000)
    report["fixtures"].append({"id": fixture["id"], "alignmentMs": elapsed, "processingMs": fixture["processingMs"], "words": words})
    (ROOT / "whisper-aligned.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps({"fixture": fixture["id"], "alignmentMs": elapsed, "words": len(words), "untimed": sum("start" not in w or "end" not in w for w in words)}), flush=True)
