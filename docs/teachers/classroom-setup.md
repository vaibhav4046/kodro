# Classroom setup

Kodro runs entirely on each machine. There is no server to install, no account
to create and no network requirement after the download, so setting up a room
is copying one file and checking it starts.

## Hardware

Any machine that runs Python 3.12 is enough; a 2018-era laptop is comfortably
inside the envelope. The 3D view picks its quality tier automatically from the
machine's actual GPU on first run and steps down further if frames run slow,
so a weak integrated GPU gets the Low tier by itself. Machines with no working
graphics driver at all fall back to the 2.5D view. If a class set is slow, set
Render quality to Low in Settings once and it is remembered.

## Installing across a room

Two options, both offline once fetched:

1. **Desktop app.** Download `Kodro-windows.exe` from the releases page and
   copy it to each machine (a shared drive or USB stick is fine). It needs no
   admin rights and no installer. On machines without WebView2, use
   `robolearn-windows-tk.exe` instead; it is the same engine with a simpler
   interface. macOS uses `robolearn-macos.zip` (unzip, drag the app into
   Applications).
2. **Browser build.** Serve the static site from any local web server, or
   open the hosted copy once while online; it installs a service worker and
   keeps working offline afterwards, lessons included.

The executable is not code-signed, so Windows SmartScreen shows a warning the
first time it runs on each machine. Choose "More info", then "Run anyway".
On a managed estate your IT team can whitelist the file hash instead.

## Where pupil work lives

Everything a pupil does stays on the machine they did it on.

- **Desktop app:** progress, submissions and the concept-strength records live
  in a single SQLite file at `~/.robolearn/pupil.db`. Back up a machine by
  copying that file; restore by putting it back. Deleting it resets the
  machine to a clean state.
- **Browser build:** work lives in that browser's local storage. It survives
  reloads and offline use, but clearing site data removes it, so on shared
  machines have pupils export a project file (Settings, Save project) at the
  end of a session if they need to carry work between machines.

Custom lessons you write with the lesson editor are YAML files in
`~/.robolearn/custom_lessons/`, one file per lesson. Copy that folder to
distribute your lessons to other machines.

## The teacher dashboard

There are two of them and they are not the same. This section used to describe
only the Tk one and call it "the desktop app", which is wrong for the download
recommended above.

**In `Kodro-windows.exe` and in the browser.** More tools, then Teacher
progress. You get three summary tiles (learners, concepts practised, average
strength), the class heatmap, and a legend. There is no per-pupil drill-down
and no PDF. In the browser there are also two CSV downloads at the top of the
panel, `Download markbook (CSV)` and `Download strengths (CSV)`; those two are
browser-only, because the packaged desktop window keeps its records in the
Python database rather than in browser storage. What that window has instead is
Settings, then `Export progress report`, which writes a self-contained HTML
report next to the database and prints the path it used. That report covers the
pupil currently signed in, not the class.

**In `robolearn-windows-tk.exe`.** Press `Ctrl+Shift+T`. That shortcut exists
only in this build; pressing it in the WebView2 one does nothing. This is the
fuller dashboard: the class heatmap, a per-pupil drill-down with the pupil's
submissions and score history, and exports of the heatmap as CSV or as PDF to a
location you pick. Both exports confirm where the file was written, and say
plainly if the write failed (the usual cause is the same file already open in
Excel).

The PDF button needs `reportlab`. The released executables are built with it, so
the button works there. It is declared as a development dependency rather than a
runtime one, so a plain `pip install` from source does not pull it in; in that
case the button says the dependency is missing and writes nothing rather than
failing quietly. `pip install reportlab` fixes it.

A curriculum coverage report for all bundled lessons, mapped to the DfE
programmes of study they address, can be generated with
`python scripts/generate_curriculum_report.py` from a source checkout, or
requested from whoever manages your deployment.

## What Kodro does not do

Honest limits, so nothing here surprises you mid-lesson:

- There is no central class server: each machine holds its own records, and
  the dashboard on a machine shows the pupils who used that machine. There is
  also no whole-class export in the WebView2 build, so to combine machines
  either run the Tk build and collect its heatmap CSVs, or copy each machine's
  `pupil.db` and merge them yourself.
- The simulation is kinematic. It teaches programming and design trade-offs;
  it does not certify that a physical robot will behave identically.
- The optional AI companion uses a local model (Ollama) if one is installed,
  and otherwise falls back to built-in deterministic help. Nothing a pupil
  types leaves the machine unless you explicitly configure a cloud provider
  with your own key, and the interface says so whenever that is the case.
