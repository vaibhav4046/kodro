"use client";

import { useEffect, useRef, useState } from "react";
import { useBootExchange, useConnection, useExchange, useList, useSummary } from "@/lib/store";
import SignalBoard from "@/components/SignalBoard";
import ConversationList from "@/components/ConversationList";
import ConversationDetail from "@/components/ConversationDetail";
import Cursor from "@/components/Cursor";
import { clock } from "@/lib/format";

const LEGEND = [
  { k: "replying", c: "var(--ember)", label: "on the line" },
  { k: "thinking", c: "var(--brass)", label: "composing" },
  { k: "waiting", c: "var(--plum)", label: "holding for you" },
  { k: "idle", c: "var(--sand)", label: "open" },
  { k: "resolved", c: "var(--moss)", label: "closed" },
];

export default function Page() {
  useBootExchange();
  const ex = useExchange();
  const connection = useConnection();
  const summary = useSummary();
  const lines = useList();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(0); // 0 on server + first client paint, so no hydration drift
  const [mounted, setMounted] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // On a wide floor, open the first line that is holding for a human so the
  // detail panel is populated the moment the board comes online. On narrow
  // screens the detail is an overlay, so we leave it to a tap.
  useEffect(() => {
    if (selectedId || narrow || !lines.length) return;
    const waiting = lines.find((l) => l.status === "waiting");
    setSelectedId((waiting ?? lines[0]).id);
  }, [lines, selectedId, narrow]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const booting = connection === "booting";
  const dropped = connection === "dropped" || connection === "reconnecting";

  return (
    <main id="floor">
      <Cursor />

      <header className="topbar">
        <div className="brand">
          <span className="wordmark display">Switchboard</span>
          <span className="brand-sub eyebrow">watch floor</span>
        </div>
        <div className="readouts" aria-label="Floor totals">
          <Readout label="open" value={booting ? "-" : summary.open} />
          <Readout label="holding" value={booting ? "-" : summary.waiting} accent="var(--plum)" pulse={summary.waiting > 0} />
          <Readout label="on air" value={booting ? "-" : summary.replying} accent="var(--ember)" />
          <Readout label="closed today" value={booting ? "-" : summary.resolvedToday} />
          <Readout
            label="avg trust"
            value={booting ? "-" : `${Math.round(summary.avgConfidence * 100)}%`}
          />
        </div>
        <div className="conn">
          <span className={`conn-dot ${connection}`} />
          <span className="mono conn-label">
            {connection === "live" ? "signal live" :
             connection === "booting" ? "booting" :
             connection === "reconnecting" ? "reconnecting" : "signal lost"}
          </span>
          <span className="mono conn-clock">{mounted ? clock(now) : "--:--:--"}</span>
        </div>
      </header>

      <section className="hero" ref={heroRef}>
        <div className="hero-copy">
          <p className="eyebrow">NexCell live assistant floor</p>
          <h1 className="display hero-head">
            Watch the machine talk.<br />
            <span className="hero-head-2">Plug in when it can&apos;t.</span>
          </h1>
          <p className="hero-lede">
            {booting
              ? "Bringing the exchange online."
              : summary.waiting > 0
                ? `${spellCount(summary.open)} lines open. ${spellCount(summary.waiting)} ${summary.waiting === 1 ? "is" : "are"} waiting on you.`
                : `${spellCount(summary.open)} lines open. The board is quiet.`}
          </p>
          <ul className="legend" aria-label="What the colours mean">
            {LEGEND.map((l) => (
              <li key={l.k}><span className="swatch" style={{ background: l.c }} />{l.label}</li>
            ))}
          </ul>
          <div className="panel" aria-label="Operator controls">
            <button className="opbtn" onClick={() => ex.surge()} disabled={connection !== "live"}>
              Surge test
            </button>
            {connection === "live" ? (
              <button className="opbtn" onClick={() => ex.dropSignal()}>Cut signal</button>
            ) : (
              <button className="opbtn warn" onClick={() => ex.reconnect()} disabled={connection === "reconnecting"}>
                {connection === "reconnecting" ? "Reconnecting" : "Restore signal"}
              </button>
            )}
          </div>
        </div>

        <div className="hero-board">
          <div className="board-cap">
            <span className="eyebrow">the board</span>
            <span className="mono board-cap-hint">
              {booting ? "coming online" : `${summary.open} open. hover a filament, click to open`}
            </span>
          </div>
          {booting && <BoardSkeleton label="Warming the filaments" />}
          {!booting && dropped && (
            <div className="board-fault">
              <p className="display fault-head">Lost the signal to the exchange.</p>
              <p className="fault-body mono">
                {connection === "reconnecting"
                  ? "Reconnecting. Holding the last known board."
                  : "The floor below is frozen at its last state. Nothing here is live."}
              </p>
              <button className="opbtn warn" onClick={() => ex.reconnect()} disabled={connection === "reconnecting"}>
                {connection === "reconnecting" ? "Reconnecting" : "Restore signal"}
              </button>
            </div>
          )}
          <div className={`board-wrap ${dropped ? "frozen" : ""} ${booting ? "hidden" : ""}`}>
            <SignalBoard selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
      </section>

      <section className={`floor-grid ${selectedId && narrow ? "detail-open" : ""}`}>
        {booting ? (
          <ListSkeleton />
        ) : (
          <ConversationList selectedId={selectedId} onSelect={setSelectedId} now={now} />
        )}
        <ConversationDetail
          id={selectedId}
          now={now}
          onClose={narrow ? () => setSelectedId(null) : undefined}
        />
      </section>

      <footer className="colophon">
        <span className="mono">Switchboard</span>
        <span className="mono">a stage-two build. mocked realtime, zero backend</span>
        <a className="mono" href="/guide/">how it was built</a>
      </footer>
    </main>
  );
}

function Readout({
  label, value, accent, pulse,
}: { label: string; value: string | number; accent?: string; pulse?: boolean }) {
  return (
    <div className={`readout ${pulse ? "pulse" : ""}`}>
      <span className="readout-val mono" style={accent ? { color: accent } : undefined}>{value}</span>
      <span className="readout-label eyebrow">{label}</span>
    </div>
  );
}

function BoardSkeleton({ label }: { label: string }) {
  return (
    <div className="board-skel" aria-live="polite" aria-label={label}>
      <div className="skel-grid">
        {Array.from({ length: 120 }).map((_, i) => (
          <span key={i} className="skel-lamp" style={{ animationDelay: `${(i % 24) * 40}ms` }} />
        ))}
      </div>
      <p className="skel-label mono">{label}</p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <section className="list" aria-label="Loading lines" aria-busy="true">
      <div className="list-controls skel-controls" />
      <div className="scroller">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="row skel-row" style={{ top: i * 70, height: 70 }}>
            <span className="skel-bar" />
            <span className="skel-lines">
              <span className="skel-line w1" />
              <span className="skel-line w2" />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

const WORDS = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve"];
function spellCount(n: number): string {
  if (n <= 12) return WORDS[n].charAt(0).toUpperCase() + WORDS[n].slice(1);
  return String(n);
}
