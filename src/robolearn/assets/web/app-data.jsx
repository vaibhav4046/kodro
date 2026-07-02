/* Pure, module-level data extracted from app.jsx (zero React, zero state).
 *
 * These are plain data tables the App component reads at runtime:
 *   - EXAMPLES    the starter/example program strings shown as editor tabs
 *   - LED_COLORS  the rover LED colour swatches
 *
 * They contain no React, no hooks, no component state, and no props, so they
 * live in their own IIFE module and are exposed on window for app.jsx to pull
 * off. Keeping them here shrinks the App component file without changing any
 * behaviour: app.jsx reads window.KodroExamples / window.KodroLedColors and
 * uses them exactly as before.
 *
 * Exposed as window.KodroExamples and window.KodroLedColors.
 */
(function () {
  // ---------------- example programs ----------------
  const EXAMPLES = {
    basecamp: {
      label: 'basecamp.py',
      code: `# BASE CAMP - your code BUILDS the world.
# place(kind) plants a prop right where the rover stands:
# "flag", "beacon", "person", "tree", "rock", "crate".
set_speed(80)
pen_down()
say("Building base camp")

# Mark the centre of camp with a beacon.
place("beacon")

# Drive a square and drop a crate at every corner.
for corner in range(4):
    move_forward(2)
    place("crate")
    turn_right(90)

# Plant a flag line out front.
turn_right(45)
for i in range(3):
    move_forward(1.2)
    place("flag")

# The crew arrives.
move_forward(1.5)
place("person")
turn_left(90)
move_forward(1)
place("person")

# A bit of landscaping.
turn_left(135)
move_forward(2.5)
place("tree")
move_forward(1)
place("rock")

led("green")
say("Camp ready!")
print("Base camp built: 1 beacon, 4 crates, 3 flags, 2 crew, 1 tree, 1 rock")`
    },
    autopilot: {
      label: 'autopilot.py',
      code: `# AUTOPILOT - the rover drives itself, like a self-driving car.
# Every step it reads its range sensor. It ONLY moves forward when the
# way is clear, so it can never hit a boulder OR the arena wall. When
# something looms it scans, probes left + right, and steers toward
# the side with more room. Pure sense-think-act. Press Run and watch.
set_speed(72)
pen_down()
led("cyan")
say("Autopilot engaged")

legs = 0
dodges = 0
scans = 0
steps = 0

# Self-drive: it only moves forward when the range sensor says the way is
# clear, so it can never hit a boulder OR the arena wall. Whenever something
# looms it scans, probes left + right, and steers toward the side with more
# room - so it roams the whole field, dodging as it goes. Always terminates.
while legs < 60 and steps < 220:
    steps = steps + 1
    ahead = distance()

    if ahead < 150:
        # Boulder or wall ahead: scan, sense both sides, steer clear.
        led("amber")
        scan()
        scans = scans + 1
        turn_left(60)
        left = distance()
        turn_right(120)
        right = distance()
        if left > right:
            turn_left(150)
        else:
            turn_left(25)
        dodges = dodges + 1
        led("cyan")
    else:
        move_forward(0.4)
        legs = legs + 1

led("green")
say("Area mapped")
print("Legs driven:", legs)
print("Boulders dodged:", dodges)
print("Range scans:", scans)`
    },
    drive: {
      label: 'starter.py',
      code: `# Welcome to Kodro.
# Edit freely, then press Run. The API is listed below.
set_speed(60)
pen_down()

move_forward(2)
turn_left(90)
move_forward(1.4)
say("Hello, terrain")`
    },
    square: {
      label: 'square.py',
      code: `# A for-loop draws a square. Change the 4 or the 3.
pen_down()
set_speed(75)

for side in range(4):
    move_forward(3)
    turn_right(90)

print("Square complete.")`
    },
    spiral: {
      label: 'spiral.py',
      code: `# Variables + loops make an expanding spiral.
pen_down()
set_speed(85)

step = 0.4
for i in range(20):
    move_forward(step)
    turn_right(42)
    step = step + 0.2

print("Drew", i + 1, "segments.")`
    },
    avoid: {
      label: 'avoid.py',
      code: `# Obstacle avoidance: read the range sensor, branch with if/else.
set_speed(80)
pen_down()

trips = 0
while trips < 30:
    front = distance()
    if front < 150:
        turn_right(55)
    else:
        move_forward(0.8)
    trips = trips + 1

print("Finished after", trips, "moves.")`
    },
    encore: {
      label: 'encore.py',
      code: `# ENCORE - a five-act robot performance.
# The flagship showcase: functions, loops, nested loops, counters,
# pen geometry and an honest battery report, all on the base command
# set so it runs on EVERY build. Press Run and enjoy the show.
#
#   Act I    Walk-on: a strut square with a spotlight spin per corner
#   Act II   Drumline: beeps, shimmies and a light chase
#   Act III  Petal sweep: four out-and-back petals around centre stage
#   Act IV   Star turn: the pen draws a five-point star (turn 144)
#   Act V    Finale: bow, applause lights, and the honest numbers

set_speed(70)
pen_up()
start_charge = battery()
metres_total = 0
turns_total = 0

# ---------- the performance library ----------

def flash(flash_col):
    led(flash_col)
    wait(0.12)
    led("off")
    wait(0.08)

def drumroll(drum_n):
    drum_i = 0
    while drum_i < drum_n:
        beep(1)
        wait(0.1)
        drum_i = drum_i + 1

def strut(strut_m):
    # A confident straight walk, pen down so the stage keeps the mark.
    pen_down()
    move_forward(strut_m)
    pen_up()
    metres_total = metres_total + strut_m

def shimmy(shim_deg):
    # Wiggle in place: left, right past centre, and back to the line.
    turn_left(shim_deg)
    turn_right(2 * shim_deg)
    turn_left(shim_deg)
    turns_total = turns_total + 4 * shim_deg

def corner_pose(pose_col):
    # Hit the corner mark, light up, one full spotlight spin.
    led(pose_col)
    beep(1)
    turn_right(360)
    turns_total = turns_total + 360

def bow():
    turn_left(25)
    wait(0.2)
    turn_right(50)
    wait(0.2)
    turn_left(25)
    turns_total = turns_total + 100

# ---------- ACT I : the walk-on ----------

say("Act I: the walk-on")
print("ACT I - walk-on square, one spotlight spin per corner")
drumroll(3)
act1_corner = 0
while act1_corner < 4:
    strut(2)
    if act1_corner == 0:
        corner_pose("cyan")
    elif act1_corner == 1:
        corner_pose("amber")
    elif act1_corner == 2:
        corner_pose("green")
    else:
        corner_pose("white")
    turn_right(90)
    turns_total = turns_total + 90
    act1_corner = act1_corner + 1
led("off")
print("  square closed, back on the start mark")

# ---------- ACT II : drumline ----------

say("Act II: drumline")
print("ACT II - drumline: beat patterns and a light chase")
for drum_bar in range(3):
    drumroll(2 + drum_bar)
    shimmy(20 + 10 * drum_bar)
    flash("cyan")
    flash("amber")
print("  three bars played, heading true")

# ---------- ACT III : petal sweep ----------

say("Act III: petal sweep")
print("ACT III - four petals out and back around centre stage")
for petal in range(4):
    if petal == 0 or petal == 2:
        led("cyan")
    else:
        led("amber")
    strut(2)
    turn_right(180)
    turns_total = turns_total + 180
    strut(2)
    turn_right(180)
    turns_total = turns_total + 180
    beep(1)
    turn_right(90)
    turns_total = turns_total + 90
led("off")
print("  petals swept:", 4, "- centre stage regained")

# ---------- ACT IV : star turn ----------

say("Act IV: star turn")
print("ACT IV - the pen draws a five-point star (turn 144)")
drumroll(4)
led("white")
pen_down()
for star_point in range(5):
    move_forward(1.6)
    metres_total = metres_total + 1.6
    turn_right(144)
    turns_total = turns_total + 144
    beep(1)
pen_up()
led("green")
print("  star closed: 5 points, 144 degrees each, pure turtle geometry")

# ---------- ACT V : finale ----------

say("Act V: finale")
print("ACT V - finale")
shimmy(30)
bow()
for applause in range(3):
    flash("green")
    flash("cyan")
drumroll(5)
say("That is the encore!")

# ---------- the honest numbers ----------

used_charge = start_charge - battery()
print("--- ENCORE DEBRIEF ---")
print("Distance strutted:", metres_total, "m")
print("Degrees performed:", turns_total)
print("Battery used:", used_charge, "% - remaining:", battery(), "%")
if battery() > 40:
    print("Verdict: the show could run again tonight.")
else:
    print("Verdict: one show a charge - recharge before the next curtain.")`
    },
    survey: {
      label: 'survey.py',
      code: `# Sensors + conditionals: profile the environment.
led("amber")
scan()

g = gravity()
t = temperature()
print("Gravity:", g, "m/s^2")
print("Temperature:", t, "C")

if g < 4:
    print("Low gravity. Momentum carries far.")
else:
    print("Standard footing.")

led("green")
move_forward(2.4)
say("Survey done")`
    }
  };

  const LED_COLORS = { red: '#d06a6a', amber: '#e0b45c', green: '#7cc49b', cyan: '#5ce0d8', blue: '#aeb8e8', white: '#f5f0e4', off: null };

  // ---------------- shared run-status vocabulary ----------------
  // ONE label per run state, rendered by BOTH the mission bar and the
  // telemetry rail, so the two surfaces can never contradict each other
  // (the old telemetry DRIVING/IDLE pair read "IDLE" beside a mission bar
  // saying "Halted" after a crash -- product-coherence D11).
  const STATUS_LABELS = { idle: 'Standby', running: 'Running', paused: 'Paused', done: 'Complete', error: 'Halted' };

  // ---------------- Scratch-style block palette ----------------
  // Pure data: each entry's `code` is a stateless code-generator that only reads
  // its own argument (or none), so the whole table has zero React/component deps.
  const BLOCK_DEFS = [
    { k: 'forward', label: 'move forward', unit: 'm', val: 2, code: v => 'move_forward(' + v + ')', color: 'var(--cyan)' },
    { k: 'back', label: 'move backward', unit: 'm', val: 1, code: v => 'move_backward(' + v + ')', color: 'var(--cyan)' },
    { k: 'left', label: 'turn left', unit: '°', val: 90, code: v => 'turn_left(' + v + ')', color: 'var(--warning)' },
    { k: 'right', label: 'turn right', unit: '°', val: 90, code: v => 'turn_right(' + v + ')', color: 'var(--warning)' },
    { k: 'beep', label: 'beep', code: () => 'beep(1)', color: 'var(--brass)' },
    { k: 'say', label: 'say hello', code: () => 'say("hello")', color: 'var(--brass)' },
    { k: 'led', label: 'LED cyan', code: () => 'led("cyan")', color: 'var(--brass)' },
    { k: 'scan', label: 'scan', requires: 'scan', code: () => 'scan()', color: 'var(--success)' },
    { k: 'collect', label: 'collect sample', code: () => 'collect_sample()', color: 'var(--success)' },
    { k: 'drop', label: 'drop sample', code: () => 'drop_sample()', color: 'var(--success)' },
    { k: 'speed', label: 'set speed', unit: '%', val: 60, code: v => 'set_speed(' + v + ')', color: 'var(--cyan)' },
    { k: 'wait', label: 'wait', unit: 's', val: 1, code: v => 'wait(' + v + ')', color: 'var(--cyan)' },
    { k: 'pendown', label: 'pen down', code: () => 'pen_down()', color: 'var(--brass)' },
    { k: 'penup', label: 'pen up', code: () => 'pen_up()', color: 'var(--brass)' },
    { k: 'repeat', label: 'repeat', unit: '×', val: 4, container: true, code: v => 'for i in range(' + v + '):', color: 'var(--mars)' },
    { k: 'ifobs', label: 'if obstacle ahead', container: true, requires: 'distance', code: () => 'if obstacle_ahead():', color: 'var(--mars)' },
  ];

  // ---------------- misc pure literals ----------------
  // Default viewport tweak values (a plain literal object) and the brand-mark
  // SVG markup string. Both are static data with no component dependencies.
  const TWEAK_DEFAULTS = { zoom: 1, tilt: 46, grid: true, ambientFx: true, trail: 'terrain' };

  const ORBIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="21" stroke="currentColor" stroke-width="2.4" opacity="0.2"></circle>
    <path d="M15 44 A21 21 0 1 1 44 15" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" opacity="0.9"></path>
    <circle cx="15" cy="44" r="2.6" fill="currentColor" opacity="0.45"></circle>
    <circle cx="44" cy="15" r="6.4" fill="currentColor"></circle>
  </svg>`;

  if (typeof window !== 'undefined') {
    window.KodroExamples = EXAMPLES;
    window.KodroLedColors = LED_COLORS;
    window.KodroStatusLabels = STATUS_LABELS;
    window.KodroBlockDefs = BLOCK_DEFS;
    window.KodroTweakDefaults = TWEAK_DEFAULTS;
    window.KodroOrbitSvg = ORBIT_SVG;
  }
})();
