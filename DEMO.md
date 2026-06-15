# Run the Kodro demo

One command. No build, no account, no network. The app is pre-compiled.

## Windows

Double-click **`run-demo.cmd`**, or in a terminal:

```
python scripts\demo.py
```

## macOS / Linux

```
python3 scripts/demo.py
```

It serves the studio on **http://localhost:8080** and opens your browser there.
If 8080 is busy it walks to the next free port and prints the URL. Change it
with `KODRO_PORT`:

```
KODRO_PORT=3000 python scripts/demo.py
```

## What you will see

1. A first-run landing: "Design a robot. Program it. Watch it work."
2. Pick a robot. The assistant recommends the world that suits it: a self
   driving car gets the City with traffic and a crossing, a rover gets open
   terrain, a home robot gets a furnished Room.
3. The studio: a code editor on the left, the 3D world in the middle (orbit it
   360 degrees), and live telemetry on the right.
4. Press **Run**. The robot drives with weight transfer, banking and
   suspension. Build it wrong (no range sensor, too heavy) and it visibly fails,
   and the Design Check tells you why and what part to add.

## If the browser does not open

Open the printed URL yourself. If the page is blank, the bundle was not built;
run `node scripts/build_web.cjs` once, then re-run the demo.
