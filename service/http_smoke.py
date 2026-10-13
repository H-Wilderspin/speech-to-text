"""HTTP integration probe using generated speech only. Secrets never printed."""
import base64
import json
import ssl
import sys
import wave
from pathlib import Path
import httpx
from .policy import MODEL_VERSION

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "research/private/comparison"
PRIVATE = ROOT / "research/private/comparison-service"


def main():
    key = (PRIVATE / "key.txt").read_text().strip()
    state = json.loads((PRIVATE / "processes.json").read_text(encoding="utf-8-sig"))
    headers = {"Authorization": "Bearer " + key, "Origin": "https://h-wilderspin.github.io"}
    reference = json.loads((CACHE / "service-references.json").read_text())["Hazel"]
    with wave.open(str(CACHE / "known-long.wav"), "rb") as source:
        clip = source.readframes(source.getnframes())
    pcm = clip * 3  # Intentional repeated sentences at distinct audio times.
    words = []; through = 0; index = 0
    # Include the Windows trust store (e.g. a managed network's root CA).
    with httpx.Client(timeout=100, verify=ssl.create_default_context()) as client:
        public = f"http://127.0.0.1:{state['port']}" if "--local" in sys.argv else state["service"]
        assert client.get(public + "/health").json()["ready"]
        assert client.post(public + "/v1/transcribe", json={}).status_code == 401
        for start in range(0, len(pcm)//2, 20*16000):
            end = min(start+24*16000, len(pcm)//2)
            if through >= end:
                break
            until = start+22*16000 if end-start == 24*16000 else end
            payload = {"index": index, "startSample": start, "acceptFrom": through, "acceptUntil": until,
                "pcm": base64.b64encode(pcm[start*2:end*2]).decode(),
                "profiles": [{"id": "Hazel", "modelVersion": MODEL_VERSION, "embedding": reference}]}
            response = client.post(public + "/v1/transcribe", json=payload, headers=headers)
            assert response.status_code == 200, f"HTTP {response.status_code}"
            assert response.headers.get("access-control-allow-origin") == headers["Origin"]
            result = response.json()
            assert result["index"] == index
            owned = [{**word, "start": word["start"] + start/16000, "end": word["end"] + start/16000} for word in result["words"]
                     if through <= start + (word["start"] + word["end"])*8000 < until]
            words.extend(owned)
            print(json.dumps({"window": index, "ownedWords": len(owned), "named": sum("speakerId" in word for word in owned), "processingMs": result["processingMs"]}), flush=True)
            through = until; index += 1
        assert through == len(pcm)//2
    (CACHE / "service-http-results.json").write_text(json.dumps({"words": words, "seconds": len(pcm)/32000, "windows": index}))


if __name__ == "__main__":
    main()
