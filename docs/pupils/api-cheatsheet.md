# Pupil API cheatsheet

These are the 24 functions in the graded Python lesson API,
`robolearn.rover_api`. The web editor can also show shorter fitted commands
under its command strip.

Inside a lesson these commands act on the lesson's own world, and that is
the run you are marked on. `read_distance()` and the other sensors report in
the units shown beside each value below.

## Driving

| Function | What it does |
| --- | --- |
| `move_forward(distance)` | Drive forward by `distance` metres. |
| `move_backward(distance)` | Drive backward by `distance` metres. |
| `turn_left(angle_deg)` | Turn `angle_deg` degrees to the left. |
| `turn_right(angle_deg)` | Turn `angle_deg` degrees to the right. |
| `set_speed(percent)` | Set drive speed as a percentage, clamped to 0-100. |
| `wait(seconds)` | Pause for `seconds` seconds of simulated time. |

## Sensing

| Function | What it returns |
| --- | --- |
| `read_distance()` | Distance to the nearest obstacle ahead, in metres. |
| `read_colour()` | The `(red, green, blue)` colour beneath the rover. |
| `read_heading()` | Current heading in degrees (0 = east). |
| `read_battery()` | Battery percentage, 0–100. |
| `obstacle_ahead(threshold_m=0.5)` | `True` if something is in the way. |
| `sample_detected(radius_m=0.3)` | `True` if a collectible sample is nearby. |
| `at_base()` | `True` if the rover is on the base tile. |
| `scan()` | Sweep the surroundings with a radar ping. Visual only; it returns nothing, so read the distance with `read_distance()`. |

## Acting

| Function | What it does |
| --- | --- |
| `collect_sample()` | Picks up a nearby sample; returns `True` on success. |
| `drop_sample()` | Drops a held sample; returns `True` on success. |
| `beep(times=1)` | Plays an audible cue. |
| `log(message)` | Prints `message` to the simulator console. |
| `say(message)` | Shows a short speech bubble above the rover. A friendlier `log`. |
| `led(colour="cyan")` | Lights the rover's status LED. Visual cue only. |

## Drawing and props

| Function | What it does |
| --- | --- |
| `pen_down()` | Lower the trail pen so the rover draws its path as it drives. |
| `pen_up()` | Lift the trail pen so the rover stops drawing. |
| `place(kind="flag", x=None, y=None)` | Place a visual prop in the world: a flag, beacon, rock, tree, person or crate. Props do not collide. Defaults to where the rover is standing. |
| `clear_props()` | Remove every prop you placed with `place`. A lesson's own flags stay. |
