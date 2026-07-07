import type { Metadata } from "next";
import Link from "next/link";
import "./guide.css";

export const metadata: Metadata = {
  title: "Switchboard: how it was built",
  description: "The reasoning behind the live conversations watch floor.",
};

const PROMPTS: { n: number; q: string; a: React.ReactNode }[] = [
  {
    n: 1,
    q: "Component structure",
    a: (
      <>
        <p>Five pieces, each owning one job:</p>
        <ul>
          <li><b>Topbar</b> reads floor totals and the connection state.</li>
          <li><b>SignalBoard</b> renders every open line as a filament on a canvas.</li>
          <li><b>ConversationList</b> filters, searches, and windows the lines.</li>
          <li><b>ConversationDetail</b> shows one transcript, the AI status, and the takeover controls.</li>
          <li><b>State views</b> (loading, dropped, empty) share the same visual language.</li>
        </ul>
        <p>The board and the list are two read models over the same store; the detail is the write surface.</p>
      </>
    ),
  },
  {
    n: 2,
    q: "State and data flow",
    a: (
      <p>
        All conversation data lives in one client store, the <code>Exchange</code>, not in React. Components subscribe
        to the slices they need through <code>useSyncExternalStore</code>: the topbar to the summary, the list to the
        ordered lines, the detail to a single line. The canvas skips React entirely and reads the store imperatively
        inside its render loop. Data flows one way: the store mutates, batches, and notifies; components read.
      </p>
    ),
  },
  {
    n: 3,
    q: "Local state vs subscribed",
    a: (
      <p>
        Subscribed to the store: the lines, their messages, the AI status, the totals. Kept local: the current filter,
        the search text, the scroll position, the reply draft, and which line is selected. The rule is that anything the
        server would own in production is subscribed; anything that is purely this operator&apos;s view is local.
      </p>
    ),
  },
  {
    n: 4,
    q: "From design to interface",
    a: (
      <>
        <p>
          I would build the token layer first (colour, type, spacing as CSS variables), then the layout skeleton with
          CSS grid at the three breakpoints, then fill components in. The one thing I check across sizes: that the two
          long, unbounded strings, the caller name and the topic, truncate cleanly and never push the layout wide. The
          list rows and the transcript are the parts most likely to break, so they get tested with the longest real data.
        </p>
      </>
    ),
  },
  {
    n: 5,
    q: "API contract",
    a: (
      <>
        <p>One line looks like this on the wire:</p>
        <pre className="wire">{`{
  id: "L-2048",
  caller: "Ines Haddad",
  channel: "voice",
  topic: "Refund on a duplicate charge",
  status: "waiting",          // thinking | replying | waiting | idle | resolved
  heldByHuman: false,
  confidence: 0.42,           // AI self-report, drives the trust meter
  startedAt: 1720384512000,
  lastAt: 1720384939000,
  waitingReason: "Refund above the AI limit",
  messages: [ { id, speaker, text, at, partial } ]
}`}</pre>
        <p>
          Status and confidence are separated on purpose: one drives colour and ordering, the other drives trust.
          <code>partial</code> on a message lets the client render a half-streamed reply without a second channel.
        </p>
      </>
    ),
  },
  {
    n: 6,
    q: "Endpoints",
    a: (
      <ul className="ep">
        <li><code>GET /conversations</code> returns paged summaries for the list. Edge case: cap the page and require a cursor so a busy client never pulls ten thousand rows at once.</li>
        <li><code>GET /conversations/&#123;id&#125;</code> returns one line with its messages. Edge case: 404 versus a resolved-but-readable line are different; return the transcript for resolved.</li>
        <li><code>GET /conversations/&#123;id&#125;/messages?after=</code> returns a message page for deep scroll. Edge case: validate <code>after</code> so a bad cursor is a 400, not a silent empty.</li>
        <li><code>POST /conversations/&#123;id&#125;/takeover</code> lets an operator claim the line. Edge case: reject if already held by someone else (409).</li>
        <li><code>WS /stream</code> is the live feed of status changes and message deltas. Edge case: send a snapshot on connect so a late joiner is not blank.</li>
      </ul>
    ),
  },
  {
    n: 7,
    q: "Performance at scale",
    a: (
      <>
        <p>Two moves, both built into this demo:</p>
        <ul>
          <li><b>Virtualise the list.</b> Only the ~20 visible rows mount, so hundreds of conversations cost the same as a screenful.</li>
          <li><b>Batch the realtime.</b> Updates are coalesced and flushed once per animation frame. Fifty deltas in one tick become one paint. Try the <i>Surge test</i> on the floor; the frame rate holds.</li>
        </ul>
        <p>Behind those: the canvas draws off React, and message arrays are paged rather than held whole.</p>
      </>
    ),
  },
  {
    n: 8,
    q: "Testing plan",
    a: (
      <ul>
        <li>Render the list with zero lines and confirm the empty state, not a blank panel.</li>
        <li>Drop the signal mid-session and confirm the floor freezes honestly and recovers on reconnect.</li>
        <li>Push a live status change and confirm the row reorders and the detail updates without a jump.</li>
        <li>Snapshot the layout at 375, 768, and 1440 and confirm no horizontal scroll and no clipped text.</li>
      </ul>
    ),
  },
  {
    n: 9,
    q: "Accessibility and trust",
    a: (
      <>
        <p>
          <b>Accessibility:</b> the board is a visual enhancement and is labelled as such; every action it offers is also
          reachable from the list, which is a real keyboard-navigable listbox with focus states. Nothing is canvas-only.
        </p>
        <p>
          <b>Trust:</b> every AI message is labelled as the assistant, never disguised as a person; the AI&apos;s own
          confidence is shown as a meter; and when it hands off, the reason is printed in plain words. The operator always
          knows what the machine did and why it stopped.
        </p>
      </>
    ),
  },
  {
    n: 10,
    q: "Risks and trade-offs",
    a: (
      <ul>
        <li><b>Realtime overwhelm.</b> A surge could thrash the UI. Handled by frame-batching and by pulling waiting lines to the top so the important ones never get buried.</li>
        <li><b>Stale-looking data on a dropped connection.</b> If the socket dies quietly, the operator trusts a frozen board. Handled by making connection state loud and freezing the board visibly rather than pretending.</li>
        <li><b>Confidence theatre.</b> A trust meter is only as honest as its source. In production I would tie it to a real model signal and audit it, not invent a number.</li>
      </ul>
    ),
  },
  {
    n: 11,
    q: "Real-time AI UI",
    a: (
      <>
        <p>
          The AI status is its own first-class field, distinct from messages, so the UI can show <i>thinking</i>,
          <i>replying</i>, and <i>holding</i> as states rather than guessing from message timing. Replies stream token by
          token with a caret, so the operator sees the machine composing in real time.
        </p>
        <p>
          To stay smooth under load: coalesce updates per frame, keep the list pinned to the bottom only when the operator
          is already there (never yank them up), and reorder gently. When many updates land at once, the board carries the
          firehose visually while the list stays calm and the waiting lines float up. What the AI is doing right now is
          always one glance away: colour on the board, a labelled status on the line, and a live trace in the detail.
        </p>
      </>
    ),
  },
];

export default function Guide() {
  return (
    <main className="guide">
      <nav className="guide-nav">
        <Link href="/" className="mono back-link">← the floor</Link>
        <span className="mono">how it was built</span>
      </nav>

      <header className="guide-hero">
        <p className="eyebrow">Switchboard stage-two build</p>
        <h1 className="display">The reasoning under the floor.</h1>
        <p className="guide-lede">
          The brief was a dashboard for live AI conversations. Rather than answer on paper, I built the floor and let it
          answer. Each prompt below points at something you can see working on the site.
        </p>
      </header>

      <section className="brief">
        <div><span className="eyebrow">Concept</span><p>A watch floor for AI-run conversations, drawn as an analog signal exchange.</p></div>
        <div><span className="eyebrow">Palette</span><p className="mono">#0B0A09, #EDE6DA, #E2600F, #E3B95B, #3E7F52, #8A4E96</p></div>
        <div><span className="eyebrow">Type</span><p>Fraunces, Space Grotesk, JetBrains Mono</p></div>
        <div><span className="eyebrow">Signature</span><p>The signal board: every line a living filament, coloured by what the AI is doing.</p></div>
        <div><span className="eyebrow">Tech</span><p>Next.js, React, a pub/sub store, a canvas board, CSS motion</p></div>
      </section>

      <ol className="prompts">
        {PROMPTS.map((p) => (
          <li key={p.n} className="prompt">
            <div className="prompt-n mono">{String(p.n).padStart(2, "0")}</div>
            <div className="prompt-body">
              <h2 className="prompt-q display">{p.q}</h2>
              <div className="prompt-a">{p.a}</div>
            </div>
          </li>
        ))}
      </ol>

      <footer className="guide-foot">
        <Link href="/" className="mono back-link">← back to the floor</Link>
      </footer>
    </main>
  );
}
