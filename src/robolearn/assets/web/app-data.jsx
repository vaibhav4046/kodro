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
# Every step it reads its lidar. It ONLY moves forward when the way
# is clear, so it can never hit a boulder OR the arena wall. When
# something looms it scans, probes left + right, and steers toward
# the side with more room. Pure sense-think-act. Press Run and watch.
rover.set_speed(72)
rover.pen_down()
rover.led("cyan")
rover.say("Autopilot engaged")

legs = 0
dodges = 0
scans = 0
steps = 0

# Self-drive: it only moves forward when the lidar says the way is clear,
# so it can never hit a boulder OR the arena wall. Whenever something looms
# it scans, probes left + right, and steers toward the side with more room -
# so it roams the whole field, dodging as it goes. Always terminates.
while legs < 60 and steps < 220:
    steps = steps + 1
    ahead = rover.distance()

    if ahead < 150:
        # Boulder or wall ahead: scan, sense both sides, steer clear.
        rover.led("amber")
        rover.scan()
        scans = scans + 1
        rover.turn_left(60)
        left = rover.distance()
        rover.turn_right(120)
        right = rover.distance()
        if left > right:
            rover.turn_left(150)
        else:
            rover.turn_left(25)
        dodges = dodges + 1
        rover.led("cyan")
    else:
        rover.forward(40)
        legs = legs + 1

rover.led("green")
rover.say("Area mapped")
print("Legs driven:", legs)
print("Boulders dodged:", dodges)
print("Lidar scans:", scans)`
    },
    drive: {
      label: 'starter.py',
      code: `# Welcome to Kodro.
# Edit freely, then press Run. The API is listed below.
rover.set_speed(60)
rover.pen_down()

rover.forward(200)
rover.turn_left(90)
rover.forward(140)
rover.say("Hello, terrain")`
    },
    square: {
      label: 'square.py',
      code: `# A for-loop draws a square. Change the 4 or the 300.
rover.pen_down()
rover.set_speed(75)

for side in range(4):
    rover.forward(300)
    rover.turn_right(90)

print("Square complete.")`
    },
    spiral: {
      label: 'spiral.py',
      code: `# Variables + loops make an expanding spiral.
rover.pen_down()
rover.set_speed(85)

step = 40
for i in range(20):
    rover.forward(step)
    rover.turn_right(42)
    step = step + 20

print("Drew", i + 1, "segments.")`
    },
    avoid: {
      label: 'avoid.py',
      code: `# Obstacle avoidance: read the lidar, branch with if/else.
rover.set_speed(80)
rover.pen_down()

trips = 0
while trips < 30:
    front = rover.distance()
    if front < 150:
        rover.turn_right(55)
    else:
        rover.forward(80)
    trips = trips + 1

print("Finished after", trips, "moves.")`
    },
    survey: {
      label: 'survey.py',
      code: `# Sensors + conditionals: profile the environment.
rover.led("amber")
rover.scan()

g = rover.gravity()
t = rover.temperature()
print("Gravity:", g, "m/s^2")
print("Temperature:", t, "C")

if g < 4:
    print("Low gravity. Momentum carries far.")
else:
    print("Standard footing.")

rover.led("green")
rover.forward(240)
rover.say("Survey done")`
    }
  };

  const LED_COLORS = { red: '#d06a6a', amber: '#e0b45c', green: '#7cc49b', cyan: '#5ce0d8', blue: '#aeb8e8', white: '#f5f0e4', off: null };

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
    window.KodroBlockDefs = BLOCK_DEFS;
    window.KodroTweakDefaults = TWEAK_DEFAULTS;
    window.KodroOrbitSvg = ORBIT_SVG;
  }
})();
