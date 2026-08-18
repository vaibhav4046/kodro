# Kodro product direction, July 2026

## Product promise

Kodro helps a beginner move from an idea for a low cost wheeled robot to a first
prototype plan without paying for a cloud subscription. The shortest useful
journey is:

1. **Design:** describe the purpose, choose compatible capabilities, and inspect
   the resulting robot specification.
2. **Prove:** program the robot, run repeatable scenarios, and keep an evidence
   report containing assumptions, outcomes, and seeds.
3. **Build:** export a concept bill of materials and prototype brief, verify exact
   parts against original datasheets, assemble safely, measure the physical
   result, and feed those measurements back into the design.

The companion supports this journey. It is not the product by itself. Direct
robot and world actions must continue to work without a language model.

## Evidence boundary

Kodro reduces uncertainty before a first prototype. It does not certify a robot,
predict every real world hazard, or create a same to same digital twin. Simulation
results apply only to modelled variables and assumptions listed in the run report.
Unmodelled friction, manufacturing variation, electrical noise, sensor placement,
thermal limits, weather, terrain, and human behaviour remain untested until they
are measured.

The hosted browser build currently provides deterministic design, simulation,
local evidence, and a concept prototype brief. Supplier research, exact electrical
compatibility, current prices, wiring diagrams, and purchase readiness are not yet
verified and are labelled accordingly. No order is placed and no supplier is
contacted.

## Market position

Kodro should not imitate a professional simulator by adding more controls. Its
defensible position is an offline first, beginner friendly bridge between an idea
and a calibrated first prototype.

Professional tools remain the appropriate destination when a project needs their
depth:

- [Webots](https://cyberbotics.com/doc/guide/introduction-to-webots) provides a
  mature robotics simulation environment and documented physics.
- [Gazebo Sim](https://gazebosim.org/libs/sim/) provides a modular simulator and
  [ROS 2 integration](https://gazebosim.org/docs/latest/ros2_integration/).
- [NVIDIA Isaac Sim](https://docs.isaacsim.omniverse.nvidia.com/) provides a
  high end robotics simulation stack with substantial
  [hardware requirements](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/installation/requirements.html).
- [Wokwi](https://docs.wokwi.com/) provides browser based microcontroller and
  electronics simulation, including [ESP32](https://docs.wokwi.com/guides/esp32).
- [Cirkit Designer](https://docs.cirkitdesigner.com/getting-started/creating-your-first-circuit)
  supports circuit design workflows.
- [VEXcode VR](https://kb.vex.com/hc/en-us/articles/360041900951-Accessing-VEXcode-VR-on-Supported-Browsers)
  and [LEGO SPIKE Prime](https://education.lego.com/en-us/products/lego-education-spike-prime-set/45678/)
  provide structured education ecosystems.

Kodro's practical interoperability target is a clean Webots export and a
source cited build handoff, not a larger collection of decorative worlds.

## Local companion architecture

Local operation removes per token API billing, but it does not create unlimited
tokens. Context length, memory, latency, electrical power, and hardware remain
finite. Long term project knowledge should therefore live in a local project
database, versioned documents, retrieval, and short verified summaries rather
than an ever growing prompt.

The preferred adapter is provider neutral and supports Ollama plus an
OpenAI compatible local endpoint. A device benchmark should select the model:

- [Qwen3.5 4B or 9B](https://ollama.com/library/qwen3.5) is the current default
  family, with 4B as the lower memory fallback and 9B where the device can sustain
  acceptable latency. The [Qwen3.5 9B model card](https://huggingface.co/Qwen/Qwen3.5-9B)
  is the authoritative capability and licence reference.
- Gemma, Llama, and DeepSeek derived local models remain optional adapters after
  licence, memory, and task quality checks. No single model is described as
  universally best.

The companion has two explicit research modes:

1. **Offline:** the local model searches only a versioned local corpus of
   datasheets, safety notes, and project evidence. Retrieval can use local
   [Ollama embeddings](https://ollama.com/blog/embedding-models).
2. **Connected, opt in:** a user initiated search uses a provider such as a
   self hosted [SearXNG instance](https://docs.searxng.org/own-instance.html),
   prioritises manufacturer datasheets, and records URL, publication or access
   date, part identifier, region, currency, and price timestamp.

Connected research is never described as offline. Search results are untrusted
inputs until deterministic compatibility and safety checks pass.

## Product priorities

### Shipped in the current browser redesign

- One persistent Design, Prove, Build journey.
- One Companion entry point with create, explain, and review modes.
- A compact world picker and a collapsed Test conditions control.
- A simplified Robot Lab with measured parts and exports under an advanced menu.
- A hosted Build stage with a deterministic concept bill of materials, evidence
  boundary, safe prototype sequence, and downloadable local brief.
- A twenty-four lesson library and a readable local teacher progress dashboard.

### Next engineering milestones

1. Deterministic voltage, logic level, peak current, motor driver, connector, and
   battery checks, each with a machine readable reason and test.
2. A versioned component catalogue backed by manufacturer sources and access dates.
3. Evidence rail in Prove: scenario, seed, pass criteria, observed values,
   honoured variables, approximations, and unmodelled variables in one place.
4. Physical calibration loop for measured speed, current, wheel slip, and sensor
   error, followed by automatic reruns of the same scenario set.
5. Webots export plus round trip fixtures for geometry, sensors, actuators, and
   controller code.
6. Opt in connected sourcing with citations, region aware prices, alternatives,
   and an explicit human approval step before any external action.

## Performance target

The product targets a stable 60 frames per second on capable devices and a
graceful 30 frames per second fallback on lower end hardware. A claim of 240
frames per second across all devices would be untestable and misleading. Every
release records the browser, operating system, viewport, scene, quality setting,
hardware class, sampling duration, median frame time, and slow frame percentage.

## Success measures

The product should be judged by concrete outcomes rather than visual feature
count:

- a new user reaches the first meaningful run without external help;
- the user can explain which assumptions make a run result valid;
- the exported prototype brief lists unresolved purchasing and safety checks;
- a measured physical prototype can update the model and rerun the same evidence;
- no AI generated code, part claim, or source is silently accepted;
- the core journey remains usable with networking and the local model disabled.
