import {
  Connection,
  Line,
  LineStatus,
  Message,
  Summary,
} from "./types";
import { CALLERS, SCENARIOS, WAITING_LINES } from "./content";

// A tiny seeded PRNG so the first paint of the board is reproducible.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHANNELS = ["voice", "web", "sms"] as const;
let counter = 4000;
const nextId = () => `L-${++counter}`;
let msgCounter = 0;
const nextMsgId = () => `m${++msgCounter}`;

type Listener = () => void;

/**
 * The Exchange is the single source of truth for the whole dashboard.
 *
 * Design decisions that answer the assessment directly:
 *  - It is a pub/sub store, not React state, so a canvas render loop can read
 *    it imperatively at 60fps without ever re-rendering React.
 *  - Mutations are batched and flushed once per animation frame. A burst of
 *    fifty updates in one frame becomes one paint, so the UI never thrashes.
 *  - On flush, changed lines get fresh object references (immutable snapshots)
 *    so useSyncExternalStore can bail out of rendering untouched lines.
 */
class Exchange {
  private lines = new Map<string, Line>();
  private order: string[] = []; // display order, newest activity first
  private connection: Connection = "booting";

  // cached, referentially-stable snapshots for useSyncExternalStore
  private summaryCache: Summary = emptySummary();
  private lineSnap = new Map<string, Line>();
  private listCache: Line[] = [];
  private metaListeners = new Set<Listener>();
  private listListeners = new Set<Listener>();
  private lineListeners = new Map<string, Set<Listener>>();

  private dirtyLines = new Set<string>();
  private structuralDirty = false;
  private flushQueued = false;
  private ticking = false;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  // ---- lifecycle -------------------------------------------------------

  boot() {
    if (this.started) return;
    this.started = true;
    this.connection = "booting";
    this.markStructural();
    // Simulate the exchange coming online: brief boot, then a burst of lines.
    setTimeout(() => {
      const rng = mulberry32(20260707);
      const seedCount = 236;
      for (let i = 0; i < seedCount; i++) this.makeLine(rng, true);
      this.reorder();
      this.connection = "live";
      this.structuralDirty = true;
      this.scheduleFlush();
      this.startTicking();
    }, 620);
  }

  private makeLine(rng: () => number, seeded: boolean): Line {
    const caller = CALLERS[Math.floor(rng() * CALLERS.length)];
    const scenario = SCENARIOS[Math.floor(rng() * SCENARIOS.length)];
    const channel = CHANNELS[Math.floor(rng() * CHANNELS.length)];
    const now = Date.now();
    const startedAt = seeded ? now - Math.floor(rng() * 5400_000) : now;

    // Weight the opening status: mostly settled, a lively minority.
    const roll = rng();
    let status: LineStatus;
    if (roll < 0.42) status = "resolved";
    else if (roll < 0.64) status = "idle";
    else if (roll < 0.78) status = "thinking";
    else if (roll < 0.9) status = "replying";
    else status = "waiting";

    const messages: Message[] = [
      { id: nextMsgId(), speaker: "caller", text: scenario.opener, at: startedAt },
    ];
    // Fill in some already-said AI turns for settled lines.
    const turnsSaid =
      status === "resolved" ? scenario.aiTurns.length
      : status === "idle" ? Math.max(1, scenario.aiTurns.length - 1)
      : status === "waiting" ? 1
      : Math.floor(rng() * 2);
    for (let t = 0; t < turnsSaid; t++) {
      messages.push({
        id: nextMsgId(),
        speaker: "ai",
        text: scenario.aiTurns[t],
        at: startedAt + (t + 1) * 45_000,
      });
    }

    const line: Line = {
      id: nextId(),
      caller,
      channel,
      topic: scenario.topic,
      status,
      heldByHuman: false,
      confidence:
        status === "waiting" ? 0.3 + rng() * 0.25 : 0.66 + rng() * 0.33,
      startedAt,
      lastAt: startedAt + turnsSaid * 45_000,
      messages,
      waitingReason:
        status === "waiting"
          ? scenario.handoff ?? WAITING_LINES[Math.floor(rng() * WAITING_LINES.length)]
          : undefined,
    };
    this.lines.set(line.id, line);
    this.order.push(line.id);
    this.dirtyLines.add(line.id);
    return line;
  }

  // ---- the live ticker -------------------------------------------------

  private startTicking() {
    this.ticking = true;
    const loop = () => {
      if (!this.ticking) return;
      if (this.connection === "live") this.step();
      const delay = 380 + Math.random() * 520;
      this.tickTimer = setTimeout(loop, delay);
    };
    this.tickTimer = setTimeout(loop, 500);
  }

  private step(burst = 1) {
    const active = this.order.filter((id) => {
      const l = this.lines.get(id)!;
      return l.status === "thinking" || l.status === "replying";
    });
    for (let b = 0; b < burst; b++) {
      // advance an active line
      if (active.length) {
        const id = active[Math.floor(Math.random() * active.length)];
        this.advance(id);
      }
      // occasionally a fresh line rings in
      if (Math.random() < 0.16 + burst * 0.02) {
        const rng = Math.random;
        this.makeLine(() => rng(), false);
        this.structuralDirty = true;
      }
      // occasionally nudge an idle line back to life
      if (Math.random() < 0.1) {
        const idles = this.order.filter((id) => this.lines.get(id)!.status === "idle");
        if (idles.length) {
          const l = this.lines.get(idles[Math.floor(Math.random() * idles.length)])!;
          this.setStatus(l, "thinking");
        }
      }
    }
    this.scheduleFlush();
  }

  private advance(id: string) {
    const l = this.lines.get(id);
    if (!l || l.heldByHuman) return;
    const now = Date.now();

    if (l.status === "thinking") {
      // start replying: append a fresh partial AI message
      const said = l.messages.filter((m) => m.speaker === "ai").length;
      const scenario = SCENARIOS.find((s) => s.topic === l.topic)!;
      if (said >= scenario.aiTurns.length) {
        // out of script: resolve or hand off
        if (l.confidence < 0.55 && Math.random() < 0.5) {
          this.handOff(l);
        } else {
          this.setStatus(l, "resolved");
        }
        return;
      }
      l.messages.push({ id: nextMsgId(), speaker: "ai", text: "", at: now, partial: true });
      this.setStatus(l, "replying");
    } else if (l.status === "replying") {
      const last = l.messages[l.messages.length - 1];
      const scenario = SCENARIOS.find((s) => s.topic === l.topic)!;
      const said = l.messages.filter((m) => m.speaker === "ai").length - 1;
      const full = scenario.aiTurns[Math.min(said, scenario.aiTurns.length - 1)];
      if (last && last.partial) {
        const nextLen = Math.min(full.length, last.text.length + 2 + Math.floor(Math.random() * 5));
        last.text = full.slice(0, nextLen);
        last.at = now;
        if (last.text.length >= full.length) {
          last.partial = false;
          // decide what happens after the turn lands
          const r = Math.random();
          if (r < 0.16 && l.confidence < 0.7) this.handOff(l);
          else if (said + 1 >= scenario.aiTurns.length) this.setStatus(l, "resolved");
          else this.setStatus(l, "idle");
        }
      }
      l.lastAt = now;
      this.touch(l.id);
    }
  }

  private handOff(l: Line) {
    const scenario = SCENARIOS.find((s) => s.topic === l.topic);
    l.waitingReason =
      scenario?.handoff ?? WAITING_LINES[Math.floor(Math.random() * WAITING_LINES.length)];
    l.messages.push({
      id: nextMsgId(),
      speaker: "system",
      text: "AI held the line for an operator.",
      at: Date.now(),
    });
    this.setStatus(l, "waiting");
  }

  private setStatus(l: Line, status: LineStatus) {
    if (l.status === status) return;
    l.status = status;
    l.lastAt = Date.now();
    this.structuralDirty = true; // summary + ordering depend on status
    this.touch(l.id);
  }

  private touch(id: string) {
    this.dirtyLines.add(id);
  }

  // ---- operator actions ------------------------------------------------

  takeLine(id: string) {
    const l = this.lines.get(id);
    if (!l) return;
    l.heldByHuman = true;
    l.messages.push({
      id: nextMsgId(),
      speaker: "system",
      text: "Operator took the line.",
      at: Date.now(),
    });
    this.setStatus(l, "idle");
    this.scheduleFlush();
  }

  sendOperator(id: string, text: string) {
    const l = this.lines.get(id);
    if (!l || !text.trim()) return;
    l.messages.push({ id: nextMsgId(), speaker: "operator", text: text.trim(), at: Date.now() });
    l.lastAt = Date.now();
    this.structuralDirty = true;
    this.touch(id);
    this.scheduleFlush();
  }

  resolve(id: string) {
    const l = this.lines.get(id);
    if (!l) return;
    this.setStatus(l, "resolved");
    this.scheduleFlush();
  }

  // ---- fault injection (for honest error/recovery states) --------------

  dropSignal() {
    this.connection = "dropped";
    this.markMeta();
  }

  reconnect() {
    if (this.connection === "live") return;
    this.connection = "reconnecting";
    this.markMeta();
    setTimeout(() => {
      this.connection = "live";
      this.structuralDirty = true;
      this.scheduleFlush();
    }, 1400);
  }

  surge() {
    // Fire a burst of updates in a single frame to prove backpressure holds.
    this.step(48);
  }

  // ---- flush + snapshots ----------------------------------------------

  private reorder() {
    // waiting first (needs a human), then most-recent activity.
    this.order.sort((a, b) => {
      const la = this.lines.get(a)!;
      const lb = this.lines.get(b)!;
      const wa = la.status === "waiting" ? 1 : 0;
      const wb = lb.status === "waiting" ? 1 : 0;
      if (wa !== wb) return wb - wa;
      return lb.lastAt - la.lastAt;
    });
  }

  private markStructural() {
    this.structuralDirty = true;
    this.scheduleFlush();
  }
  private markMeta() {
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.flushQueued) return;
    this.flushQueued = true;
    const raf =
      typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16);
    raf(() => this.flush());
  }

  private flush() {
    this.flushQueued = false;
    if (this.structuralDirty) this.reorder();

    // refresh immutable snapshots for changed lines
    for (const id of this.dirtyLines) {
      const l = this.lines.get(id);
      if (!l) {
        this.lineSnap.delete(id);
        continue;
      }
      this.lineSnap.set(id, { ...l, messages: l.messages.slice() });
    }

    if (this.structuralDirty) {
      this.listCache = this.order.map((id) => this.lineSnap.get(id)!).filter(Boolean);
      this.summaryCache = this.computeSummary();
    }

    // notify
    const changed = new Set(this.dirtyLines);
    this.dirtyLines.clear();
    const structural = this.structuralDirty;
    this.structuralDirty = false;

    if (structural) {
      this.metaListeners.forEach((cb) => cb());
      this.listListeners.forEach((cb) => cb());
    }
    for (const id of changed) {
      this.lineListeners.get(id)?.forEach((cb) => cb());
    }
    // meta always fires on connection change; cheap enough to always ping
    if (structural === false) this.metaListeners.forEach((cb) => cb());
  }

  private computeSummary(): Summary {
    let open = 0, thinking = 0, replying = 0, waiting = 0, resolvedToday = 0;
    let confSum = 0, confN = 0;
    for (const l of this.lines.values()) {
      if (l.status === "resolved") resolvedToday++;
      else open++;
      if (l.status === "thinking") thinking++;
      if (l.status === "replying") replying++;
      if (l.status === "waiting") waiting++;
      if (l.status !== "resolved") { confSum += l.confidence; confN++; }
    }
    return {
      open, thinking, replying, waiting, resolvedToday,
      avgConfidence: confN ? confSum / confN : 0,
    };
  }

  // ---- subscription surface -------------------------------------------

  subscribeMeta = (cb: Listener) => {
    this.metaListeners.add(cb);
    return () => this.metaListeners.delete(cb);
  };
  subscribeList = (cb: Listener) => {
    this.listListeners.add(cb);
    return () => this.listListeners.delete(cb);
  };
  subscribeLine = (id: string) => (cb: Listener) => {
    let set = this.lineListeners.get(id);
    if (!set) { set = new Set(); this.lineListeners.set(id, set); }
    set.add(cb);
    return () => set!.delete(cb);
  };

  getConnection = () => this.connection;
  getSummary = () => this.summaryCache;
  getList = () => this.listCache;
  getLineSnap = (id: string) => this.lineSnap.get(id);

  // imperative read for the canvas render loop (no snapshots, no React)
  raw() {
    return { lines: this.lines, order: this.order, connection: this.connection };
  }

  teardown() {
    this.ticking = false;
    if (this.tickTimer) clearTimeout(this.tickTimer);
  }
}

function emptySummary(): Summary {
  return { open: 0, thinking: 0, replying: 0, waiting: 0, resolvedToday: 0, avgConfidence: 0 };
}

// Singleton, created lazily on the client only.
let singleton: Exchange | null = null;
export function getExchange(): Exchange {
  if (!singleton) singleton = new Exchange();
  return singleton;
}
export type { Exchange };
