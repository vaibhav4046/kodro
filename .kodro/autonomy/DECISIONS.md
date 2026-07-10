# Kodro decision index (ADR-lite)

- D1 Web app stays no-build (vendored UMD React+Three, IIFE + build_web.cjs concat).
  Rejected: npm/vite migration. Reason: offline-first, zero toolchain, works from
  file://, proven. Cost of migration > benefit.
- D2 Ollama auto-start lives in ollama_client.ensure_server(), fired from a daemon
  thread in web/app.py launch(). Rejected: blocking the window on AI. Reason: UI
  must never wait; AI is optional. Only local binary launched, never downloaded.
- D3 Windows creationflags via getattr(..., 0) not subprocess.CREATE_* attrs.
  Reason: those attrs exist only in the Windows typeshed; posix CI mypy failed.
- D4 Viewport HUD is fixed dark-glass in every theme -> fixed --hud-fg-* tokens the
  theme blocks do not override. Rejected: theme-flipping --fg on the glass (light
  theme went dark-on-dark). 
- D5 KodroChatIntent parser is deliberately conservative (indefinite-article gate)
  so a coding question never triggers a robot rebuild. False-positive safety > recall.
- D6 Handoff area = .kodro/autonomy/ (tracked; no secrets). Makes the loop resumable
  across Fable/Codex sessions without re-auditing.
