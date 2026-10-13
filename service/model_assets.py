"""Pinned model locations shared by first-time setup and offline inference."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "research/private/comparison"
MODELS = {
    "whisper": ("Systran/faster-whisper-small.en", "d1d751a5f8271d482d14ca55d9e2deeebbae577f", "models",
                ["config.json", "model.bin", "tokenizer.json", "vocabulary.*"]),
    "community": ("pyannote/speaker-diarization-community-1", "3533c8cf8e369892e6b79ff1bf80f7b0286a54ee", "community-models", None),
    "alignment": ("facebook/wav2vec2-base-960h", "22aad52d435eb6dbaf354bdad9b0da84ce7d6156", "alignment-models",
                  ["*.json", "model.safetensors"]),
}
VOICE = ROOT / "public/speaker/v1/embedding.onnx"
VOICE_SHA256 = "c59158379255ad66e161679cca6af8d52d51e389e3224ab7d7a7baae295c2db5"


def model_path(name):
    repo, revision, directory, _ = MODELS[name]
    return CACHE / directory / ("models--" + repo.replace("/", "--")) / "snapshots" / revision
