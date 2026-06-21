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

  window.KodroHooks = { useAiStatus };
})();
