"""Replay synthetic benchmark only; no human audio or transcript console output."""
import json
import wave
import numpy as np
from .policy import MODEL_VERSION
from .pipeline import Pipeline, CACHE


def main():
    references = json.loads((CACHE / "service-references.json").read_text())
    manifest = json.loads((CACHE / "manifest.json").read_text())
    pipeline = Pipeline()
    similarities = {}
    for name, reference in references.items():
        with wave.open(str(CACHE / (name + "-profile.wav")), "rb") as source:
            audio = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2").astype(np.float32) / 32768
        embedding = pipeline.embed(audio)
        similarities[name] = float(np.dot(embedding, reference) / np.linalg.norm(embedding))
        assert similarities[name] > .9999, "Native and browser voiceprints differ"
        audio.fill(0); embedding.fill(0)
    print(json.dumps({"nativeWasmCosine": similarities}), flush=True)
    results = []
    for fixture in manifest["fixtures"]:
        with wave.open(str(CACHE / (fixture["id"] + ".wav")), "rb") as source:
            audio = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2").astype(np.float32) / 32768
        profiles = [{"id": name, "modelVersion": MODEL_VERSION, "embedding": references[name]} for name in fixture["enrolled"]]
        result = pipeline.process(audio, profiles)
        results.append({"id": fixture["id"], **result})
        print(json.dumps({"fixture": fixture["id"], "words": len(result["words"]), "named": sum("speakerId" in w for w in result["words"]), "processingMs": result["processingMs"]}), flush=True)
        audio.fill(0)
    (CACHE / "service-results.json").write_text(json.dumps({"fixtures": results, "nativeWasmCosine": similarities}))


if __name__ == "__main__":
    main()
