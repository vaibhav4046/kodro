"""Offline-constraint guard for the web UI.

Kodro's public web build is local-only at runtime. The shipped AI provider code
may contact localhost (Ollama) but must not contain an executable remote AI host.
Astra remains a UI-visible unavailable option, not a network provider.
"""

from __future__ import annotations

import re
from pathlib import Path

WEB = Path(__file__).resolve().parents[2] / "src" / "kodro" / "assets" / "web"

_LOCAL = re.compile(r"^(?:https?:)?//(?:localhost|127\.0\.0\.1)\b", re.IGNORECASE)
_REMOTE = re.compile(r"https?://[^\s\"')]+", re.IGNORECASE)


def _remote_urls(text: str) -> list[str]:
    return [u for u in _REMOTE.findall(text) if not _LOCAL.match(u)]


_EXCLUDED_SCRIPTS = {"bundle.js", "harness_bundle.js"}
_PROVIDER_FILES = {"ai-providers.jsx", "ai-web.jsx", "astra-provider.js"}
_CITATION_HOSTS: dict[str, set[str]] = {"parts-db.js": {"www.pololu.com"}}
_NO_FETCH = re.compile(r"\bfetch\s*\(|\.src\s*=")
_PROTO_RELATIVE = re.compile(r"""["'](//[\w.-]+(?::\d+)?)""")
_HOST = re.compile(r"(?:https?:)?//([^/:\s\"']+)", re.IGNORECASE)


def _shipped_web_scripts() -> list[Path]:
    files = sorted(WEB.glob("*.js")) + sorted(WEB.glob("*.jsx"))
    out: list[Path] = []
    for path in files:
        stem = path.stem.lower()
        if path.name in _EXCLUDED_SCRIPTS or "harness" in stem or "probe" in stem:
            continue
        out.append(path)
    return out


def _remote_hosts(text: str) -> set[str]:
    candidates = list(_REMOTE.findall(text)) + _PROTO_RELATIVE.findall(text)
    hosts: set[str] = set()
    for url in candidates:
        if _LOCAL.match(url):
            continue
        match = _HOST.match(url)
        if not match:
            continue
        host = match.group(1).lower()
        if host.endswith("w3.org") or host.endswith("spdx.org"):
            continue
        hosts.add(host)
    return hosts


def test_index_html_loads_only_local_assets() -> None:
    html = (WEB / "index.html").read_text(encoding="utf-8")
    refs = re.findall(r'(?:src|href)\s*=\s*"([^"]+)"', html)
    remote = [r for r in refs if r.startswith(("http://", "https://", "//"))]
    assert remote == [], f"index.html loads remote assets: {remote}"


def test_app_css_and_js_have_no_remote_dependencies() -> None:
    own = [
        "styles.css",
        "vendor/fonts.css",
        "bridge.js",
        "interpreter.js",
        "app.jsx",
        "Editor.jsx",
        "Viewport.jsx",
        "Telemetry.jsx",
        "Rover.jsx",
        "terrains.jsx",
        "tweaks-panel.jsx",
    ]
    offenders: dict[str, list[str]] = {}
    for name in own:
        text = (WEB / name).read_text(encoding="utf-8")
        urls = _remote_urls(text)
        urls = [u for u in urls if "w3.org" not in u and "spdx.org" not in u]
        if urls:
            offenders[name] = urls
    assert not offenders, f"remote URLs found in shipped app assets: {offenders}"


def test_no_network_apis_in_app_code() -> None:
    """Hand-written shipped code may not contain remote AI runtime hosts."""
    banned_sockets = re.compile(r"\b(XMLHttpRequest|WebSocket|EventSource)\s*\(")
    scanned: set[str] = set()
    socket_offenders: dict[str, list[str]] = {}
    host_offenders: dict[str, list[str]] = {}
    for path in _shipped_web_scripts():
        name = path.name
        scanned.add(name)
        text = path.read_text(encoding="utf-8")
        sockets = banned_sockets.findall(text)
        if sockets:
            socket_offenders[name] = sockets
        allowed = _CITATION_HOSTS.get(name, set())
        stray = _remote_hosts(text) - allowed
        if stray:
            host_offenders[name] = sorted(stray)
        if name in _CITATION_HOSTS and _NO_FETCH.search(text):
            socket_offenders[name] = ["fetch/src in a citation-only module"]

    assert scanned >= _PROVIDER_FILES, (
        f"AI provider modules not scanned: {_PROVIDER_FILES - scanned}"
    )
    assert not socket_offenders, f"socket APIs used in app code: {socket_offenders}"
    assert not host_offenders, (
        f"non-local hosts referenced in shipped executable code: {host_offenders}"
    )

    provider_hosts: set[str] = set()
    for name in _PROVIDER_FILES:
        provider_hosts |= _remote_hosts((WEB / name).read_text(encoding="utf-8"))
    assert provider_hosts == set(), (
        "public AI provider files must contain no remote runtime hosts "
        f"(got {sorted(provider_hosts)})"
    )


def test_astra_legacy_key_is_delete_only() -> None:
    """The migration literal may delete old storage but may never read/write it."""
    text = (WEB / "astra-provider.js").read_text(encoding="utf-8")
    legacy = "kodro_ai_key_astra"
    assert text.count(legacy) == 1
    assert f"removeItem('{legacy}')" in text or f'removeItem("{legacy}")' in text
    assert f"getItem('{legacy}')" not in text and f'getItem("{legacy}")' not in text
    assert f"setItem('{legacy}'" not in text and f'setItem("{legacy}"' not in text
    assert "api.openai.com" not in text
    assert not re.search(r"\bAuthorization\s*:", text)
    assert not re.search(r"\bfetch\s*\(", text)


def test_fonts_css_uses_local_paths() -> None:
    css = (WEB / "vendor" / "fonts.css").read_text(encoding="utf-8")
    urls = re.findall(r"url\(([^)]+)\)", css)
    remote = [u for u in urls if "http" in u.lower()]
    assert remote == [], f"fonts.css references remote fonts: {remote}"
