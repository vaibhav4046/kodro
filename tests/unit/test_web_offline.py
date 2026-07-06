"""Offline-constraint guard for the web UI.

RoboLearn's hard constraint is 100% offline (no cloud, no CDN, no accounts).
The web front-end vendors React/Babel/fonts locally; this test fails if any
shipped asset reintroduces a remote dependency on its *loading surface* —
`<script src>` / `<link href>` in the HTML, or `@import` / `url(...)` /
`fetch(` / `XMLHttpRequest` in the app's own CSS/JS (vendored minified
libraries are excluded — their doc-string URLs are not network calls).
"""

from __future__ import annotations

import re
from pathlib import Path

WEB = Path(__file__).resolve().parents[2] / "src" / "robolearn" / "assets" / "web"

#: A URL is allowed only if it points at the local machine.
_LOCAL = re.compile(r"^(?:https?:)?//(?:localhost|127\.0\.0\.1)\b", re.IGNORECASE)
_REMOTE = re.compile(r"https?://[^\s\"')]+", re.IGNORECASE)


def _remote_urls(text: str) -> list[str]:
    return [u for u in _REMOTE.findall(text) if not _LOCAL.match(u)]


def test_index_html_loads_only_local_assets() -> None:
    html = (WEB / "index.html").read_text(encoding="utf-8")
    refs = re.findall(r'(?:src|href)\s*=\s*"([^"]+)"', html)
    remote = [r for r in refs if r.startswith(("http://", "https://", "//"))]
    assert remote == [], f"index.html loads remote assets: {remote}"


def test_app_css_and_js_have_no_remote_dependencies() -> None:
    """The app's own CSS/JS (not vendored libs) must not reach the network."""
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
        # ignore URLs that are clearly comments referencing standards/specs
        urls = [u for u in urls if "w3.org" not in u and "spdx.org" not in u]
        if urls:
            offenders[name] = urls
    assert not offenders, f"remote URLs found in shipped app assets: {offenders}"


def test_no_network_apis_in_app_code() -> None:
    """No remote fetch / XHR / WebSocket in the app's own JS.

    The offline constraint forbids reaching the *network* -- CDNs, cloud APIs,
    sockets. It does not forbid loading a file the build already ships next to
    index.html: the static web build reads its lessons from a same-origin
    ``./lessons.json`` (bridge.js browser fallback), which is a local asset
    load, not a network dependency. So we allow exactly that relative fetch and
    ban everything else: any other ``fetch(`` argument, plus XHR/WebSocket/
    EventSource anywhere.
    """
    own = [
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
    banned_sockets = re.compile(r"\b(XMLHttpRequest|WebSocket|EventSource)\s*\(")
    # Any fetch( whose first argument is NOT a bare same-origin relative string
    # ("./..." / "/...") is a violation. A relative-path fetch is a local asset.
    # The negative lookahead rejects "//host" (protocol-relative == remote).
    fetch_call = re.compile(r"\bfetch\s*\(\s*([^)]*)")
    allowed_fetch_arg = re.compile(r"""^["'](?:\./|/(?!/))[^"']*["']""")
    offenders: dict[str, list[str]] = {}
    for name in own:
        text = (WEB / name).read_text(encoding="utf-8")
        hits = list(banned_sockets.findall(text))
        for arg in fetch_call.findall(text):
            if not allowed_fetch_arg.match(arg.strip()):
                hits.append("fetch(" + arg.strip()[:40])
        if hits:
            offenders[name] = hits
    assert not offenders, f"network APIs used in app code: {offenders}"


def test_fonts_css_uses_local_paths() -> None:
    css = (WEB / "vendor" / "fonts.css").read_text(encoding="utf-8")
    urls = re.findall(r"url\(([^)]+)\)", css)
    remote = [u for u in urls if "http" in u.lower()]
    assert remote == [], f"fonts.css references remote fonts: {remote}"
