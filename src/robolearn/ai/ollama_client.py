"""Minimal Ollama HTTP client built on the standard library.

Talks to a locally-running Ollama server at ``http://localhost:11434``.
No third-party dependency, no API key, no account. Every network call is
wrapped so a missing / unreachable server surfaces as :class:`OllamaError`
(for explicit calls) or a ``False`` / empty result (for the soft helpers
:func:`is_available` and :func:`list_models`).
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections.abc import Iterator
from dataclasses import dataclass

#: Base URL of the local Ollama server. Localhost only — never a remote host.
DEFAULT_BASE_URL: str = "http://localhost:11434"

#: Default chat model. Small + fast so a 2018 laptop can run it.
DEFAULT_MODEL: str = "llama3.2:3b"

#: Connection / read timeout in seconds for non-streaming calls.
DEFAULT_TIMEOUT_S: float = 120.0

#: Timeout (seconds) for the availability probe. The probe hits ``/api/tags``,
#: which Ollama can answer slowly when it is cold or busy loading a model into
#: memory. A tight window here made the desktop app report "Ollama not
#: connected" while a perfectly healthy server was mid-load, so this is generous
#: enough to ride out a busy server while still staying well under
#: :data:`DEFAULT_TIMEOUT_S`. A genuinely down server fails fast (connection
#: refused) regardless of this value, so raising it never masks a real outage.
PROBE_TIMEOUT_S: float = 6.0

#: How many times :meth:`OllamaClient.available` probes before concluding the
#: server is offline. A cold or busy Ollama can miss the first probe; a second
#: attempt costs nothing when the server is truly down (a refused connection
#: returns immediately) but rescues the false-offline case.
PROBE_ATTEMPTS: int = 2


class OllamaError(RuntimeError):
    """Raised when an explicit Ollama call fails."""


#: URL prefixes a client may talk to. RoboLearn's hard constraint is 100%
#: offline: the ONLY permitted network peer is a local Ollama server.
_ALLOWED_PREFIXES: tuple[str, ...] = (
    "http://localhost:",
    "http://127.0.0.1:",
    "http://[::1]:",
)


def _require_local(url: str) -> str:
    """Return ``url`` unchanged if it targets localhost; raise otherwise."""
    if not url.startswith(_ALLOWED_PREFIXES):
        raise OllamaError(f"refusing non-local URL (offline constraint): {url}")
    return url


@dataclass(slots=True)
class OllamaClient:
    """Thin wrapper around the Ollama REST API.

    Attributes:
        base_url: Server base URL (default :data:`DEFAULT_BASE_URL`).
        model: Default model name for :meth:`generate` / :meth:`chat`.
        timeout_s: Request timeout in seconds.
    """

    base_url: str = DEFAULT_BASE_URL
    model: str = DEFAULT_MODEL
    timeout_s: float = DEFAULT_TIMEOUT_S

    # --- availability -------------------------------------------------------

    def available(self) -> bool:
        """Return True if the server answers ``/api/tags`` within the probe window.

        A cold or busy Ollama can miss a single probe while it loads a model, so
        this retries once (see :data:`PROBE_ATTEMPTS`) before concluding the
        server is offline. A genuinely unreachable server still returns False:
        each attempt fails fast on a refused connection, so the retry adds no
        meaningful latency when Ollama is really down.
        """
        for attempt in range(PROBE_ATTEMPTS):
            try:
                self._get("/api/tags", timeout_s=PROBE_TIMEOUT_S)
                return True
            except OllamaError:
                if attempt + 1 >= PROBE_ATTEMPTS:
                    return False
        return False

    def models(self) -> list[str]:
        """Return the names of every locally-installed model (or ``[]``)."""
        try:
            payload = self._get("/api/tags", timeout_s=PROBE_TIMEOUT_S)
        except OllamaError:
            return []
        models = payload.get("models", [])
        if not isinstance(models, list):
            return []
        return [m["name"] for m in models if isinstance(m, dict) and "name" in m]

    # --- generation ---------------------------------------------------------

    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        model: str | None = None,
        json_mode: bool = False,
        temperature: float = 0.7,
        num_predict: int | None = None,
        keep_alive: str | None = None,
    ) -> str:
        """Generate a completion for ``prompt`` and return the full text.

        Args:
            prompt: User prompt.
            system: Optional system prompt.
            model: Model override; defaults to :attr:`model`.
            json_mode: Ask the model to emit strict JSON (``format=json``).
            temperature: Sampling temperature.
            num_predict: Optional max tokens to generate (bounds latency).
            keep_alive: How long Ollama keeps the model loaded (e.g. "30m") --
                avoids the multi-second model reload on the next call.

        Raises:
            OllamaError: On any transport or server error.
        """
        options: dict[str, object] = {"temperature": temperature}
        if num_predict is not None:
            options["num_predict"] = num_predict
        body: dict[str, object] = {
            "model": model or self.model,
            "prompt": prompt,
            "stream": False,
            "options": options,
        }
        if keep_alive is not None:
            body["keep_alive"] = keep_alive
        if system is not None:
            body["system"] = system
        if json_mode:
            body["format"] = "json"
        payload = self._post("/api/generate", body)
        response = payload.get("response", "")
        if not isinstance(response, str):
            raise OllamaError("malformed response from /api/generate")
        return response

    def generate_stream(
        self,
        prompt: str,
        *,
        system: str | None = None,
        model: str | None = None,
        temperature: float = 0.7,
        num_predict: int | None = None,
        keep_alive: str | None = None,
    ) -> Iterator[str]:
        """Yield response chunks as they arrive (for live UI streaming)."""
        options: dict[str, object] = {"temperature": temperature}
        if num_predict is not None:
            options["num_predict"] = num_predict
        body: dict[str, object] = {
            "model": model or self.model,
            "prompt": prompt,
            "stream": True,
            "options": options,
        }
        if keep_alive is not None:
            body["keep_alive"] = keep_alive
        if system is not None:
            body["system"] = system
        data = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            _require_local(f"{self.base_url}/api/generate"),
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_s) as resp:  # nosec B310 - localhost enforced
                for raw_line in resp:
                    line = raw_line.decode("utf-8").strip()
                    if not line:
                        continue
                    chunk = json.loads(line)
                    piece = chunk.get("response", "")
                    if piece:
                        yield piece
                    if chunk.get("done"):
                        break
        except (urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
            raise OllamaError(f"streaming generate failed: {exc}") from exc

    def embed(self, text: str, *, model: str = "nomic-embed-text") -> list[float]:
        """Return an embedding vector for ``text`` (empty list on failure)."""
        body: dict[str, object] = {"model": model, "prompt": text}
        try:
            payload = self._post("/api/embeddings", body)
        except OllamaError:
            return []
        vector = payload.get("embedding", [])
        return [float(x) for x in vector] if isinstance(vector, list) else []

    # --- transport ----------------------------------------------------------

    def _get(self, path: str, *, timeout_s: float) -> dict[str, object]:
        request = urllib.request.Request(_require_local(f"{self.base_url}{path}"), method="GET")
        try:
            with urllib.request.urlopen(request, timeout=timeout_s) as resp:  # nosec B310 - localhost enforced
                return json.loads(resp.read().decode("utf-8"))  # type: ignore[no-any-return]
        except (urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
            raise OllamaError(f"GET {path} failed: {exc}") from exc

    def _post(self, path: str, body: dict[str, object]) -> dict[str, object]:
        data = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            _require_local(f"{self.base_url}{path}"),
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_s) as resp:  # nosec B310 - localhost enforced
                return json.loads(resp.read().decode("utf-8"))  # type: ignore[no-any-return]
        except (urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
            raise OllamaError(f"POST {path} failed: {exc}") from exc


# --- module-level soft helpers ---------------------------------------------


def is_available(base_url: str = DEFAULT_BASE_URL) -> bool:
    """Return True if a local Ollama server is reachable."""
    return OllamaClient(base_url=base_url).available()


def list_models(base_url: str = DEFAULT_BASE_URL) -> list[str]:
    """Return locally-installed model names, or ``[]`` if the server is down."""
    return OllamaClient(base_url=base_url).models()
