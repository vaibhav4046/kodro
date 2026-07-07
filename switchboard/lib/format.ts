import { LineStatus } from "./types";

export const STATUS_META: Record<
  LineStatus,
  { label: string; short: string; color: string; rgb: [number, number, number] }
> = {
  thinking: { label: "Composing", short: "COMP", color: "var(--brass)", rgb: [227, 185, 91] },
  replying: { label: "On the line", short: "LIVE", color: "var(--ember)", rgb: [226, 96, 15] },
  waiting: { label: "Holding for you", short: "HOLD", color: "var(--plum)", rgb: [138, 78, 150] },
  idle: { label: "Open", short: "OPEN", color: "var(--sand)", rgb: [199, 187, 169] },
  resolved: { label: "Closed", short: "DONE", color: "var(--moss)", rgb: [62, 127, 82] },
};

export const CHANNEL_GLYPH: Record<string, string> = {
  voice: "voice",
  web: "web",
  sms: "sms",
};

export function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

export function clock(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
