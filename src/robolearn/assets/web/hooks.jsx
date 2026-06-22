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
 * useBlocks({ sfx, addConsole, typewriteCode }): the Scratch-style visual
 * block-editor concern. It owns blocksOpen + the blocks array + blockIndent
 * and every handler that mutates them (addBlock / endBlock / removeBlock /
 * moveBlock / blocksToPython / insertBlocksCode). BLOCK_DEFS is pure data
 * pulled off window.KodroBlockDefs here. The three callbacks it needs from the
 * App belong to other concerns and are threaded in: sfx (sound cue),
 * addConsole (console line), typewriteCode (animate code into the editor).
 * blocksToPython is kept byte-identical so generated Python is unchanged.
 *
 * useReview({ code, addConsole, typewriteCode, currentLessonId, aiInfo,
 * selfTestReport }): the second-agent code-review concern (propose-then-critique
 * on the local model). It owns reviewOpen/reviewBusy/reviewData/reviewErr and
 * the runReview (calls window.KodroAI.reviewCode) + applyReview handlers, moved
 * VERBATIM. The handlers read the live editor code, the current lesson id, the
 * AI model label (aiInfo) and three App callbacks (addConsole, typewriteCode,
 * selfTestReport) -- all threaded in because they belong to other concerns.
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
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); document.body.style.cursor = ''; };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      document.body.style.cursor = kind === 'console' ? 'row-resize' : 'col-resize';
    }
    // Keyboard alternative to dragging (WCAG 2.1.1): nudge a split by d pixels,
    // clamped to the same bounds as the pointer drag.
    function nudge(kind, d) {
      if (kind === 'editor') setEditorW(w => Math.max(280, Math.min(640, w + d)));
      else if (kind === 'tele') setTeleW(w => Math.max(240, Math.min(460, w + d)));
      else if (kind === 'console') setConsoleH(h => Math.max(90, Math.min(420, h + d)));
    }
    return { editorW, teleW, consoleH, startDrag, nudge };
  }

  function useBlocks(opts) {
    const sfx = (opts && opts.sfx) || function () {};
    const addConsole = (opts && opts.addConsole) || function () {};
    const typewriteCode = (opts && opts.typewriteCode) || function () {};
    // --- Scratch-style blocks mode -----------------------------------------
    // BLOCK_DEFS is pure data (see app-data.jsx); pulled off window here.
    const BLOCK_DEFS = window.KodroBlockDefs || [];
    const [blocksOpen, setBlocksOpen] = useState(false);
    const [blocks, setBlocks] = useState([]);       // {k,label,val,indent,container,color,unit}
    const [blockIndent, setBlockIndent] = useState(0);
    function addBlock(def) {
      setBlocks(bs => [...bs, { k: def.k, label: def.label, val: def.val, indent: blockIndent, container: !!def.container, color: def.color, unit: def.unit }]);
      if (def.container) setBlockIndent(d => Math.min(3, d + 1));
      sfx('led');
    }
    function endBlock() { setBlockIndent(d => Math.max(0, d - 1)); }
    function removeBlock(i) {
      setBlocks(bs => bs.filter((_, j) => j !== i));
    }
    function moveBlock(i, dir) {
      setBlocks(bs => {
        const j = i + dir;
        if (j < 0 || j >= bs.length) return bs;
        const next = bs.slice();
        const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
        return next;
      });
      sfx('led');
    }
    function blocksToPython() {
      const defs = {}; BLOCK_DEFS.forEach(d => { defs[d.k] = d; });
      const lines = [];
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        lines.push('    '.repeat(b.indent) + defs[b.k].code(b.val));
        if (b.container) {
          const next = blocks[i + 1];
          // An empty container needs a body to be valid Python.
          if (!next || next.indent <= b.indent) lines.push('    '.repeat(b.indent + 1) + 'pass');
        }
      }
      return lines.join('\n') + '\n';
    }
    function insertBlocksCode() {
      if (!blocks.length) return;
      setBlocksOpen(false);
      addConsole('Blocks turned into Python. Read it, then press Run.', 'sys');
      typewriteCode(blocksToPython());
    }
    return { BLOCK_DEFS, blocksOpen, setBlocksOpen, blocks, setBlocks, blockIndent, setBlockIndent, addBlock, endBlock, removeBlock, moveBlock, blocksToPython, insertBlocksCode };
  }

  function useReview(opts) {
    opts = opts || {};
    const code = opts.code;
    const addConsole = opts.addConsole || function () {};
    const typewriteCode = opts.typewriteCode || function () {};
    const currentLessonId = opts.currentLessonId;
    const aiInfo = opts.aiInfo || {};
    const selfTestReport = opts.selfTestReport || function () {};
    // Second-agent code review (propose-then-critique on the local model).
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewBusy, setReviewBusy] = useState(false);
    const [reviewData, setReviewData] = useState(null);
    const [reviewErr, setReviewErr] = useState(null);

    async function runReview() {
      if (reviewBusy) return;
      const src = (code || '').trim();
      if (!src) { setReviewErr('Write some code first, then ask for a review.'); setReviewOpen(true); return; }
      setReviewOpen(true); setReviewBusy(true); setReviewErr(null); setReviewData(null);
      try {
        const r = await window.KodroAI.reviewCode(src, currentLessonId || null);
        if (r && r.ok) setReviewData(r);
        else setReviewErr((r && r.reason) || 'Review unavailable.');
      } catch (e) { setReviewErr(String(e)); }
      setReviewBusy(false);
    }

    function applyReview() {
      if (reviewData && reviewData.revised && reviewData.code) {
        setReviewOpen(false);
        addConsole('Reviewer (' + (reviewData.model || aiInfo.model) + ') tidied your code. Read it, then press Run.', 'sys');
        typewriteCode(reviewData.code);
        selfTestReport(reviewData.code);
      }
    }

    return { reviewOpen, setReviewOpen, reviewBusy, reviewData, reviewErr, runReview, applyReview };
  }

  window.KodroHooks = { useAiStatus, useResizers, useBlocks, useReview };
})();
