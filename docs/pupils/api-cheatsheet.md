# Pupil API cheatsheet

Every function you can call from your pupil code lives in the single module
`robolearn.rover_api`. The full table lands in Task 2 of the build plan
along with the implementation; the names and signatures below are final.

## Driving

| Function | What it does |
| --- | --- |
| `move_forward(distance)` | Drive forward by `distance` metres. |
| `move_backward(distance)` | Drive backward by `distance` metres. |
| `turn_left(angle_deg)` | Turn `angle_deg` degrees to the left. |
| `turn_right(angle_deg)` | Turn `angle_deg` degrees to the right. |
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

## Acting

| Function | What it does |
| --- | --- |
| `collect_sample()` | Picks up a nearby sample; returns `True` on success. |
| `drop_sample()` | Drops a held sample; returns `True` on success. |
| `beep(times=1)` | Plays an audible cue. |
| `log(message)` | Prints `message` to the simulator console. |
