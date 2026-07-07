"use client";

import { useEffect, useRef, useState } from "react";
import { useExchange, useLine } from "@/lib/store";
import { STATUS_META, ago, clock } from "@/lib/format";
import Waveform from "./Waveform";
import { Speaker } from "@/lib/types";

const SPEAKER_LABEL: Record<Speaker, string> = {
  ai: "Assistant",
  caller: "Caller",
  operator: "You",
  system: "System",
};

export default function ConversationDetail({
  id,
  onClose,
  now,
}: {
  id: string | null;
  onClose?: () => void;
  now: number;
}) {
  const line = useLine(id);
  const ex = useExchange();
  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const [draft, setDraft] = useState("");
  const msgCount = line?.messages.length ?? 0;

  useEffect(() => { setPinned(true); }, [id]);

  useEffect(() => {
    const el = scroller.current;
    if (el && pinned) el.scrollTop = el.scrollHeight;
  }, [msgCount, pinned, line?.messages[msgCount - 1]?.text]);

  if (!id || !line) {
    return (
      <section className="detail detail-blank" aria-live="polite">
        <div className="blank-inner">
          <p className="eyebrow">No line open</p>
          <p className="display blank-head">Pick a line to listen in.</p>
          <p className="blank-body">
            Tap a filament on the board, or choose a caller from the list. Holding
            lines are pulled to the top; they are the ones waiting on you.
          </p>
        </div>
      </section>
    );
  }

  const meta = STATUS_META[line.status];
  const active = line.status === "thinking" || line.status === "replying";
  const conf = Math.round(line.confidence * 100);
  const confColor =
    line.confidence > 0.75 ? "var(--moss)" : line.confidence > 0.5 ? "var(--brass)" : "var(--ember)";

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setPinned(nearBottom);
  };

  return (
    <section className="detail" aria-label={`Conversation with ${line.caller}`}>
      <header className="detail-head">
        <div className="detail-head-row">
          {onClose && (
            <button className="back" onClick={onClose} aria-label="Back to the list">←</button>
          )}
          <div className="detail-id mono">{line.id}</div>
          <span className={`pill ${line.status}`} style={{ color: meta.color }}>
            <span className="pill-dot" style={{ background: meta.color }} />
            {line.heldByHuman ? "You have the line" : meta.label}
          </span>
          <div className="detail-channel mono">{line.channel}</div>
        </div>
        <h2 className="display detail-caller">{line.caller}</h2>
        <p className="detail-topic">{line.topic}</p>

        <div className="detail-signal">
          <Waveform status={line.status} />
          <div className="trust">
            <div className="trust-conf">
              <span className="eyebrow">AI confidence</span>
              <div className="meter" role="meter" aria-valuenow={conf} aria-valuemin={0} aria-valuemax={100} aria-label="AI confidence">
                <span className="meter-fill" style={{ width: `${conf}%`, background: confColor }} />
              </div>
              <span className="mono trust-pct" style={{ color: confColor }}>{conf}%</span>
            </div>
            {line.status === "waiting" && line.waitingReason && (
              <p className="trust-hold mono">Holding because: {line.waitingReason}</p>
            )}
          </div>
        </div>
      </header>

      <div className="transcript" ref={scroller} onScroll={onScroll} tabIndex={0} aria-live="polite" aria-label="Transcript">
        {line.messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.speaker}`}>
            <div className="msg-meta mono">
              <span className="msg-who">{SPEAKER_LABEL[m.speaker]}</span>
              <span className="msg-time">{clock(m.at)}</span>
            </div>
            <p className="msg-text">
              {m.text}
              {m.partial && <span className="caret" aria-hidden />}
            </p>
          </div>
        ))}
        {line.status === "thinking" && (
          <div className="msg msg-ai composing">
            <div className="msg-meta mono"><span className="msg-who">Assistant</span></div>
            <p className="msg-text composing-dots"><span /><span /><span /></p>
          </div>
        )}
      </div>

      {!pinned && (
        <button className="jump mono" onClick={() => { setPinned(true); }}>
          Newer messages ↓
        </button>
      )}

      <footer className="detail-actions">
        {!line.heldByHuman && line.status !== "resolved" && (
          <button className="act act-take" onClick={() => ex.takeLine(line.id)}>
            Take the line
          </button>
        )}
        {line.heldByHuman && line.status !== "resolved" && (
          <form
            className="reply"
            onSubmit={(e) => { e.preventDefault(); ex.sendOperator(line.id, draft); setDraft(""); }}
          >
            <input
              className="reply-input"
              placeholder="Type as the operator, then send"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Your reply"
            />
            <button className="act act-send" type="submit" disabled={!draft.trim()}>Send</button>
          </form>
        )}
        {line.status !== "resolved" && (
          <button className="act act-close" onClick={() => ex.resolve(line.id)}>
            Mark closed
          </button>
        )}
        {line.status === "resolved" && (
          <p className="resolved-note mono">
            Closed {ago(line.lastAt, now)} ago. {line.messages.length} messages on record.
          </p>
        )}
      </footer>
    </section>
  );
}
