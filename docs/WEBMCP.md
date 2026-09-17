# WebMCP site tools (read-only, v1)

Kodro exposes its live workspace to a compatible agent through the
official site-tools surface when the browser offers it, and does nothing
everywhere else. Implementation: `src/kodro/assets/web/webmcp-tools.js`
(loaded after `bundle.js`, precached by the service worker).

## Tools

All three carry `annotations: { readOnlyHint: true }` and take no inputs.
Every nullable leaf is `{ value }` or `{ value: null, reason }`; nothing
is ever guessed.

| Tool | Reads | From |
|---|---|---|
| `kodro_get_workspace` | world prefs, selected lesson, robot spec, editor source, tool list | localStorage, `#lesson-select`, `getKodroRobot()`, `KODRO_LIVE_CODE` |
| `kodro_get_run_evidence` | latest run report scalars (score, verdict, collisions, distance) or `{ ran: false, reason }` | `KodroRunReports.list()` |
| `kodro_get_capabilities` | tool list, `stateChanges: 'none in this module version'`, which live bridges exist | feature probes |

## Safety properties (gated by `scripts/qa_webmcp.mjs`, 23 checks)

- No fetch, no endpoints, no secret fields, no storage access beyond
  `getItem` reads, no mutation surface of any kind.
- Unsupported browsers register zero tools and behave exactly as before.
- Double registration cannot duplicate tools; failing descriptors do not
  block the rest; tool errors return `{ ok: false, reason }`, never throw.
- Canonical lessons cannot be reached: the module has no write path at
  all, and the MCP/Python side serves the bundled curriculum read-only.

## Support matrix (honest)

- Verified: fake-registry contract (23/23), inert load in headless Chrome,
  offline/network guards, bundle freshness, full Python suite.
- **Not verified: a real ChatGPT desktop/Codex session discovering these
  tools.** That check needs a supported client, an eligible account, and a
  human operator (see master prompt §47). Until it happens, no page, doc,
  or demo may claim Codex operates Kodro live. The fake registry is test
  infrastructure, never demo footage.

## Roadmap (post-launch, each needs its own gate)

Program/robot/scene mutation with workspace versioning, stale-write
rejection, checkpoints/undo, and an activity timeline — then a real
supported-client verification before any "works with Codex" claim.
