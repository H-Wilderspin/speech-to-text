"""Identity decisions shared by the HTTP adapter and offline regression tests."""
import math

MODEL_VERSION = "eres2net-en-voxceleb-c5915837-sherpa-v1"
THRESHOLD = 0.60  # Existing experimental threshold, not human-calibrated.


def unique_identity(embedding, profiles):
    norm = math.sqrt(sum(float(x) ** 2 for x in embedding))
    if not math.isfinite(norm) or norm < 1e-12:
        return None
    candidates = []
    for profile in profiles:
        vector = profile["embedding"]
        other_norm = math.sqrt(sum(float(x) ** 2 for x in vector))
        if other_norm < 1e-12 or len(vector) != len(embedding):
            continue
        score = sum(float(a) * float(b) for a, b in zip(embedding, vector)) / (norm * other_norm)
        if score >= THRESHOLD:
            candidates.append(profile["id"])
    return candidates[0] if len(candidates) == 1 else None


def word_identity(word, turns):
    """Require the whole aligned word inside one independently matched turn.

    No nearest-turn fill, cluster-wide propagation, gaps or overlap borrowing.
    """
    start, end = word.get("start"), word.get("end")
    if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
        return None
    if not math.isfinite(start) or not math.isfinite(end) or start < 0 or end <= start:
        return None
    active = [turn for turn in turns if turn["start"] < end and turn["end"] > start]
    if len(active) != 1:
        return None
    turn = active[0]
    return turn.get("speakerId") if turn["start"] <= start and turn["end"] >= end else None


def isolated(turn, turns):
    return turn["end"] - turn["start"] >= 1 and not any(
        other is not turn and other["start"] < turn["end"] and other["end"] > turn["start"] for other in turns
    )
