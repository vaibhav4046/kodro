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


#: Vendored/generated bundles never edited by hand: their doc-string URLs are not
#: our network calls, so they are out of scope for the app-code offline proof.
#: (``vendor/`` is a subdirectory, so the non-recursive glob below already skips
#: it; these are the top-level generated artefacts that must also be excluded.)
_EXCLUDED_SCRIPTS = {"bundle.js", "harness_bundle.js"}

#: The two BYOK (bring-your-own-key) assistant modules are the ONLY shipped files
#: allowed to reference a remote host, and only these four: the user opts in with
#: their own key and the request goes to exactly one of these clouds, or to the
#: local Ollama server. localhost is local (the machine itself), so it is filtered
#: as non-remote everywhere and is not listed here.
_BYOK_FILES = {"ai-providers.jsx", "ai-web.jsx"}
_BYOK_ALLOWED_HOSTS = {"api.anthropic.com", "api.openai.com", "api.groq.com"}

#: Datasheet-provenance citation hosts, scoped per file. ``parts-db.js`` is a
#: pure DATA module (no ``fetch``/``.src`` anywhere in it -- asserted below): each
#: motor row carries a ``source`` URL naming the Pololu product page its rpm/torque
#: numbers were read from, and ``qa_parts.mjs`` *requires* that citation to be a
#: real URL. The host is therefore provenance text, never a network target, so it
#: is exempted only in this one file -- the same file-scoped treatment as the
#: BYOK hosts above and the declarative w3.org/spdx.org hosts in ``_remote_hosts``.
_CITATION_HOSTS: dict[str, set[str]] = {"parts-db.js": {"www.pololu.com"}}
#: A citation-only module must not fetch: no ``fetch(`` and no ``x.src =`` (image
#: loads), so the cited host provably cannot become a network request.
_NO_FETCH = re.compile(r"\bfetch\s*\(|\.src\s*=")

#: A protocol-relative URL (``//host/...``) is remote too. Match it only inside a
#: string literal so a ``// comment`` or the ``//`` integer-division operator is
#: never mistaken for a host.
_PROTO_RELATIVE = re.compile(r"""["'](//[\w.-]+(?::\d+)?)""")
_HOST = re.compile(r"(?:https?:)?//([^/:\s\"']+)", re.IGNORECASE)


def _shipped_web_scripts() -> list[Path]:
    """Every hand-written web script the build ships, minus vendored bundles.

    Globs all top-level ``*.js``/``*.jsx`` (so ``vendor/`` is skipped), then drops
    the generated bundles and any ``*harness*`` / ``*probe*`` diagnostic file.
    """
    files = sorted(WEB.glob("*.js")) + sorted(WEB.glob("*.jsx"))
    out: list[Path] = []
    for path in files:
        stem = path.stem.lower()
        if path.name in _EXCLUDED_SCRIPTS or "harness" in stem or "probe" in stem:
            continue
        out.append(path)
    return out


def _remote_hosts(text: str) -> set[str]:
    """The set of non-local hosts this file references as a URL.

    Covers full ``http(s)://host`` URLs and protocol-relative ``//host`` string
    literals. Local hosts (localhost / 127.0.0.1) and XML/spec namespace hosts
    (``w3.org`` SVG/MathML/xlink namespaces, ``spdx.org`` licence ids) are
    dropped: the first is the local machine, the second is a declarative
    namespace value that is never fetched.
    """
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
    """No remote fetch / XHR / WebSocket in ANY shipped web script.

    The offline constraint forbids reaching the *network* -- CDNs, cloud APIs,
    sockets. This scans EVERY hand-written ``*.js``/``*.jsx`` the build ships
    (see ``_shipped_web_scripts``), not a hand-picked subset, so the proof also
    covers the network-capable modules (``ai-providers.jsx`` / ``ai-web.jsx``)
    that earlier lists silently excluded.

    Two guarantees, over the whole file set:

    * XHR / WebSocket / EventSource constructors are banned everywhere.
    * The only non-local host any file may reference is one of the documented
      BYOK cloud endpoints (in the two BYOK modules) or the datasheet-provenance
      citation host in ``parts-db.js`` -- and that data module is proven fetch-free
      so its cited host is text, not a network target. A remote fetch needs a
      remote host literal, so a clean host set proves no external fetch
      (protocol-relative ``//host`` included). localhost (Ollama) and same-origin
      relative fetches like bridge.js's ``./lessons.json`` carry no host and are
      inherently allowed.
    """
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
        allowed = _BYOK_ALLOWED_HOSTS if name in _BYOK_FILES else _CITATION_HOSTS.get(name, set())
        stray = _remote_hosts(text) - allowed
        if stray:
            host_offenders[name] = sorted(stray)
        # A file granted a citation-host exemption must be pure data: if it also
        # fetches, the cited host could be a real network target and the
        # exemption would be unsound. Fail loudly if that ever changes.
        if name in _CITATION_HOSTS and _NO_FETCH.search(text):
            socket_offenders[name] = ["fetch/src in a citation-only module"]

    # The offline proof must actually reach the risky files.
    assert scanned >= _BYOK_FILES, f"BYOK modules not scanned: {_BYOK_FILES - scanned}"
    assert not socket_offenders, f"socket APIs used in app code: {socket_offenders}"
    assert not host_offenders, (
        f"non-local hosts referenced outside the BYOK allow-list: {host_offenders}"
    )

    # ...and the exception is real, not vacuous: the two BYOK files together
    # reference EXACTLY the documented cloud hosts (nothing more, nothing less).
    byok_hosts: set[str] = set()
    for name in _BYOK_FILES:
        byok_hosts |= _remote_hosts((WEB / name).read_text(encoding="utf-8"))
    assert byok_hosts == _BYOK_ALLOWED_HOSTS, (
        "BYOK files must reference exactly the documented cloud hosts "
        f"(got {sorted(byok_hosts)}, expected {sorted(_BYOK_ALLOWED_HOSTS)})"
    )


def test_fonts_css_uses_local_paths() -> None:
    css = (WEB / "vendor" / "fonts.css").read_text(encoding="utf-8")
    urls = re.findall(r"url\(([^)]+)\)", css)
    remote = [u for u in urls if "http" in u.lower()]
    assert remote == [], f"fonts.css references remote fonts: {remote}"
