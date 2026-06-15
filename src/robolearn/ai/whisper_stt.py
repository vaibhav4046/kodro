"""Offline speech to text for Kodro.

Records from the microphone and transcribes with faster-whisper, which bundles
Silero VAD (voice activity detection) and runs Whisper locally. No cloud, no
API, no account. Replaces the flaky Windows System.Speech recogniser; falls
back to it only when these libraries are not installed.

Public surface:
    available()                      -> bool, whether the offline stack is usable
    preload()                        -> warm the model in a background thread
    record_and_transcribe(seconds)   -> {"ok": True, "text": ...} | {"ok": False, "reason": ...}
    transcribe_file(path)            -> str   (for tests)
"""
from __future__ import annotations

import threading
from typing import Any

SAMPLE_RATE = 16000
_MODEL = None
_LOCK = threading.Lock()


def available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        import sounddevice  # noqa: F401

        return True
    except Exception:
        return False


def _model():
    global _MODEL
    with _LOCK:
        if _MODEL is None:
            from faster_whisper import WhisperModel

            # base/int8 on CPU: ~1 s per short phrase, leaves the GPU for Ollama.
            _MODEL = WhisperModel("base", device="cpu", compute_type="int8")
        return _MODEL


def preload() -> None:
    """Load the model off the UI thread so the first phrase is not slow."""
    if not available():
        return
    threading.Thread(target=_model, daemon=True).start()


def _transcribe(audio: Any) -> str:
    segments, _info = _model().transcribe(audio, vad_filter=True, language="en")
    return " ".join(s.text.strip() for s in segments).strip()


def transcribe_file(path: str) -> str:
    return _transcribe(path)


def record_and_transcribe(seconds: float = 6.0) -> dict[str, Any]:
    try:
        import sounddevice as sd
    except Exception as exc:  # pragma: no cover - host audio dependent
        return {"ok": False, "reason": f"audio capture unavailable: {exc}"}
    try:
        secs = max(2.0, min(float(seconds), 15.0))
        rec = sd.rec(int(secs * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype="float32")
        sd.wait()
        audio = rec.reshape(-1)
        text = _transcribe(audio)
        if not text:
            return {"ok": False, "reason": "Didn't catch that - try speaking again."}
        return {"ok": True, "text": text}
    except Exception as exc:  # pragma: no cover - host audio dependent
        return {"ok": False, "reason": f"Voice input failed: {exc}"}
