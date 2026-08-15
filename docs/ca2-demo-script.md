# Kodro Demo Script (2 to 3 minutes)

A guided walkthrough that proves the academic objectives in a live demo.
Designed for a hackathon pitch, a viva, or a GitHub visitor.

## Before you start

1. Install Ollama and pull the model: `ollama pull kodro-coder:latest`
2. Launch Kodro: `python -m robolearn.web` (or run `Kodro.exe`)
3. Confirm the status bar shows "AI: online" (Ollama is up)

If Ollama is not installed, the demo still works. The assistant falls back
to a deterministic rule engine within two seconds. Say so in the demo.

## The demo (90 seconds to 3 minutes)

### Step 1: Offline proof (10 seconds)

Open the app. Point out that it launched from a single file with no
network. The onboarding screen appears: "Build a robot. Teach it. Watch
it work." Click "Skip to studio" or pick a robot type to continue.

### Step 2: Design a robot (20 seconds)

Click "Robot Lab" in the navbar. Choose "Rover" as the type. Pick an ESP32
board. Add an ultrasonic sensor. Add a 2-motor drive. Watch the live
specification update: mass 529g, top speed 1.0x, battery 113 minutes,
supported commands now include distance(). Click Save. The system
recommends the Earth terrain and explains why.

### Step 3: Program it (20 seconds)

The editor shows a short starter program. Click "Vibe" (the AI assistant).
Type: "drive forward 3 metres then turn right and beep". The local model
generates Python. Click insert. The code appears in the editor. Click Run.
The rover drives forward, turns, and beeps. The status bar shows
"Complete". The telemetry panel shows the distance travelled, battery
drained, and heading.

### Step 4: Sensor-gated behaviour (20 seconds)

Click "Vibe" again. Type: "drive forward but stop before hitting anything
using the distance sensor". The assistant generates a while loop with
distance(). Click insert, then Run. The rover drives forward and stops
before the wall. The distance sensor reading is visible in telemetry.

Now go back to Robot Lab, remove the ultrasonic sensor, and save. Try the
same prompt. The assistant refuses or warns that the distance command is
not available on this build. This proves the grounding: the assistant
cannot suggest a capability the robot does not have.

### Step 5: Self-refinement (15 seconds)

Click "Memory" in the navbar. The panel shows a reflection from the run
you just completed: "Reached the goal" or "Hit the wall" with a specific
lesson. This is the system refining itself from usage. It persists across
sessions in localStorage. No model weights were changed.

### Step 6: Validation across worlds (15 seconds)

Switch the world from the terrain selector (Earth to Mars, or City). The
3D viewport updates with a new environment. Run the same program. The
rover behaves differently on different terrain (traction affects speed and
battery drain). The telemetry shows the difference.

### Step 7: The 3D world (10 seconds)

Orbit the camera by dragging. The world has depth: buildings, traffic,
pedestrians, terrain features. The robot has natural motion: weight
transfer on acceleration, banking on turns, front-wheel steering. This is
not a flat diagram.

## What to say during the demo

Key talking points, in priority order:

1. "This runs entirely offline. No API key, no cloud, no account. The AI
   is a local model served by Ollama on localhost."
2. "The robot specification drives the simulation. Change the parts and
   the behaviour changes. The assistant is grounded in the spec."
3. "Every line of generated code runs through a deterministic safety check
   before it reaches the user. The model is not trusted alone."
4. "The system self-refines from usage through reflection memory and a
   skill library. No weight retraining. Honest system-level refinement."
5. "1,638 tests passing, 90.9 percent coverage against an 85 percent gate,
   and 180 of 180 on the interpreter conformance gate. CI runs on Linux,
   Windows and macOS; Linux and Windows gate the build, macOS is
   informational."

> Source for the numbers in line 5, checked 15 August 2026. Tests and
> coverage: [`docs/eval/test_suite.json`](eval/test_suite.json), which records
> 1639 collected, 1638 passed, 1 skipped and 90.9 percent at commit `aa174cf`
> on a clean tree. Interpreter: `node scripts/qa_interpreter.mjs`, logged in
> [`docs/eval/qa_gate_runs_2026-08-14.md`](eval/qa_gate_runs_2026-08-14.md).
> CI legs and the macOS `continue-on-error` exemption: `.github/workflows/ci.yml`
> lines 18 and 25. Re-check these before saying them out loud; the earlier
> version of this line said 851 tests, 86 percent and 47 of 47, which had
> been true once and was badly stale by August.

## What NOT to say

- "This replaces Isaac Sim / Gazebo / Webots." It does not.
- "This is production-grade robotics validation." It is a research tool.
- "The AI is always correct." It is not. The safety net exists because it
  is not.
- "This has ROS2 integration." It does not.

## Troubleshooting

- If the 3D viewport is blank: the machine may lack WebGL. The 2D view is
  the fallback. Toggle it in the terrain bar.
- If the AI panel shows "offline": Ollama is not running. Start it with
  `ollama serve` or use the deterministic fallback (it works without a
  model).
- If the rover does not move: check the console for errors. The program
  may have a syntax error. The editor highlights the active line.
