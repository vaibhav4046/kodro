# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the RoboLearn DESKTOP APP (the web UI in a pywebview
# window). Produces a single windowed RoboLearn.exe -- double-clickable, no
# Python install required. The Tk fallback ships from robolearn.spec.
import os

from PyInstaller.utils.hooks import (
    collect_data_files,
    collect_dynamic_libs,
    collect_submodules,
)

# SPECPATH is injected by PyInstaller and points at this spec's directory
# (the repo root), so the build is portable across machines and CI runners.
ROOT = SPECPATH.replace(os.sep, "/")

datas = [
    (f"{ROOT}/src/robolearn/lessons/library", "robolearn/lessons/library"),
    # The vendored Claude design (HTML/CSS/JS/JSX + React/Babel + fonts).
    (f"{ROOT}/src/robolearn/assets/web", "robolearn/assets/web"),
]
# Package data (assets/web, fonts, etc.) + pywebview's injected bridge JS.
datas += collect_data_files("robolearn")
datas += collect_data_files("webview")
datas += collect_data_files("pythonnet")

# Strip the build-only Babel (~3 MB) from the shipped datas. JSX is precompiled
# to bundle.js at build time (scripts/build_web.cjs); Babel is never loaded at
# runtime (index.html/cap.html load only React/Three), so it is pure bloat in
# every distributed RoboLearn.exe.
datas = [d for d in datas if not d[0].replace(os.sep, "/").endswith("vendor/babel.min.js")]

hiddenimports = ["robolearn.web", "robolearn.web.app", "robolearn.web.__main__"]
hiddenimports += collect_submodules("robolearn")
# pywebview lazily imports its platform backend (WinForms on Windows) + the
# .NET bridge via pythonnet / clr_loader -- PyInstaller can't see those.
hiddenimports += collect_submodules("webview")
hiddenimports += ["clr", "clr_loader", "clr_loader.netfx", "pythonnet"]

binaries = collect_dynamic_libs("clr_loader")
binaries += collect_dynamic_libs("pythonnet")


a = Analysis(
    [f"{ROOT}/src/robolearn/web/_pyi_entry.py"],
    pathex=[f"{ROOT}/src"],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="RoboLearn",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # UPX can corrupt the .NET / WebView2 DLLs
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=f"{ROOT}/src/robolearn/assets/icon.ico",
)
