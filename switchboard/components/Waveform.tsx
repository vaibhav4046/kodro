"use client";

import { useEffect, useRef } from "react";
import { LineStatus } from "@/lib/types";

// A small live trace that shows the AI's state honestly: a restless line while
// composing, a fast bright pulse while replying, a slow swell while holding.
export default function Waveform({ status }: { status: LineStatus }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const size = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    const palette: Record<string, [string, number, number]> = {
      // colour, amplitude, speed
      thinking: ["#e3b95b", 0.55, 260],
      replying: ["#e2600f", 0.85, 90],
      waiting: ["#8a4e96", 0.4, 620],
      idle: ["#8a7c68", 0.16, 900],
      resolved: ["#3e7f52", 0.1, 1200],
    };

    const draw = (t: number) => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height, mid = h / 2;
      ctx.clearRect(0, 0, w, h);
      const st = statusRef.current;
      const [color, amp, speed] = palette[st] ?? palette.idle;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      const steps = 64;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * w;
        let y = mid;
        if (reduce) {
          y = mid + Math.sin(i * 0.5) * amp * mid * 0.4;
        } else {
          const phase = t / speed;
          const env = st === "replying"
            ? 0.6 + 0.4 * Math.sin(t / 120)
            : 1;
          y = mid
            + Math.sin(i * 0.38 + phase) * amp * mid * 0.55 * env
            + Math.sin(i * 0.9 - phase * 1.7) * amp * mid * 0.28 * env;
        }
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // baseline glow
      ctx.globalAlpha = 0.25;
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (running && !reduce) raf = requestAnimationFrame(draw);
    };

    const onResize = () => size();
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(draw);
    if (reduce) draw(0);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="waveform" aria-hidden />;
}
