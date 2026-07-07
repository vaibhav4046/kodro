"use client";

import { useEffect, useRef } from "react";
import { getExchange } from "@/lib/exchange";
import { STATUS_META } from "@/lib/format";
import { LineStatus } from "@/lib/types";

// The signature moment: every open line is a filament on the board. Colour is
// its status, brightness is how recently it spoke, and a slow refresh sweep
// runs across the whole board like an exchange coming alive. It reads the store
// imperatively inside one rAF loop, so hundreds of lamps never touch React.

const GLOW: Record<LineStatus, number> = {
  replying: 1, thinking: 0.85, waiting: 0.8, idle: 0.4, resolved: 0.14,
};

export default function SignalBoard({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selRef = useRef(selectedId);
  selRef.current = selectedId;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: true })!;
    const ex = getExchange();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let ids: string[] = [];
    let lastCount = -1;
    let cols = 1, cell = 20, pad = 10;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let hover = -1;
    let mouse = { x: -1, y: -1 };
    let running = true;
    let visible = true;
    let raf = 0;
    let sweep = 0;
    let boot = 0;

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      cell = w < 520 ? 15 : w < 900 ? 18 : w < 1300 ? 23 : 27;
      pad = 8;
      cols = Math.max(1, Math.floor((w - pad * 2) / cell));
      const rows = Math.max(1, Math.ceil(ids.length / cols));
      const h = rows * cell + pad * 2;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const refreshIds = () => {
      const { lines } = ex.raw();
      if (lines.size !== lastCount) {
        lastCount = lines.size;
        ids = Array.from(lines.keys()).sort(
          (a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)),
        );
        layout();
      }
    };

    const pos = (i: number) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      return { x: pad + c * cell + cell / 2, y: pad + r * cell + cell / 2 };
    };

    const draw = (t: number) => {
      refreshIds();
      const { lines, connection } = ex.raw();
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (connection !== "live") boot = 0;
      else boot = Math.min(1, boot + 0.02);
      if (reduce) boot = connection === "live" ? 1 : 0;

      sweep = reduce ? -1 : (t / 4200) % 1;
      const sweepY = sweep * (rect.height + 40) - 20;

      hover = -1;
      const now = Date.now();
      for (let i = 0; i < ids.length; i++) {
        const l = lines.get(ids[i]);
        if (!l) continue;
        const { x, y } = pos(i);
        const [r, g, b] = STATUS_META[l.status].rgb;

        // brightness: base by status + recent-activity kick, decaying
        const since = now - l.lastAt;
        const kick = Math.max(0, 1 - since / 2600);
        let bright = GLOW[l.status] * (0.5 + 0.5 * boot);
        bright = Math.min(1, bright + kick * 0.5);

        // living motion per status
        if (!reduce) {
          if (l.status === "waiting") bright *= 0.7 + 0.3 * Math.sin(t / 520 + i);
          else if (l.status === "replying") bright *= 0.75 + 0.25 * Math.sin(t / 90 + i);
          else if (l.status === "thinking") bright *= 0.72 + 0.28 * Math.sin(t / 260 + i);
        }
        // sweep refresh: lamps near the sweep line flare briefly
        if (sweep >= 0) {
          const d = Math.abs(y - sweepY);
          if (d < 26) bright = Math.min(1, bright + (1 - d / 26) * 0.4);
        }

        // hover detection
        if (
          mouse.x >= x - cell / 2 && mouse.x < x + cell / 2 &&
          mouse.y >= y - cell / 2 && mouse.y < y + cell / 2
        ) hover = i;

        const rad = (cell * 0.22) * (0.8 + bright * 0.5);
        // glow halo
        if (bright > 0.28) {
          const grd = ctx.createRadialGradient(x, y, 0, x, y, cell * 0.72);
          grd.addColorStop(0, `rgba(${r},${g},${b},${0.5 * bright})`);
          grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = grd;
          ctx.fillRect(x - cell * 0.75, y - cell * 0.75, cell * 1.5, cell * 1.5);
        }
        // filament
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${0.22 + bright * 0.78})`;
        ctx.fill();

        // selection ring
        if (ids[i] === selRef.current) {
          ctx.beginPath();
          ctx.arc(x, y, cell * 0.42, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(237,230,218,0.9)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // hover tooltip, drawn on canvas
      if (hover >= 0) {
        const l = lines.get(ids[hover]);
        if (l) {
          const { x, y } = pos(hover);
          ctx.beginPath();
          ctx.arc(x, y, cell * 0.44, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(237,230,218,0.55)";
          ctx.lineWidth = 1;
          ctx.stroke();
          const label = `${l.id}  ${l.caller}`;
          const sub = `${STATUS_META[l.status].label}  ${l.topic}`;
          ctx.font = "11px 'JetBrains Mono', monospace";
          const w = Math.max(ctx.measureText(label).width, ctx.measureText(sub).width) + 18;
          let tx = x + 12;
          let ty = y - 34;
          if (tx + w > rect.width) tx = rect.width - w - 2;
          if (ty < 2) ty = y + 14;
          ctx.fillStyle = "rgba(9,8,7,0.92)";
          ctx.fillRect(tx, ty, w, 34);
          ctx.strokeStyle = "rgba(227,185,91,0.5)";
          ctx.strokeRect(tx + 0.5, ty + 0.5, w, 34);
          ctx.fillStyle = "#ede6da";
          ctx.fillText(label, tx + 9, ty + 14);
          ctx.fillStyle = "#8a7c68";
          ctx.fillText(sub.slice(0, 46), tx + 9, ty + 27);
        }
        canvas.style.cursor = "none";
      }

      if (running) raf = requestAnimationFrame(draw);
    };

    const findAt = (px: number, py: number) => {
      const c = Math.floor((px - pad) / cell);
      const r = Math.floor((py - pad) / cell);
      if (c < 0 || c >= cols) return null;
      const i = r * cols + c;
      return i >= 0 && i < ids.length ? ids[i] : null;
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouse = { x: -1, y: -1 }; };
    const onClick = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const id = findAt(e.clientX - rect.left, e.clientY - rect.top);
      if (id) onSelect(id);
    };

    const onResize = () => { lastCount = -1; refreshIds(); layout(); };
    const onVis = () => { visible = !document.hidden; if (visible && !raf && running) raf = requestAnimationFrame(draw); };

    // pause when the board scrolls offscreen
    const io = new IntersectionObserver(
      ([entry]) => {
        const on = entry.isIntersecting && !document.hidden;
        if (on && !raf) { running = true; raf = requestAnimationFrame(draw); }
        if (!on) { running = false; cancelAnimationFrame(raf); raf = 0; }
      },
      { threshold: 0.02 },
    );
    io.observe(canvas);

    layout();
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onClick);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onClick);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [onSelect]);

  return (
    <canvas
      ref={canvasRef}
      className="signal-board"
      role="img"
      aria-label="Live board of open conversations. Each filament is one line, coloured by what the AI is doing. Use the list below to open any line."
    />
  );
}
