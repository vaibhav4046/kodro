# Director notes

## The default I discarded
The obvious build for "a dashboard for live AI conversations": a dark SaaS shell,
left sidebar nav, three KPI cards across the top, a conversations table, a chat
panel on the right, indigo accents, Inter everywhere, small coloured-dot status
badges. Competent and completely forgettable. Killed on sight.

## The world I committed to: Switchboard
A watch floor for AI-run conversations, drawn as an analog signal exchange. The
client is an operator watching lines light up across a board, reading each line's
signal, and plugging in to take over when the machine can't.

Thesis: **Watch the machine talk. Plug in when it can't.**

The one risk: rendering a data dashboard as a physical instrument panel — a live
canvas board of glowing filament-lamps as the hero, in warm brass/ember/espresso
instead of the expected cool SaaS blue. Justified because the product is literally
about *watching signals and stepping in*, so the instrument metaphor makes status
legible at a glance and gives the AI's "thinking" an honest, physical presence.

## Token plan
- **Colour:** #0B0A09 base, #14110E / #1D1813 panels, #EDE6DA bone text, #C7BBA9 / #8A7C68 muted. Signals: #E2600F ember (replying), #E3B95B brass (thinking), #8A4E96 plum (waiting on a human), #3E7F52 moss (resolved). Every colour carries one meaning; none is decoration.
- **Type:** Fraunces (display, editorial serif) / Space Grotesk (UI) / JetBrains Mono (data, timestamps, ids).
- **Signature:** the signal board — every open line a living filament, colour = status, brightness = recency, with a slow refresh sweep.

## Ideas tried and rejected
- **Numbered 01/02/03 section markers** on the guide — cut, they are on the blocklist and the content is not a sequence.
- **A middle-dot separator** in the readouts and eyebrows — removed everywhere; it is an AI tell.
- **Three KPI cards** — replaced by the inline mono readouts in the topbar, which read like an instrument, not a template.
- **Lenis smooth-scroll** — deliberately not used. Scroll-hijacking a data dashboard hurts the people who rely on it; native scroll is the right call here.
- **Hiding the native cursor globally** — kept it visible in inputs (text caret) and disabled the custom cursor entirely on touch and reduced-motion so it never becomes a liability.
- **Reordering board lamps by activity** — rejected; lamps are pinned to a stable slot by line id so the board never reshuffles under the eye. New lines appear at the trailing edge.

## Deviations from the brief, stated
- **No Three.js / GSAP.** The signature is a hand-written canvas signal field and CSS-driven motion. Three.js would have been weight without payoff for a 2D instrument board, and the realtime store already carries the "spectacle" (streaming, surge, the living board). Everything is still generated in code, zero paid assets.
- **No Vercel deploy from this environment.** No Vercel credentials are available here, so I built the static export and verified it in a real browser via Playwright instead. `next build` produces `out/`, which deploys to Vercel (or any static host) unchanged. See README.
