# Switchboard

**A live conversations watch floor.** Watch the machine talk. Plug in when it can't.

A single-page, animated dashboard for monitoring AI-run customer conversations in
real time: an operator sees every open line light up on a signal board, reads what
the AI is doing on each, and takes over when it hands off. Built for the NexCell
Stage Two full-stack assessment as a working feature rather than a written answer.
The reasoning behind each assessment prompt is in [`ANSWERS.md`](./ANSWERS.md) and,
in the product itself, at `/guide`.

Realtime is mocked entirely in the browser (`lib/exchange.ts`) — status changes,
streaming replies, new lines ringing in, and connection drops all happen with zero
backend and zero cost.

## Run it
```bash
npm install
npm run dev        # http://localhost:3000
```

## Build and preview the static export
```bash
npm run build      # emits ./out (Next.js static export)
npm run serve      # serves ./out at http://localhost:4321
```

## Deploy
The build is a plain static site (`output: "export"`), so it drops onto any free
host unchanged:
```bash
npm i -g vercel
vercel deploy --prebuilt --prod    # after `next build`
# or point Vercel/GitHub Pages/Netlify at the ./out directory
```
> This build was verified in a real browser (Playwright, `scripts/verify.mjs`) at
> 375 / 768 / 1440 with zero console errors. It was not deployed to Vercel from the
> build environment because no Vercel credentials were available there; the export
> is deploy-ready as-is.

## What to try
- **Take the line** on a holding conversation, then type a reply as the operator.
- **Surge test** fires ~50 updates in one frame — the frame rate holds (batched per animation frame).
- **Cut signal** freezes the board honestly and shows the dropped state; **Restore** reconnects.
- Filter and search the list; hover and click filaments on the board.
- Resize to 375px, or toggle `prefers-reduced-motion` for the static fallback.

## Structure
```
app/
  page.tsx          the floor: topbar, hero + board, list + detail
  guide/page.tsx    /guide — how it was built, answering the 11 prompts
  globals.css       design tokens, grain, custom cursor
  ui.css            component styles
components/
  SignalBoard.tsx   the signature canvas board (reads the store at 60fps, off React)
  ConversationList  virtualized, filterable, keyboard-navigable listbox
  ConversationDetail transcript, live AI status, streaming, takeover, trust meter
  Waveform.tsx      the AI's live status trace
  Cursor.tsx        custom signal cursor (fine pointers only)
lib/
  exchange.ts       the mock realtime store: batched, rAF-flushed pub/sub
  store.ts          useSyncExternalStore hooks
  content.ts        hand-written conversation scenarios
  types.ts format.ts
scripts/verify.mjs  Playwright screenshots + console check at 3 breakpoints
```

## Stack
Next.js 14 (App Router, static export), React 18, TypeScript, canvas, and CSS
custom properties. Fonts: Fraunces, Space Grotesk, JetBrains Mono (self-hosted via
`next/font`). No paid APIs, no external image assets.
