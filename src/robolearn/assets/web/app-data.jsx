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
# the side with more room. Look, decide, move - over and over. Press Run and watch.
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
      code: `# Welcome to Kodro. This is your rover, and this is a little patrol show.
# Press Run and watch: it drives a square, draws its route on the ground,
# flashes a different colour at every corner, then prints a report.
# Every line is yours to edit. Change a number, press Run again.

set_speed(70)          # motor power, 0 to 100
pen_down()             # drop the pen so the route gets drawn as it drives
led("cyan")            # patrol light
say("Patrol starting")
beep(2)

legs = 0               # counts the straight legs driven
corners = 0            # counts the corners turned

# Lap one: drive a square. Each turn of the loop is one side and one corner.
for side in range(4):
    # A different colour on each side makes the lap easy to follow.
    if side == 0:
        led("cyan")
    elif side == 1:
        led("amber")
    elif side == 2:
        led("green")
    else:
        led("white")
    move_forward(1)        # one metre along this side
    legs = legs + 1
    turn_right(90)         # a square corner
    corners = corners + 1
    beep(1)

# Lap two: speed up and cut back across with a short zig-zag.
say("Zig-zag across the middle")
set_speed(90)
led("cyan")
for zig in range(3):
    move_forward(0.6)
    turn_left(45)
    move_forward(0.6)
    turn_right(45)
    legs = legs + 2

# Patrol done: slow down, ease back onto the mark, lift the pen.
say("Patrol complete - parking")
set_speed(50)
led("green")
move_backward(0.5)
pen_up()               # lift the pen, the drawing is finished

# Mission report - every number below is measured, not made up.
beep(3)
print("Legs driven:", legs)
print("Corners turned:", corners)
print("Battery left:", read_battery(), "%")
say("Report filed. Rover out.")`
    },
    systems: {
      label: 'systems.py',
      code: `# Welcome to Kodro. This build has no wheels, so instead of driving
# it runs a systems check: lights, sound, speech, and a battery report.
# Every command here works on ANY robot, so pressing Run just works.
say("Systems check starting")

# Cycle the status light a few times so you can watch the loop run.
flashes = 0
for i in range(3):
    led("cyan")
    beep(1)
    wait(1)
    led("amber")
    wait(1)
    flashes = flashes + 1

led("green")
print("Light cycles run:", flashes)
say("All lights good")

# Read a real number back from the robot and branch on it.
power = read_battery()
print("Battery at", power, "percent")
if power > 50:
    say("Power is healthy")
else:
    say("Time for a recharge")

beep(2)
say("Systems nominal. Ready when you are.")`
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
    searchlight: {
      label: 'searchlight.py',
      code: `# SEARCHLIGHT - a battery-managed survey and rescue mission.
#
# This is the product mission in one program: a robot given real work to do,
# doing it honestly. It runs a systems check, patrols the perimeter of the
# search area without ever touching a wall (every drive is guarded by the
# range sensor), then works a fan of survey spokes out from base - driving
# out, scanning and flagging, and driving straight back - so it always knows
# the way home. It watches its own battery and abandons the remaining spokes
# when the charge runs low, holding a reserve to finish. Nothing is faked: the
# distances, the scans, the battery and the return are all real.
#
#   Phase 0   Systems check: power, sensors, lights
#   Phase 1   Perimeter patrol: a guarded square sweep, back to base
#   Phase 2   Spoke survey: out-and-back legs with scan stations + flags
#   Phase 3   Battery watch: stop launching spokes when charge falls low
#   Phase 4   Return + stand down: square up and report
#   Phase 5   Debrief: the honest numbers
#
# Note on style: the helpers below drive the robot, so they are always called
# as statements (never "x = safe_forward(...)"). A motion helper used as a
# value would have its movement ignored, so the mission talks to itself
# through the module-level flags last_moved and lane_out instead.

set_speed(72)
pen_up()

# Mission counters and the flags the motion helpers write back through.
start_charge = battery()
spokes_done = 0
stations = 0
flags = 0
holds = 0
metres = 0
last_moved = 0
lane_out = 0

# ---------- the mission library ----------

def report(report_msg):
    # A status line the operator sees, spoken and printed together.
    say(report_msg)
    print(report_msg)

def signal(signal_col, signal_beeps):
    led(signal_col)
    beep(signal_beeps)

def safe_forward(safe_m):
    global holds, last_moved, metres
    # Drive forward ONLY when the range sensor says there is room, so the robot
    # can never hit the arena wall or an obstacle. Writes last_moved with the
    # metres actually driven (0 if it had to hold), keeping the odometer honest.
    ahead = distance()
    if ahead < safe_m * 100 + 45:
        holds = holds + 1
        last_moved = 0
    else:
        move_forward(safe_m)
        metres = metres + safe_m
        last_moved = safe_m

def station(station_col):
    global stations, flags
    # A survey station: face-scan, drop a flag, log the find.
    signal(station_col, 2)
    scan()
    place("flag")
    led("cyan")
    stations = stations + 1
    flags = flags + 1

def survey_out(out_m, out_steps):
    global lane_out
    # Drive OUT along a spoke, pausing at a scan station, until the lane is
    # blocked or the step budget is spent. Writes lane_out with the metres
    # actually driven out, so the return leg can retrace the same distance.
    lane_out = 0
    out_i = 0
    while out_i < out_steps:
        safe_forward(out_m)
        if last_moved == 0:
            out_i = 999
        else:
            lane_out = lane_out + last_moved
            if out_i == 1:
                station("amber")
            out_i = out_i + 1

def drive_back(back_m):
    # Turn about and retrace a measured distance back toward base, guarded.
    turn_right(180)
    back_i = 0
    while back_i < 20 and back_m > 0.05:
        hop = 1.0
        if back_m < hop:
            hop = back_m
        safe_forward(hop)
        if last_moved == 0:
            back_i = 999
        else:
            back_m = back_m - hop
            back_i = back_i + 1

# ---------- Phase 0 : systems check ----------

report("Phase 0: systems check")
led("white")
beep(1)
print("  power at", start_charge, "%")
scan()
print("  range sensor online:", distance(), "cm to the nearest wall")
print("  heading reference:", heading(), "degrees")
led("green")

# ---------- Phase 1 : perimeter patrol ----------

report("Phase 1: perimeter patrol of the search area")
led("cyan")
patrol_side = 0
while patrol_side < 4:
    side_step = 0
    while side_step < 3:
        safe_forward(1.6)
        if last_moved == 0:
            signal("amber", 1)
            side_step = 99
        else:
            side_step = side_step + 1
    turn_right(90)
    patrol_side = patrol_side + 1
print("  perimeter swept, corners turned:", patrol_side)

# ---------- Phase 2 + 3 : spoke survey with battery watch ----------

report("Phase 2: spoke survey out from base")
led("cyan")
# Six spokes fan out at 60 degrees. Each drives out, scans and flags, then
# retraces its own measured distance home - so the robot never loses base.
spoke = 0
while spoke < 6:
    charge = battery()
    # Phase 3: honest endurance. A survey spoke costs the best part of a fifth
    # of the pack, so once the charge drops below 28 percent the mission stops
    # launching new spokes and holds the reserve rather than risk stranding
    # itself. The mission judges its own endurance, not a fixed loop count.
    if charge < 28:
        report("Battery low at " + str(charge) + " percent - standing down, reserve held")
        spoke = 99
    else:
        print("  spoke", spoke + 1, "of 6 - charge", charge, "%")
        survey_out(1.3, 5)
        station("green")
        drive_back(lane_out)
        spokes_done = spokes_done + 1
        # Rotate to the next spoke bearing for the fan.
        turn_right(60)
        spoke = spoke + 1
if spoke != 99:
    print("  full survey fan completed")

# ---------- Phase 4 : return and stand down ----------

report("Phase 4: return to base and stand down")
led("amber")
# Square the heading back to the reference bearing, gently.
face = heading()
if face != 0:
    turn_left(face)
signal("green", 2)
print("  standing on the base mark, heading squared to 0")

# ---------- Phase 5 : debrief ----------

report("Phase 5: mission debrief")
used = start_charge - battery()
print("--- SEARCHLIGHT DEBRIEF ---")
print("Distance surveyed:", metres, "m")
print("Survey spokes:", spokes_done, " scan stations:", stations, " flags dropped:", flags)
print("Obstacle holds:", holds)
print("Battery used:", used, "% - remaining:", battery(), "%")
if battery() > 20:
    print("Verdict: mission complete with reserve to spare.")
elif battery() > 10:
    print("Verdict: mission complete, returned on the last of the charge.")
else:
    print("Verdict: mission cut short by battery - survey a smaller grid next time.")
led("green")
say("Searchlight mission complete")`
    },
    gauntlet: {
      label: 'gauntlet.py',
      code: `# GAUNTLET - a capability reference that draws its proof.
#
# Where Encore performs and Searchlight works a mission, Gauntlet is the
# language flexing: functions and recursion, loops and nested loops, math with
# banker's rounding and chained comparisons, lists built by concatenation, and
# a run of pen geometry - nested polygons, a star mandala and a spirograph
# rosette - that a turtle can draw with turns alone, no trigonometry needed.
# Every figure is a closed path centred on the start mark, so the pen returns
# home and the robot never wanders toward a wall. LED colour and drive speed
# change between chapters so the reference is a show as well as a checklist.
#
#   Chapter 1   Command roll-call
#   Chapter 2   Math gym: rounding, chains, min/max/abs/sqrt
#   Chapter 3   Control-flow gym: loops, nesting, recursion
#   Chapter 4   List workout: build, sum and scan a list
#   Chapter 5   Nested polygons: triangle through hexagon, shared centre
#   Chapter 6   Star mandala: five-point stars rotated around the centre
#   Chapter 7   Spirograph rosette: many small loops fanned full circle
#   Chapter 8   Curtain: honest totals

set_speed(70)
pen_up()
shapes = 0
vertices = 0

# ---------- the drawing + reporting library ----------

def banner(banner_msg):
    say(banner_msg)
    print(banner_msg)

def polygon(poly_sides, poly_m, poly_col):
    # Draw a regular polygon as a closed turtle path: exterior angle is
    # 360 / sides, so the pen comes back to where it started, heading intact.
    led(poly_col)
    pen_down()
    poly_turn = 360 / poly_sides
    poly_i = 0
    while poly_i < poly_sides:
        move_forward(poly_m)
        turn_right(poly_turn)
        poly_i = poly_i + 1
    pen_up()
    shapes = shapes + 1
    vertices = vertices + poly_sides

def star5(star_m, star_col):
    # A five-point star: turn 144 at each point closes the pentagram exactly.
    led(star_col)
    pen_down()
    star_i = 0
    while star_i < 5:
        move_forward(star_m)
        turn_right(144)
        star_i = star_i + 1
    pen_up()
    shapes = shapes + 1
    vertices = vertices + 5

def countdown(n):
    # Recursion for its own sake, and to prove the call stack works: count
    # down to lift-off, one frame per level.
    if n <= 0:
        print("  lift-off")
    else:
        print("  T minus", n)
        beep(1)
        countdown(n - 1)

# ---------- Chapter 1 : command roll-call ----------

banner("Chapter 1: command roll-call")
led("white")
beep(1)
scan()
print("  drive: move_forward / move_backward / turn_left / turn_right / set_speed")
print("  pen:   pen_down / pen_up      lights: led      sound: beep / say")
print("  sense: distance / heading / battery on this build")

# ---------- Chapter 2 : math gym ----------

banner("Chapter 2: math gym")
# Banker's rounding: halves go to the even neighbour, so 0.5 -> 0, 2.5 -> 2.
print("  round(0.5) =", round(0.5), " round(2.5) =", round(2.5), " round(3.5) =", round(3.5))
print("  round(0.125, 2) =", round(0.125, 2))
# Chained comparisons read the Python way: one band test, not two.
h = 180
if 90 < h < 270:
    print("  90 < 180 < 270 is True (chained comparison)")
print("  abs(-7) =", abs(-7), " max(3, 9, 4) =", max(3, 9, 4), " min(3, 9, 4) =", min(3, 9, 4))
print("  sqrt(144) =", sqrt(144), " 17 // 5 =", 17 // 5, " 17 % 5 =", 17 % 5)
print("  2 ** 10 =", 2 ** 10)

# ---------- Chapter 3 : control-flow gym ----------

banner("Chapter 3: control-flow gym")
# A for-loop with range, a nested loop, break and continue, then recursion.
total = 0
for i in range(6):
    total = total + i
print("  sum of range(6) =", total)
grid = 0
for row in range(3):
    for col in range(3):
        if row == col:
            continue
        grid = grid + 1
print("  off-diagonal cells in a 3x3 grid =", grid)
first_big = -1
for k in range(20):
    if k * k > 40:
        first_big = k
        break
print("  first k with k*k > 40 is", first_big)
countdown(3)

# ---------- Chapter 4 : list workout ----------

banner("Chapter 4: list workout")
# Lists grow by concatenation (xs = xs + [v]); then sum and scan them.
xs = []
for n in range(1, 6):
    xs = xs + [n * n]
print("  squares 1..5 =", xs)
list_sum = 0
biggest = 0
for v in xs:
    list_sum = list_sum + v
    if v > biggest:
        biggest = v
print("  sum =", list_sum, " biggest =", biggest, " count =", len(xs))

# ---------- Chapter 5 : nested polygons ----------

banner("Chapter 5: nested polygons on a shared centre")
set_speed(78)
# Triangle, square, pentagon, hexagon - each a closed path from the centre.
sides = 3
while sides <= 6:
    if sides == 3:
        polygon(sides, 1.2, "cyan")
    elif sides == 4:
        polygon(sides, 1.0, "amber")
    elif sides == 5:
        polygon(sides, 0.9, "green")
    else:
        polygon(sides, 0.8, "white")
    # Rotate a little between figures so they fan rather than overlap exactly.
    turn_right(15)
    sides = sides + 1
led("off")
print("  polygons drawn: triangle, square, pentagon, hexagon")

# ---------- Chapter 6 : star mandala ----------

banner("Chapter 6: star mandala")
# Battery checkpoint: the mandala is an optional flourish. If the charge has
# fallen below 40 percent, skip it and keep the reserve for the summary rather
# than risk halting mid-figure. On a full pack it always runs.
if battery() < 40:
    print("  battery low - skipping the optional mandala")
else:
    set_speed(84)
    # Four five-point stars, each rotated 90 degrees, make a mandala ring.
    mandala = 0
    while mandala < 4:
        star5(0.8, "cyan")
        turn_right(90)
        mandala = mandala + 1
    led("off")
    print("  mandala closed:", mandala, "stars at 90 degrees apart")

# ---------- Chapter 7 : spirograph rosette ----------

banner("Chapter 7: spirograph rosette")
# Battery checkpoint again: the rosette is the most expensive figure (many
# small squares, many turns), so skip it under 25 percent and go straight to
# the summary. This is the reference respecting its own power budget.
if battery() < 25:
    print("  battery low - skipping the optional rosette")
else:
    set_speed(90)
    led("amber")
    pen_down()
    # A rosette: many small squares, each nudged a few degrees round, so the
    # pen sweeps a full circle of petals and returns to the centre bearing.
    petals = 8
    petal_turn = 360 / petals
    petal = 0
    while petal < petals:
        square_side = 0
        while square_side < 4:
            move_forward(0.5)
            turn_right(90)
            square_side = square_side + 1
        turn_right(petal_turn)
        petal = petal + 1
    pen_up()
    led("green")
    shapes = shapes + 1
    vertices = vertices + petals * 4
    print("  rosette swept:", petals, "petals over a full turn")

# ---------- Chapter 8 : curtain ----------

banner("Chapter 8: the reference is complete")
beep(2)
print("--- GAUNTLET SUMMARY ---")
print("Figures drawn:", shapes, " total vertices turned:", vertices)
print("Surface exercised: functions, recursion, loops, nesting, lists, math, pen geometry, LED, speed.")
print("Battery remaining:", battery(), "%")
led("cyan")
say("Gauntlet reference complete")`
    },
    survey: {
      label: 'survey.py',
      code: `# Sensors + if/else: find out what kind of world you landed in.
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
