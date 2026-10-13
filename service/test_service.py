import base64
import unittest
import numpy as np
from .policy import MODEL_VERSION, isolated, unique_identity, word_identity
from .app import decode_job, create_app


class PolicyTests(unittest.TestCase):
    def test_unknown_and_ambiguous_are_not_named(self):
        profiles = [{"id": "a", "embedding": [1, 0]}, {"id": "b", "embedding": [0, 1]}]
        self.assertEqual(unique_identity([1, 0], profiles), "a")
        self.assertIsNone(unique_identity([1, 1], profiles))
        self.assertIsNone(unique_identity([-1, 0], profiles))

    def test_whole_word_coverage_does_not_fill_boundaries_or_overlap(self):
        turns = [{"start": 1, "end": 3, "speakerId": "a"}]
        self.assertEqual(word_identity({"start": 1, "end": 3}, turns), "a")
        self.assertIsNone(word_identity({"start": .9, "end": 2}, turns))
        self.assertIsNone(word_identity({"start": 2, "end": 3.1}, turns))
        self.assertIsNone(word_identity({"start": 2}, turns))
        turns.append({"start": 2.5, "end": 4, "speakerId": "a"})
        self.assertIsNone(word_identity({"start": 2, "end": 3}, turns))
        self.assertFalse(isolated(turns[0], turns))

    def test_bounded_input_and_model_compatibility(self):
        value = {"index": 0, "startSample": 0, "acceptFrom": 0, "acceptUntil": 16000,
                 "pcm": base64.b64encode(bytes(32000)).decode(), "profiles": [
                     {"id": "a", "modelVersion": MODEL_VERSION, "embedding": [1.] + [0.] * 191}]}
        audio, _ = decode_job(value)
        self.assertEqual(len(audio), 16000)
        value["acceptUntil"] = 16001
        with self.assertRaises(ValueError):
            decode_job(value)
        value["acceptUntil"] = 16000
        value["profiles"][0]["embedding"][0] = float("nan")
        with self.assertRaises(ValueError):
            decode_job(value)


class HttpTests(unittest.TestCase):
    def test_authorization_validation_and_no_retention(self):
        from fastapi.testclient import TestClient
        captured = []

        class FakePipeline:
            def process(self, audio, profiles):
                captured.extend([audio, profiles[0]["embedding"]])
                return {"words": [], "processingMs": 1}

        key = "a" * 32
        app = create_app(FakePipeline, key)
        with TestClient(app) as client:
            self.assertEqual(client.post("/v1/transcribe", json={}).status_code, 401)
            headers = {"Authorization": "Bearer " + key}
            response = client.post("/v1/transcribe", json={"pcm": "private-placeholder"}, headers=headers)
            self.assertEqual(response.status_code, 400)
            self.assertNotIn("private-placeholder", response.text)
            payload = {"index": 5, "startSample": 0, "acceptFrom": 0, "acceptUntil": 16000,
                "pcm": base64.b64encode(np.ones(16000, dtype="<i2").tobytes()).decode(),
                "profiles": [{"id": "a", "modelVersion": MODEL_VERSION, "embedding": [1.] + [0.] * 191}]}
            response = client.post("/v1/transcribe", json=payload, headers=headers)
            self.assertEqual(response.json(), {"index": 5, "words": [], "processingMs": 1})
            self.assertEqual(response.headers["cache-control"], "no-store")
            self.assertFalse(np.any(captured[0]))
            self.assertFalse(any(captured[1]))
            response = client.post("/v1/transcribe", content=b"x" * 1_200_001, headers=headers)
            self.assertEqual(response.status_code, 413)


if __name__ == "__main__":
    unittest.main()
