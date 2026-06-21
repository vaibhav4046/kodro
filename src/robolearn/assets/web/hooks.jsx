/* window.KodroHooks -- custom React hooks extracted from the App() God
 * component to start reducing app.jsx. Each hook owns one cohesive concern,
 * moved VERBATIM (same logic, same deps) so behaviour is preserved exactly.
 *
 * useAiStatus(vibeOpen): the AI-status concern (local Ollama: Qwen/Gemma;
 * graceful when absent). It owns the {available, model, models...} state and
 * the status-refresh / model-pick logic, polling at mount (the desktop bridge
 * injects late) and re-checking whenever the vibe panel opens. The ONLY
 * external input is vibeOpen (App state); everything else is owned here.
 *
 * useResizers(): the panel-resizer / layout concern. It owns the three panel
 * size states (editor width, telemetry width, console height) and the
 * startDrag(kind, e) pointer handler that mutates them via window
 * pointermove/pointerup listeners. Fully self-contained -- no external inputs;
 * exposes the sizes + startDrag to the JSX.
 *
 * Uses the global React (like every other web module), so the IIFE reads
 * React.useState / React.useEffect rather than importing.
 */
(function () {
  'use strict';

  const { useState, useEffect } = React;

  function useAiStatus(vibeOpen) {
    // --- AI vibe coding (local Ollama: Qwen/Gemma; graceful when absent) ---
    const [aiInfo, setAiInfo] = useState({ available: false, model: null });
    // The pywebview bridge injects asynchronously AFTER React mounts, so a
    // one-shot check at mount races it and can leave the panel "offline"
    // forever. Poll briefly at mount, and re-check every time the panel is
    // opened -- so starting Ollama later lights it up without a restart.
    function refreshAiStatus() {
      // KodroAI uses the desktop bridge when present, else talks to the local
      // Ollama server directly, so status reflects the model in both run modes.
      if (!window.KodroAI) return;
      Promise.resolve(window.KodroAI.status()).then(s => { if (s) setAiInfo(s); }).catch(() => {});
    }
    // Let the user point Kodro at any local model they have pulled (DeepSeek,
    // Nemotron, Qwen, a custom fine-tune). Persisted server side; empty = auto.
    function pickModel(name) {
      if (!window.KodroAI) return;
      Promise.resolve(window.KodroAI.setModel(name || '')).then(() => refreshAiStatus()).catch(() => {});
    }
    useEffect(() => {
      // Refresh a few times after mount: the desktop bridge injects late, and in
      // browser mode the Ollama probe is async, so one shot can miss it.
      let tries = 0;
      refreshAiStatus();
      const t = setInterval(() => { tries += 1; refreshAiStatus(); if (tries > 6) clearInterval(t); }, 700);
      return () => clearInterval(t);
    }, []);
    useEffect(() => { if (vibeOpen) refreshAiStatus(); }, [vibeOpen]);
    return { aiInfo, pickModel, refreshAiStatus };
  }

  function useResizers() {
    // ---------- layout resizers ----------
    const [editorW, setEditorW] = useState(404);
    const [teleW, setTeleW] = useState(318);
    const [consoleH, setConsoleH] = useState(184);
    function startDrag(kind, e) {
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      const w0 = editorW, t0 = teleW, c0 = consoleH;
      const move = (ev) => {
        if (kind === 'editor') setEditorW(Math.max(280, Math.min(640, w0 + (ev.clientX - sx))));
        else if (kind === 'tele') setTeleW(Math.max(240, Math.min(460, t0 - (ev.clientX - sx))));
        else if (kind === 'console') setConsoleH(Math.max(90, Math.min(420, c0 - (ev.clientY - sy))));
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      document.body.style.cursor = kind === 'console' ? 'row-resize' : 'col-resize';
    }
    return { editorW, teleW, consoleH, startDrag };
  }

  window.KodroHooks = { useAiStatus, useResizers };
})();
