"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useList } from "@/lib/store";
import { ago, STATUS_META } from "@/lib/format";
import { LineStatus } from "@/lib/types";

const ROW = 70;
const OVERSCAN = 6;

const FILTERS: { key: "all" | LineStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Holding" },
  { key: "replying", label: "Live" },
  { key: "thinking", label: "Composing" },
  { key: "idle", label: "Open" },
  { key: "resolved", label: "Closed" },
];

export default function ConversationList({
  selectedId,
  onSelect,
  now,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
}) {
  const lines = useList();
  const [filter, setFilter] = useState<"all" | LineStatus>("all");
  const [query, setQuery] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);
  const scroller = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lines.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      return (
        l.caller.toLowerCase().includes(q) ||
        l.topic.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
      );
    });
  }, [lines, filter, query]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const total = filtered.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const end = Math.min(total, Math.ceil((scrollTop + height) / ROW) + OVERSCAN);
  const visible = filtered.slice(start, end);

  const onScroll = () => {
    const el = scroller.current;
    if (el) setScrollTop(el.scrollTop);
  };

  const move = (dir: 1 | -1) => {
    const idx = filtered.findIndex((l) => l.id === selectedId);
    const next = Math.min(total - 1, Math.max(0, (idx < 0 ? 0 : idx) + dir));
    const l = filtered[next];
    if (!l) return;
    onSelect(l.id);
    const el = scroller.current;
    if (el) {
      const y = next * ROW;
      if (y < el.scrollTop) el.scrollTop = y;
      else if (y + ROW > el.scrollTop + el.clientHeight) el.scrollTop = y - el.clientHeight + ROW;
    }
  };

  return (
    <section className="list" aria-label="Open lines">
      <div className="list-controls">
        <div className="filter-row" role="tablist" aria-label="Filter lines by status">
          {FILTERS.map((f) => {
            const count =
              f.key === "all" ? lines.length : lines.filter((l) => l.status === f.key).length;
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                className={`chip ${filter === f.key ? "on" : ""} ${f.key}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span className="chip-count mono">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="search">
          <input
            className="mono"
            placeholder="find a caller, topic, or line id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search lines"
          />
        </div>
      </div>

      <div
        className="scroller"
        ref={scroller}
        onScroll={onScroll}
        tabIndex={0}
        role="listbox"
        aria-label={`${total} lines`}
        aria-activedescendant={selectedId ? `row-${selectedId}` : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
          else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
        }}
      >
        {total === 0 ? (
          <div className="list-empty mono">
            No lines match. {query && "Clear the search"}{query && filter !== "all" && " or "}
            {filter !== "all" && "widen the filter"}.
          </div>
        ) : (
          <div style={{ height: total * ROW, position: "relative" }}>
            {visible.map((l, i) => {
              const idx = start + i;
              const meta = STATUS_META[l.status];
              const sel = l.id === selectedId;
              return (
                <button
                  key={l.id}
                  id={`row-${l.id}`}
                  role="option"
                  aria-selected={sel}
                  className={`row ${sel ? "sel" : ""} ${l.status}`}
                  style={{ top: idx * ROW, height: ROW }}
                  onClick={() => onSelect(l.id)}
                >
                  <span className="row-bar" style={{ background: meta.color }} />
                  <span className="row-main">
                    <span className="row-top">
                      <span className="row-caller">{l.caller}</span>
                      <span className="row-time mono">{ago(l.lastAt, now)}</span>
                    </span>
                    <span className="row-sub">
                      <span className="row-topic">{l.topic}</span>
                    </span>
                  </span>
                  <span className="row-meta">
                    <span className="row-id mono">{l.id}</span>
                    <span className="row-status mono" style={{ color: meta.color }}>
                      {l.heldByHuman ? "YOURS" : meta.short}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
