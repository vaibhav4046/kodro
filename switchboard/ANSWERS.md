# NexCell Stage Two — a dashboard for live AI conversations

Rather than answer on paper, I built the feature and let it answer. Every point
below maps to something running in `switchboard/`. Run it with `npm install &&
npm run dev`, or read `app/guide/page.tsx` for the same notes in the product.

Assumption stated up front (per the brief): the backend does not exist yet, so I
mocked the realtime layer with an in-browser event source that streams status
changes and message deltas. The component boundaries and the API contract below
are exactly what I would build against a real FastAPI service.

---

### 1. Component structure
Five components, each owning one job:
- **Topbar** — floor totals and connection state.
- **SignalBoard** — every open line drawn as a filament on a canvas (the overview).
- **ConversationList** — filter, search, and a windowed list of lines.
- **ConversationDetail** — one transcript, the AI's live status, and the takeover controls.
- **State views** — loading, dropped, and empty, sharing one visual language.

The board and the list are two read models over the same store; the detail is the
only write surface.

### 2. State and data flow
All conversation data lives in one store (`lib/exchange.ts`), not in component
state. Components subscribe to the slice they need through `useSyncExternalStore`:
the topbar to the summary, the list to the ordered lines, the detail to a single
line. The canvas skips React and reads the store imperatively in its render loop.
Data flows one way: the store mutates, batches, and notifies; components read. In
production the store's inputs are a REST snapshot plus a WebSocket; nothing else
about the components changes.

### 3. Local state vs subscribed
Subscribed (server-owned in production): the lines, their messages, AI status,
confidence, and the totals. Local (this operator's view only): the active filter,
the search text, the scroll position, the reply draft, and which line is selected.
The rule: if the server would own it, subscribe; if it is only this tab's view,
keep it local.

### 4. From design to interface
Token layer first (colour, type, spacing as CSS variables), then the grid skeleton
at the three breakpoints, then components. The one thing I check across sizes: that
the two unbounded strings — the caller name and the topic — truncate cleanly and
never push the layout wide. Those are the fields most likely to break a data-dense
row, so they get tested with the longest real values, not short placeholders.

### 5. API contract — one line on the wire
```
{
  id: "L-2048",
  caller: "Ines Haddad",
  channel: "voice",              // voice | web | sms
  topic: "Refund on a duplicate charge",
  status: "waiting",             // thinking | replying | waiting | idle | resolved
  heldByHuman: false,
  confidence: 0.42,              // AI self-report; drives the trust meter
  startedAt: 1720384512000,
  lastAt: 1720384939000,
  waitingReason: "Refund above the AI limit",
  messages: [ { id, speaker, text, at, partial } ]
}
```
`status` and `confidence` are separate fields on purpose: one drives colour and
ordering, the other drives trust. `partial` on a message lets the client render a
half-streamed reply over the same channel, no second mechanism needed.

### 6. Endpoints
- `GET /conversations?cursor=` — paged summaries for the list. Edge: cap the page and require a cursor so a busy client cannot pull ten thousand rows at once.
- `GET /conversations/{id}` — one line with recent messages. Edge: a resolved line is readable, not a 404; return its transcript.
- `GET /conversations/{id}/messages?after=` — message page for deep scroll. Edge: validate `after`; a bad cursor is a 400, not a silent empty list.
- `POST /conversations/{id}/takeover` — operator claims the line. Edge: 409 if already held by someone else.
- `WS /stream` — live status changes and message deltas. Edge: send a snapshot on connect so a late joiner is never blank.

### 7. Performance with hundreds of conversations
Two moves, both built into the demo:
1. **Virtualise the list.** Only the ~20 visible rows mount, so hundreds of lines cost the same as a screenful.
2. **Batch the realtime.** Updates are coalesced and flushed once per animation frame; fifty deltas in one tick become one paint. The *Surge test* button fires a burst to prove the frame rate holds.

Underneath: the canvas draws off React, and message arrays are paged rather than
held whole.

### 8. Testing plan
- Render the list with zero lines and confirm the empty state, not a blank panel.
- Drop the signal mid-session and confirm the floor freezes honestly and recovers on reconnect.
- Push a live status change and confirm the row reorders and the detail updates with no jump.
- Snapshot the layout at 375, 768, and 1440 and confirm no horizontal scroll and no clipped text.

(These are the checks the included Playwright script `scripts/verify.mjs` already runs.)

### 9. Accessibility and trust
- **Accessibility:** the board is a visual enhancement and is labelled as such; every action it offers is also reachable from the list, which is a real keyboard-navigable listbox with visible focus. Nothing is canvas-only.
- **Trust:** every AI message is labelled as the assistant, never dressed up as a person; the AI's own confidence is shown as a meter; and when it hands off, the reason is printed in plain words. The operator always knows what the machine did and why it stopped.

### 10. Risks and trade-offs
- **Realtime overwhelm.** A surge could thrash the UI. Handled by frame-batching and by floating waiting lines to the top so the ones that matter never get buried.
- **Stale data on a silent disconnect.** If the socket dies quietly, the operator trusts a frozen board. Handled by making connection state loud and visibly freezing the board rather than pretending it is live.
- **Confidence theatre.** A trust meter is only as honest as its source. In production I would wire it to a real model signal and audit it, not invent a number.

### 11. Real-time AI UI (stretch)
AI status is its own first-class field, distinct from messages, so the UI shows
*thinking*, *replying*, and *holding* as states instead of guessing from message
timing. Replies stream token by token with a caret, so the operator watches the
machine compose.

Staying smooth under load: coalesce updates per frame; keep the transcript pinned
to the bottom only when the operator is already there, never yanking them up;
reorder gently. When many updates land at once, the board absorbs the firehose
visually while the list stays calm and the waiting lines rise. What the AI is doing
right now is always one glance away — colour on the board, a labelled status on the
line, and a live trace in the detail.
