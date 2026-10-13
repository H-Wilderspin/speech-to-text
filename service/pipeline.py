"""The winning synthetic benchmark route, with all models loaded once on CPU."""
import os
from pathlib import Path
import hashlib
import time

os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["PYANNOTE_METRICS_ENABLED"] = "0"
os.environ["HF_HUB_OFFLINE"] = "1"

from .policy import isolated, unique_identity, word_identity

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "research/private/comparison"
os.environ["NLTK_DATA"] = str(CACHE / "nltk")


class Pipeline:
    def __init__(self):
        import torch
        import sherpa_onnx
        from faster_whisper import WhisperModel
        from pyannote.audio import Pipeline as Diarizer
        from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

        torch.set_num_threads(4)
        torch.set_num_interop_threads(1)
        whisper = CACHE / "models/models--Systran--faster-whisper-small.en/snapshots/d1d751a5f8271d482d14ca55d9e2deeebbae577f"
        community = CACHE / "community-models/models--pyannote--speaker-diarization-community-1/snapshots/3533c8cf8e369892e6b79ff1bf80f7b0286a54ee"
        alignment = CACHE / "alignment-models/models--facebook--wav2vec2-base-960h/snapshots/22aad52d435eb6dbaf354bdad9b0da84ce7d6156"
        voice = ROOT / "public/speaker/v1/embedding.onnx"
        if hashlib.sha256(voice.read_bytes()).hexdigest() != "c59158379255ad66e161679cca6af8d52d51e389e3224ab7d7a7baae295c2db5":
            raise RuntimeError("Voice model checksum mismatch")
        self.whisper = WhisperModel(str(whisper), device="cpu", compute_type="int8", cpu_threads=4, num_workers=1)
        self.diarizer = Diarizer.from_pretrained(community).to(torch.device("cpu"))
        self.aligner = Wav2Vec2ForCTC.from_pretrained(alignment, local_files_only=True).eval()
        processor = Wav2Vec2Processor.from_pretrained(alignment, local_files_only=True)
        self.metadata = {"language": "en", "dictionary": {char.lower(): code for char, code in processor.tokenizer.get_vocab().items()}, "type": "huggingface"}
        self.extractor = sherpa_onnx.SpeakerEmbeddingExtractor(sherpa_onnx.SpeakerEmbeddingExtractorConfig(
            model=str(voice), num_threads=2, debug=False, provider="cpu"))

    def embed(self, audio):
        import numpy as np
        stream = self.extractor.create_stream()
        stream.accept_waveform(sample_rate=16000, waveform=audio)
        stream.input_finished()
        if not self.extractor.is_ready(stream):
            raise RuntimeError("Insufficient voice evidence")
        return np.array(self.extractor.compute(stream), dtype=np.float32)

    def process(self, audio, profiles):
        import torch
        from faster_whisper.vad import get_speech_timestamps, VadOptions
        from whisperx.alignment import align

        started = time.perf_counter()
        words = []
        regions = get_speech_timestamps(audio, VadOptions(min_silence_duration_ms=500, speech_pad_ms=200, max_speech_duration_s=25))
        for region in regions:
            segments, _ = self.whisper.transcribe(audio[region["start"]:region["end"]], language="en", beam_size=5,
                word_timestamps=True, vad_filter=False, condition_on_previous_text=False, temperature=0)
            words.extend(word.word.strip() for segment in segments for word in segment.words or [])
        if not words:
            return {"words": [], "processingMs": round((time.perf_counter() - started) * 1000)}
        output = self.diarizer({"waveform": torch.from_numpy(audio).unsqueeze(0), "sample_rate": 16000})
        turns = [{"start": turn.start, "end": turn.end} for turn, _, _ in output.speaker_diarization.itertracks(yield_label=True)]
        for turn in turns:
            if not isolated(turn, turns):
                continue
            sample = audio[round(turn["start"] * 16000):min(round(turn["end"] * 16000), round(turn["start"] * 16000) + 15 * 16000)]
            if len(sample) < 16000:
                continue
            embedding = self.embed(sample)
            try:
                turn["speakerId"] = unique_identity(embedding, profiles)
            finally:
                embedding.fill(0)
        alignment = align([{"start": 0, "end": len(audio) / 16000, "text": " ".join(words)}], self.aligner,
            self.metadata, audio, "cpu", interpolate_method="ignore")["word_segments"]
        if [word["word"] for word in alignment] != words:
            raise RuntimeError("Alignment changed the recognized word sequence")
        result = []
        for word in alignment:
            if "start" not in word or "end" not in word:
                continue  # Untimed words cannot receive a strict identity.
            item = {"text": word["word"], "start": word["start"], "end": word["end"]}
            identity = word_identity(word, turns)
            if identity:
                item["speakerId"] = identity
            result.append(item)
        return {"words": result, "processingMs": round((time.perf_counter() - started) * 1000)}
