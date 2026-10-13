"""Authenticated, bounded in-memory HTTP adapter. No audio/transcript logging."""
import asyncio
import base64
from contextlib import asynccontextmanager
import hmac
import json
import math
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .policy import MODEL_VERSION

MAX_BODY = 1_200_000


def decode_job(value):
    if not isinstance(value, dict):
        raise ValueError("Invalid request")
    for field in ["index", "startSample", "acceptFrom", "acceptUntil"]:
        if type(value.get(field)) is not int or not 0 <= value[field] <= 10**12:
            raise ValueError("Invalid sample clock")
    profiles = value.get("profiles")
    if not isinstance(profiles, list) or not 1 <= len(profiles) <= 16:
        raise ValueError("Invalid profiles")
    ids = set()
    for profile in profiles:
        if (not isinstance(profile, dict) or not isinstance(profile.get("id"), str)
            or not 1 <= len(profile["id"]) <= 100 or profile["id"] in ids or profile.get("modelVersion") != MODEL_VERSION):
            raise ValueError("Incompatible voice profile")
        ids.add(profile["id"])
        vector = profile.get("embedding")
        if (not isinstance(vector, list) or len(vector) != 192
            or not all(type(x) in [float, int] and math.isfinite(x) and abs(x) <= 1 for x in vector)
            or not .95 <= math.sqrt(sum(x*x for x in vector)) <= 1.05):
            raise ValueError("Invalid embedding")
    raw = base64.b64decode(value["pcm"], validate=True)
    if len(raw) % 2 or not 2 <= len(raw) <= 24 * 16000 * 2:
        raise ValueError("Invalid PCM length")
    if not value["startSample"] <= value["acceptFrom"] < value["acceptUntil"] <= value["startSample"] + len(raw) // 2:
        raise ValueError("Invalid ownership interval")
    return np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768, profiles


def create_app(pipeline_factory=None, access_key=None):
    if pipeline_factory is None:
        from .pipeline import Pipeline
        pipeline_factory = Pipeline
    key = access_key or os.environ.get("COMPARISON_ACCESS_KEY")
    if not key:
        secret = Path(__file__).resolve().parents[1] / "research/private/comparison-service/key.txt"
        key = secret.read_text().strip() if secret.exists() else ""
    if len(key) < 24:
        raise RuntimeError("Set a private comparison access key (at least 24 characters).")
    pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="comparison")
    busy = False

    @asynccontextmanager
    async def lifespan(app):
        app.state.pipeline = await asyncio.get_running_loop().run_in_executor(pool, pipeline_factory)
        yield
        pool.shutdown(wait=True)

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(CORSMiddleware, allow_origins=["https://h-wilderspin.github.io", "http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:4173"],
                       allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])

    def authenticate(request):
        if not hmac.compare_digest(request.headers.get("authorization", ""), "Bearer " + key):
            raise HTTPException(401, "Access code required")

    @app.get("/health")
    async def health():
        return JSONResponse({"ready": True, "protocol": 1, "modelVersion": MODEL_VERSION}, headers={"Cache-Control": "no-store"})

    @app.post("/v1/transcribe")
    async def transcribe(request: Request):
        nonlocal busy
        authenticate(request)
        if busy:
            raise HTTPException(503, "Service busy")
        busy = True
        audio = None; profiles = []; task = None; data = bytearray()
        try:
            async with asyncio.timeout(15):
                async for chunk in request.stream():
                    data.extend(chunk)
                    if len(data) > MAX_BODY:
                        raise HTTPException(413, "Recording too large")
            try:
                value = json.loads(data)
                audio, profiles = decode_job(value)
                index = value["index"]
                value.clear(); data[:] = b"\0" * len(data); data.clear()
            except (ValueError, KeyError, TypeError, OverflowError):
                raise HTTPException(400, "Invalid recording or voice profile") from None
            task = asyncio.get_running_loop().run_in_executor(pool, app.state.pipeline.process, audio, profiles)
            result = await asyncio.shield(task)
            return JSONResponse({"index": index, **result}, headers={"Cache-Control": "no-store"})
        except HTTPException:
            raise
        except TimeoutError:
            raise HTTPException(408, "Upload timed out") from None
        except Exception:
            # Do not expose exception values, request bodies, transcripts or vectors.
            raise HTTPException(500, "Comparison processing failed") from None
        finally:
            if task and not task.done():
                try:
                    await asyncio.shield(task)
                except Exception:
                    pass
            if audio is not None:
                audio.fill(0)
            for profile in profiles:
                profile["embedding"][:] = [0] * len(profile["embedding"])
            data[:] = b"\0" * len(data); data.clear(); busy = False

    return app
