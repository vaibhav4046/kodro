# Kodro Market Research

## 2026-07 brutal reassessment and first MEASURED results

A second, adversarial round of web-verified research (five lenses: education
sims, research sims, LLM-for-robotics evals, hiring signal at Anthropic/Meta/
DeepMind, and revenue) reframed the project. The honest verdict:

**The one real moat.** The four-way combination of build-parameterised robot
dynamics, a grounding validator that refuses code for unfitted parts, seeded
domain-randomised validation, and a headless JSON-report CLI is not replicated
by any of the ~17 surveyed tools. Everything else (3D worlds, blocks, browser
access, realism) is a loss: incumbents already own those axes, so leading with
them reads as a weaker clone. Kodro is not a physics simulator (it is kinematic,
not rigid-body); the honest, still-valuable framing is a deterministic, seeded,
reproducible EVALUATION environment.

**The unoccupied research gap.** No public benchmark measures the INVENTED-SYMBOL
rate: an LLM emitting a program symbol outside a per-build fitted-command set,
detected by AST analysis, scored across seeded physics runs. The nearest
neighbours (RoboEval/CodeBotler, Robo-Instruct) measure an invalid ARGUMENT to a
valid primitive; general API-hallucination benchmarks (CloudAPIBench, HalluLens)
are non-robotics with no execution. Because Kodro's API is derived from the
user's build, the ground-truth valid set is per-design, a second novelty axis.

**Two credibility bombs, now fixed.** (1) The invention metric existed only in
docstrings and the CA1 study design (0 hits in src). It is now real:
`robolearn.grounding.check_grounding` plus the `kodrobench` harness. (2) The QA
counts disagreed across docs (README 869, status 21, actual 951); the README now
states the measured 950+.

### First measured KodroBench results (v0.1: 5 tasks, 10 seeds)

Generated from `results/kodrobench-v0.1.json` by `robolearn.kodrobench`, never
hand-typed. Lower invention_rate is better.

| Model | success@N | invention_rate |
|---|---|---|
| deterministic floor | 0.22 | 0.00 |
| gemma3:4b | 0.14 | 0.00 |
| llama3.2:3b | 0.00 | 0.00 |
| gemma3:1b | 0.02 | 0.00 |
| kodro-fast (fine-tune) | 0.00 | 0.60 |
| kodro-coder (fine-tune) | 0.00 | 1.00 |

The finding is honest and counter-intuitive: the LOCAL FINE-TUNES invent more
than the general models. kodro-coder emits an object-style `rover.forward()` API
on every task, a surface that does not exist (the real API is bare functions),
so it invents on 100% of tasks and its programs fail at runtime. This is a real
failure mode of the fine-tune, surfaced by the metric, reported as measured.
General models stay grounded but produce weak or non-parsing code (low success,
high syntax-error rate). Next iterations add a with-spec vs without-spec
condition, pass@k, and a held-out split; grow the suite toward 20 to 50 tasks.

### Positioning and hiring narrative

Read Kodro as evidence of reproducible-eval-infrastructure and LLM-guardrail
engineering by a solo developer who is rigorous about measured versus claimed.
The load-bearing artifacts are `bench.py`/`kodrobench.py` (a deterministic,
seeded, no-GPU eval that runs in CI, close to the DeepMind benchmarking-role
brief) and the grounding validator (eval plus safety-guardrail infra). Stated
plainly for a panel: no learned policy, no real-robot data, no publication, so
it does not clear a robotics-research-scientist bar on its own; its value is the
eval and grounding work. Cite RoboEval/CodeBotler as the closest prior art and
Anthropic's evals guidance as the method authority in the dissertation.

---

Synthesized July 2026 from five research briefs: professional simulators, K-12 education platforms, AI-assisted robotics tooling, sim-to-real parts prediction, and pricing/voice-of-customer. Every source URL from the underlying briefs is retained; the full list is in the Source Appendix. Claims flagged [unverified] in the source research remain flagged here.

---

## 1. Landscape

### 1a. Professional simulators

| Product | Audience | Price | Offline? | Custom robot spec import? | AI assistant? | Fidelity disclosure? | URL |
|---|---|---|---|---|---|---|---|
| NVIDIA Isaac Sim | Pro robotics/RL/digital-twin engineers | Free (Apache 2.0 on GitHub); hardware is the real price: min RTX 4080-class, 16GB+ VRAM, 32GB RAM | Desktop, but internet required for S3 assets + NVIDIA account | Yes (URDF/USD, expert-authored) | Partial: "Chat USD" dev add-on + MCP servers wired to cloud LLMs, not an end-user helper | No consumer-facing disclosure | https://developer.nvidia.com/isaac/sim |
| Gazebo (Harmonic/Jetty) | ROS developers, researchers | Free OSS (Apache 2.0) | Yes, but Linux-first; Windows "not fully functional"/experimental | Yes (SDF/URDF, expert-authored) | No | No; stock battery model is admittedly linear | https://gazebosim.org/docs/latest/getstarted/ |
| Gazebo Classic | Legacy ROS users | Free OSS | Yes | Yes (URDF) | No | No | https://classic.gazebosim.org/ (EOL Jan 29, 2025) |
| Webots | Industry, education, research | Free OSS (Apache 2.0 since Dec 2018) | Yes, true Windows/Linux/macOS desktop, no account | Yes (PROTO, plus URDF/STL/COLLADA geometry; motor/friction hand-tuned, no parts database) | No | No fidelity tiers | https://cyberbotics.com/ |
| CoppeliaSim | Students, researchers, industry | Edu free (non-commercial); commercial from ~$2,380/yr | Yes, desktop | Yes (mesh/URDF; scripting required) | No (embedded Lua/Python scripting) | No; accuracy known only from a third-party academic study | https://www.coppeliarobotics.com/pricing |
| MuJoCo | RL/biomechanics researchers | Free OSS (Apache 2.0, DeepMind) | Yes (library) | Yes (MJCF XML, expert-authored, no GUI authoring) | No | No | https://mujoco.org/ |
| PyBullet | RL researchers, Python learners | Free OSS (zlib) | Yes (pip install) | Yes (URDF/SDF/MJCF, user-supplied) | No | No | https://pypi.org/project/pybullet/ |

### 1b. Education platforms

| Product | Audience | Price | Offline? | Custom robot spec import? | AI assistant? | Fidelity disclosure? | URL |
|---|---|---|---|---|---|---|---|
| VEXcode VR | Grades 3+ (ages ~5-16) | Free tier; Enhanced $199/educator/yr; Premium $499/educator/yr | Partial: paid "offline" mode phones home every 30 days | No; one preconfigured robot, no configuration step | No (Premium sells AI as curriculum content, not an assistant) | No; VEX states the VR robot ignores friction by design | https://www.vexrobotics.com/vexcode-vr.html |
| Tinkercad Circuits | All ages; under-13 US needs moderated child account | Free (Autodesk) | No, browser + internet required | Partial, circuits only, fixed component library; no robot mechanics | No | Electrical sim is real; mechanics absent | https://www.tinkercad.com/circuits |
| Tinkercad Sim Lab | Same | Free | No (web) | No; generic materials/axles/motors, no real part specs | No | Partial: self-described "approximation", no tiers | https://www.tinkercad.com/simlab |
| Open Roberta Lab | Primary-secondary learners | Free OSS (Apache 2.0, Fraunhofer IAIS) | Partial: cloud by default; offline = self-host a Raspberry Pi/Docker server | No; 13+ preset robot targets, toggles only | No | No; 2D differential-drive model | https://github.com/OpenRoberta/openroberta-lab |
| RobotBenchmark | "Middle school to PhD" | Free | No; Webots runs server-side, streamed to browser | No; 12 benchmarks each with one fixed robot | No | No disclosure to the learner despite real Webots physics | https://robotbenchmark.net/ |
| CoderZ | Ages ~6-15+ | School license $2,400/yr (CR101); quote-based | No; entirely cloud, Chrome-only | No; preset robots per mission | No (cloud assistance only) | Marketing claims physics; no published fidelity model [unverified] | https://gocoderz.com/ |
| Robotify (Imagine Learning) | K-12 | Quote-based; acquired Nov 2021 (~€20M reported) | No; cloud | No | No | No | https://www.prnewswire.com/news-releases/imagine-learning-acquires-robotify-innovative-new-platform-designed-to-teach-coding-through-virtual-robotics-simulation-301421187.html |
| Wonder Workshop (virtual Dash) | Ages 6-11 | Dash $149.99/Dot $79.99 hardware; Make Wonder STEM Classroom $99 promo | No; cloud subscription on iPads/Chromebooks | No; the one virtual Dash | No | No; cartoon world | https://www.makewonder.com/en/classroom/ |
| LEGO SPIKE Prime | Grades 6-8 | Set $329.95-$339.95; SPIKE App free | App works locally with a hub, but has no simulator | Physical bricks yes; digitally no | No | N/A (no sim); whole SPIKE line retires June 30, 2026 | https://education.lego.com/en-us/products/lego-education-spike-prime-set/45678/ |
| CMU Virtual SPIKE Prime | SPIKE classrooms | Paid via CS2N | No; internet-required | No | No | No | https://www.cmu.edu/roboticsacademy/roboticscurriculum/Lego%20Curriculum/spike-virtual.html |
| spikeprimevirtual.com | SPIKE users | See site | Web | No | No | No | https://spikeprimevirtual.com/faq.html |
| Virtual Robotics Toolkit | LEGO EV3/NXT teams | ~$50 perpetual single seat (also $60/yr listings); ~$200 10-seat | Desktop (Win/Mac), license activation | Partial: LEGO models via LEGO Digital Designer import | No | No; markets "accurate physics" with no published validation | https://www.virtualroboticstoolkit.com/ |
| FTC community sims (ftcsim.org, ftcsimulator.com, vrobotsim.com, vrobotsim.online, Beta8397/virtual_robot) | FTC teams | Free | Mixed (mostly browser) | No; fixed presets | No | No; 2D code-logic testing | https://ftcsim.org/ |
| Autodesk Synthesis ("Fission") | FRC/FTC teams | Free OSS | Was desktop; rewrite is web, requires Fusion ecosystem | No; imports CAD geometry via Fusion add-in, not a parts/electrical spec | No | No fidelity statements | https://synthesis.autodesk.com/ |

### 1c. Parts calculators and sim-to-real products

| Product | Audience | Price | Offline? | Custom robot spec import? | AI assistant? | Fidelity disclosure? | URL |
|---|---|---|---|---|---|---|---|
| eCalc | Drone/RC-aircraft/EV builders | Paid membership; free demo limited to "20% random database" | No; online-only | Yes for flight only: 15,000+ motor DB, batteries, props; no wheeled robots | No | Partial: markets "reliable predictions since 2004"; ±10% figure is community-reported only [official claim unverified] | https://www.ecalc.ch/ |
| MotoCalc | RC airplane builders | Paid (30-day trial) [pricing detail unverified] | Desktop app | Yes, airplane power systems only | No | No official accuracy spec found | https://www.motocalc.com/ |
| JVN Design Calculator | FRC/FTC teams | Free | Yes (spreadsheet) | Yes: FRC/FTC motors + gearing | No | No stated error bounds | https://gm0.org/en/latest/docs/power-and-electronics/motor-guide/jvn-calculator.html |
| ILITE Drivetrain Simulator | FRC teams | Free | Yes (Excel) | Yes: motor choice + 25+ drivetrain params | No | No stated error bounds | https://www.chiefdelphi.com/t/ilite-drivetrain-simulator-v2020/369188 |
| ReCalc | FRC teams | Free | No (web) | Yes: FRC motors/gearboxes | No | No | https://www.reca.lc/ |
| AWS DeepRacer | Consumer RL learners | Retired from AWS console Dec 15, 2025; now self-hosted OSS | No (was AWS console) | No; fixed 1/18-scale car | No | No; users reported cars that ran perfectly in sim but failed a single real-world turn | https://aws.amazon.com/deepracer/faqs/ |
| Duckietown | University autonomy courses | Hardware kits + OSS | Mixed | No; fixed Duckiebot | No | Academic, not productized disclosure | https://arxiv.org/pdf/2011.05617 |

### 1d. CAD and FEA adjacent

| Product | Audience | Price | Offline? | Custom robot spec import? | AI assistant? | Fidelity disclosure? | URL |
|---|---|---|---|---|---|---|---|
| Fusion 360 | Makers, engineers | Free personal tier, but simulation removed from it; cloud credits for solves | Desktop, sim cloud-gated | No; FEA/thermal on CAD bodies, not robot systems | No | Standard FEA assumptions; no robot-level fidelity concept | https://www.autodesk.com/products/fusion-360/personal |
| Onshape | Engineers, FRC community | Free plan (no sim); Simulation gated to Professional ~$2,500/user/yr | No; cloud CAD | No; FEA on assemblies | No | No | https://www.onshape.com/en/pricing |
| SimScale | Engineers | Free community tier (~10 sims, public projects); paid ~$3,000+/yr | No; cloud-only | No; general CFD/FEA on uploaded CAD | No | Solver docs only; no robot fidelity tiers | https://www.simscale.com/product/pricing/ |
| Zoo Text-to-CAD | Developers | API product | Cloud | Geometry only; no joints/actuators/robot semantics | Yes (Zookeeper conversational CAD agent, cloud) | No | https://zoo.dev/text-to-cad |
| Adam (YC W25) | CAD users | $4.1M seed Oct 2025; product pricing per site | Cloud | Geometry only; breaks down past ~8-10 part assemblies; no robot semantics | Yes (cloud copilot) | No | https://adam.new/ |

### 1e. Other robotics platforms

| Product | Audience | Price | Offline? | Custom robot spec import? | AI assistant? | Fidelity disclosure? | URL |
|---|---|---|---|---|---|---|---|
| RoboDK | Industrial OLP users | Edu $145/yr (university email, 1000-instruction cap); commercial ~$3,495 perpetual | Desktop, license activation | Industrial robot library focus | No | No | https://robodk.com/pricing |
| MATLAB/Simulink + Robotics System Toolbox | Engineers, students | Student suite ~$99-119/yr; Robotics System Toolbox $840 on top of base (commercial) | Desktop with license phone-home | Via toolbox workflows, expert-level | No | No | https://www.mathworks.com/pricing-licensing.html |
| The Construct | ROS learners | €39.97/month | No; cloud browser VMs | ROS-standard, cloud | Cloud assistance only | No | https://www.theconstruct.ai/pricing/ |
| AWS RoboMaker | Cloud robotics devs | Discontinued Sept 10, 2025 "after failing to gain traction" | No | Was ROS-standard | No | No | https://docs.aws.amazon.com/robomaker/latest/dg/chapter-support-policy.html |

### 1f. AI-assisted robotics (research and infrastructure, mostly not products)

| Product | Audience | Price | Offline? | Custom robot spec import? | AI assistant? | Fidelity disclosure? | URL |
|---|---|---|---|---|---|---|---|
| Anthropic Project Fetch (Phases 1-2) | Internal research | Not a product | N/A (cloud Claude) | Off-the-shelf quadruped, no design step | Yes (Claude, cloud) | Research honesty in writeups, not a product feature | https://www.anthropic.com/research/project-fetch-phase-two |
| NVIDIA Eureka / IsaacLabEureka | RL researchers | Free code; requires OpenAI/Azure API key | No (cloud LLM) + RTX hardware | User-built Isaac Lab envs, expert-only | Yes (GPT-4, cloud) | No | https://eureka-research.github.io/ |
| RoboGen | Researchers | Free code | No (GPT-4) | Generated scenes, not user robot specs | Yes (cloud) | No | https://robogen-ai.github.io/ |
| Genesis physics engine | Researchers | Free OSS core; headline generative "prompt-to-4D-world" layer never released | Yes (engine) | Researcher-level | Promised, unreleased | No | https://github.com/Genesis-Embodied-AI |
| Isaac Sim MCP servers (whats2000, omni-mcp, nullbyte91/nvidia-isaac-mcp) | Devs with Claude Code/Cursor | Free OSS | No; Linux-only today, needs RTX GPU + cloud LLM | Isaac-standard | Yes (cloud coding agents) | No | https://github.com/whats2000/isaacsim-mcp-server |
| EduSim-LLM (Jan 2026 paper) | Novice learners (research) | Research prototype, no product | Partial: Groq llama-3.3-70b or local Ollama llama3.1:8b | No design component | Yes (incl. local Ollama, proven feasible) | No | https://arxiv.org/html/2601.01196v1 |
| HuggingFace LeRobot | Hobbyist/researcher hardware builders | Free OSS; ~$2,500 3D-printed humanoid | Local stack | Hardware-agnostic control, but learn-from-demonstration; design/CAD out of scope, LLM is not the programmer | No | No | https://github.com/huggingface/lerobot |
| Text2Robot (Duke) | Research | Lab-only | Research pipeline | Text to buildable walking quadruped, quadrupeds only, zero productization | Yes (research pipeline) | No | https://generalroboticslab.com/Text2Robot |

---

## 2. The gap

The persona nobody serves: a non-expert who wants to (a) design a CUSTOM robot from real parts, (b) verify honestly what it would do in the real world, and (c) then go build it. Every surveyed product fails at least one of the three legs, usually two.

**Who gets closest, and where each falls short:**

1. **Webots desktop** is the closest full simulator. It is free, open source, genuinely offline, cross-platform, and supports custom robots via PROTO (https://cyberbotics.com/ ; https://en.wikipedia.org/wiki/Webots ; https://github.com/cyberbotics/webots). It fails the persona because it is a pro tool: controllers must be coded in C/C++/Python/Java/MATLAB/ROS, motor and friction parameters are hand-tuned with no parts database or hobbyist guidance (https://thinkrobotics.com/blogs/learn/webots-vs-gazebo-choosing-a-robotics-simulator), there is no fidelity disclosure, no lesson engine, and no verification workflow. Its own education product, robotbenchmark.net, removes the design step entirely: 12 benchmarks, one fixed preset robot each, cloud-streamed (https://robotbenchmark.net/ ; https://github.com/cyberbotics/webots/tree/master/projects/samples/robotbenchmark).

2. **eCalc** is the closest on parts-spec-to-performance prediction and proves the demand commercially (claims "more than 20,000 setups a day" and "over 525M drives calculated", https://www.ecalc.ch/). It fails because it is flight-only (drones/RC aircraft/EV, no wheeled robots), online-only, subscription-gated, and its free tier deliberately cripples the parts database. Its accuracy figure (±10%) is community-reported, not official (https://dronevibes.com/forums/threads/ecalc-accuracy.8783/).

3. **JVN / ILITE / ReCalc** are the closest in the right domain (wheeled drivetrains: motor choice, gearing, current draw, speed-vs-time). They fail because they are FRC/FTC-culture spreadsheets and web calculators: no 3D simulation, no missions, no fidelity statement, no pedagogy, and they presuppose COTS competition motors and team mentorship (https://gm0.org/en/latest/docs/power-and-electronics/motor-guide/jvn-calculator.html ; https://www.chiefdelphi.com/t/ilite-drivetrain-simulator-v2020/369188 ; https://www.reca.lc/ ; https://github.com/tervay/recalc).

4. **CoppeliaSim** has the best measured motion accuracy of the mainstream sims in the only peer-reviewed comparison against a real Husky A200 (https://www.sciencedirect.com/science/article/abs/pii/S1569190X22001046 ; https://github.com/offroad-robotics/robot-simulator-comparison). It fails because that accuracy data comes from third-party academics, not product disclosure; there is no parts database, no curriculum, and doing anything real requires scripting (https://www.coppeliarobotics.com/pricing ; https://manual.coppeliarobotics.com/en/licensing.htm).

5. **Tinkercad** verifies honestly, but only electronics: real-time electrical simulation of Arduino/micro:bit circuits from a fixed component library, no mechanics (https://www.tinkercad.com/circuits ; https://www.digikey.com/en/maker/blogs/2022/arduino-simulators-for-hobbyists-makers-and-classroom-environments). Sim Lab self-describes as "an approximation of real-world behavior" with generic materials, no real part specs (https://www.tinkercad.com/blog/tinkercad-sim-lab ; https://www.tinkercad.com/blog/tracesandgraphs). Cloud-only, and under-13 US users need moderated accounts (https://www.tinkercad.com/help/faq/child-accounts).

6. **Text2Robot** is the closest research analogue to the full loop: text prompt to evolutionary co-optimized quadruped honoring electronics placement and manufacturability, walking 3D-printed robot in a day (https://generalroboticslab.com/Text2Robot ; https://arxiv.org/abs/2406.19963 ; https://github.com/generalroboticslab/Text2Robot ; https://pratt.duke.edu/news/text2robot/). It fails because it is lab-only, quadrupeds-only, and there is no product. Same story for RoboMorph (https://arxiv.org/abs/2407.08626 ; https://robomorph.github.io/), RoboMoRe (https://arxiv.org/abs/2506.00276), and Debate2Create (https://arxiv.org/pdf/2510.25850).

7. **EduSim-LLM** is the closest academic analogue to Kodro's assistant: natural-language robot control for novices in CoppeliaSim, with a local Ollama llama3.1:8b option proven workable (100%/94.4%/88.9% success on simple/composite/complex tasks). It fails as a product: research prototype, no lessons, no grading, no robot design (https://arxiv.org/html/2601.01196v1).

The structural conclusion across all five briefs: education platforms deliberately delete physics (VEX ships a friction-free robot by design, https://pd.vex.com/insights/vexcode-vr-remote-learning-about-vex-robots), professional simulators have physics but demand expert-authored specs and never disclose fidelity at point of use, calculators predict performance but only for flight or FRC hardware, and AI+sim tooling is cloud-API, Linux, RTX-GPU territory. The one mass-market sim-to-real education product, AWS DeepRacer, retired from the console on Dec 15, 2025, and never let users change the robot's parts (https://aws.amazon.com/deepracer/faqs/ ; https://aws.amazon.com/blogs/machine-learning/celebrating-the-final-aws-deepracer-league-championship-and-road-ahead/ ; https://towardsdatascience.com/aws-deepracer-a-practical-guide-to-reducing-the-sim2real-gap-part-1-580fb1244229/). Nobody closes the design, honest-verify, build loop.

---

## 3. Kodro differentiators (ranked)

Only what the shipped code does. No roadmap claims.

1. **HONOURED / APPROXIMATED / NOT-SIMULATED fidelity badges.** No surveyed product, professional or educational, discloses simulation fidelity at point of use. The only quantified accuracy data for mainstream sims comes from third-party academic benchmarks (https://www.sciencedirect.com/science/article/abs/pii/S1569190X22001046), and practitioners publicly distrust simulator marketing (https://news.ycombinator.com/item?id=8948768 ; https://news.ycombinator.com/item?id=11384230 ; https://news.ycombinator.com/item?id=35204176 ; https://news.ycombinator.com/item?id=48586119). Fidelity disclosure as a product feature is unoccupied territory, and it converts documented distrust into trust.

2. **KRS spec import: design a custom robot from a machine-readable parts spec.** Every K-12 platform locks students to preset robots (VEXcode VR: https://kb.vex.com/hc/en-us/articles/360041778591-Understanding-Robot-Features-in-VEXcode-VR ; Open Roberta presets: https://github.com/OpenRoberta/openroberta-lab). The tools that do import (URDF in Gazebo/Isaac/MuJoCo) are exactly the ones with expert-authoring, install, and hardware pain (https://news.ycombinator.com/item?id=44902713). No product accepts a beginner-writable robot spec, and no product for wheeled/tracked robots does parts-spec-to-performance prediction at all (the eCalc model exists only for flight, https://www.ecalc.ch/).

3. **Offline one-file desktop, no account.** VEX's "offline" mode is a paid feature that still phones home every 30 days (https://kb.vex.com/hc/en-us/articles/8608511437076-Using-Offline-VEXcode-VR); CoderZ, Robotify, Tinkercad, robotbenchmark, and virtual Dash are cloud-only; Open Roberta offline means self-hosting a Raspberry Pi server (https://www.open-roberta.org/lokale-installation/). Isaac Sim needs an NVIDIA account, internet asset pulls, and an RTX 4080-class GPU (https://docs.isaacsim.omniverse.nvidia.com/latest/installation/requirements.html); Gazebo treats Windows as experimental (https://gazebosim.org/docs/latest/ros_installation/). No account also removes COPPA/GDPR-K consent overhead entirely. Platform-longevity anxiety is live after AWS RoboMaker's shutdown (https://www.therobotreport.com/aws-robomaker-shuts-down-after-failing-to-gain-traction/), Gazebo Classic's EOL (https://discourse.openrobotics.org/t/gazebo-classic-end-of-life/48748), and Moxie bricking when its cloud died (https://www.theregister.com/2024/12/16/moxie_cloud_services_lessons/ ; https://mikekalil.com/blog/moxie-ai-robot-shutdown/ ; https://www.moxierobot.com/pages/closing-faqs). "The exe keeps working" is a story no vendor currently tells.

4. **Local-AI vibe-coding with a deterministic self-test safety net.** No shipped product pairs a local LLM with a robot simulator; every real pairing (Eureka, IsaacLabEureka, RoboGen, Isaac Sim MCP servers) requires a cloud API key and researcher infrastructure (https://github.com/isaac-sim/IsaacLabEureka ; https://github.com/omni-mcp/isaac-sim-mcp ; https://forums.developer.nvidia.com/t/setting-up-mcp-server-using-claude-on-a-linux-system-for-isaac-sim/338707). EduSim-LLM proved local Ollama works but stayed a paper (https://arxiv.org/html/2601.01196v1). And nobody grades or verifies LLM-written robot code, even though Anthropic's own Project Fetch Phase 2 shows exactly where frontier models fail (precise real-time control) (https://www.anthropic.com/research/project-fetch-phase-two ; https://red.anthropic.com/2025/project-fetch/). The deterministic self-test net is the product answer to that documented failure mode.

5. **Verification report artifact.** No competitor closes the loop with a "predict, then check against your real build" output. Sim-to-real predictivity is an active research topic (https://arxiv.org/pdf/1912.06321 ; https://arxiv.org/html/2504.03597v1), not a hobbyist deliverable. A report a user can take to the parts store or a teacher can file has no incumbent.

6. **Lesson engine with graded missions.** No professional simulator ships lessons or a grader [absence inferred across the six pro-tool product pages surveyed; none advertises such features], and the edu platforms that do ship curriculum sit on preset robots and idealized physics. Kodro's mission worlds plus grader on top of a real design step is a combination neither cluster offers.

7. **Optional cloud model connectors.** Lower in the ranking because cloud AI is where incumbents are strong. The differentiation is that cloud is optional on top of a fully working local default, not a dependency, which matters in school networks where cloud AI is blocked and to buyers burned by RoboMaker/Moxie-style shutdowns.

---

## 4. Positioning

**Positioning statement:**

Kodro is the offline, one-file robot design and simulation studio for people who do not have a robotics lab. You describe a custom robot as a KRS parts spec, test it in graded mission worlds where every physics behavior carries an HONOURED, APPROXIMATED, or NOT-SIMULATED badge, get help from an AI assistant that runs entirely on your own machine and is checked by deterministic self-tests, and leave with a verification report that says honestly what your design will and will not do before you spend money building it. No account, no internet, no subscription, no server that can be switched off.

**Wedge audiences:**

1. **Pre-purchase hobbyists building wheeled/tracked robots.** The eCalc model (parts spec in, performance prediction out) demonstrably works at scale for flight (https://www.ecalc.ch/) and the JVN/ILITE/ReCalc spreadsheets show sustained demand on the ground side (https://gm0.org/en/latest/docs/power-and-electronics/motor-guide/jvn-calculator.html), but no product serves a hobbyist choosing motors, wheels, and a battery for a ground robot. Kodro is the missing "will this drivetrain actually work" answer with a 3D sim and a report instead of an Excel sheet.

2. **KS3/GCSE classrooms (UK ages 11-16) and equivalents.** Competitors cluster at ages 6-13 with block coding; text Python is paywalled (VEX Premium $499/educator/yr, CoderZ Python Gym 13+) (https://www.vexrobotics.com/vexcode-vr.html ; https://gocoderz.com/courses/). Offline no-account removes the license-expiry and phone-home failure modes teachers already complain about (https://www.vexforum.com/t/vexcode-vr-premium/124134 ; https://www.vexforum.com/t/vex-full-volume-vr-code/117438). The LEGO SPIKE portfolio ends sales and app support June 30, 2026, with no announced simulator in the successor line, creating a displaced-classroom window for the 2026-27 school year (https://www.thebrickfan.com/lego-education-computer-science-ai-announced-spike-discontinued/).

3. **Research-prototyping sketchpad.** Researchers and students who want a fast first-order feasibility sketch of a robot concept on an ordinary Windows laptop, before committing to URDF authoring, ROS, Linux, or RTX hardware (the documented pain: https://news.ycombinator.com/item?id=15754702 ; https://news.ycombinator.com/item?id=45478085 ; https://news.ycombinator.com/item?id=39920388). Complementary to, not competitive with, LeRobot's learn-from-demonstration stack, which deliberately excludes robot design (https://github.com/huggingface/lerobot ; https://huggingface.co/docs/lerobot/index).

---

## 5. Honest risks and limits

**What we actually are, stated plainly:**

1. **Kinematic first-order physics.** Kodro does not do contact-rich dynamics, deformation, or the force/friction modeling of Bullet/PhysX/MuJoCo-class engines. The fidelity badges disclose this, but disclosure is not equivalence: a design that passes in Kodro can still fail in reality for reasons Kodro marks NOT-SIMULATED. The independent Husky A200 benchmark shows how hard even the serious engines find real-world accuracy (https://www.sciencedirect.com/science/article/abs/pii/S1569190X22001046), and the Robotics Knowledgebase confirms simulators "rarely account for" motor thermal throttling or nonlinear battery drops (https://roboticsknowledgebase.com/wiki/robotics-project-guide/choose-a-sim/).

2. **Small-model ceiling.** A local Ollama-class model is far below frontier cloud models, and Project Fetch Phase 2 shows even a frontier model fails at precise real-time control (https://www.anthropic.com/research/project-fetch-phase-two). The deterministic self-test net catches broken code; it does not make a small model a good robotics engineer. The optional cloud connectors are the escape hatch, and using them surrenders part of the offline story.

3. **No ROS export yet.** KRS does not currently bridge to URDF/ROS, so a user graduating to Gazebo, Webots, or Isaac must rebuild their robot by hand. Until an export exists, competitors can fairly call KRS a dead-end format next to the URDF ecosystem standard.

4. **Research-coverage caveat inherited from the briefs.** Complaint evidence skews to HN, official forums, and GitHub; Reddit (r/FTC, r/robotics) was weakly indexed in the underlying research and should be scraped directly before quoting voice-of-customer claims in marketing.

**What competitors would say against us, and how much of it lands:**

- **Pro-sim vendors (NVIDIA, Open Robotics, Cyberbotics, Coppelia):** "It is not a real simulator; kinematic toy physics cannot do manipulation, RL, or sim-to-real transfer." This lands for their audiences. Kodro's answer is scope honesty: the badges say exactly that, and their own users publicly say the pro engines "usually don't survive contact with reality" either (https://news.ycombinator.com/item?id=35204176).
- **VEX/CoderZ/LEGO:** "No curriculum ecosystem, no teacher PD, no classroom management, no standards alignment, no hardware ecosystem, no track record." Largely true today. The counter is price and friction: their offline is paid and phones home, their robots are presets, and LEGO is exiting (https://kb.vex.com/hc/en-us/articles/8608511437076-Using-Offline-VEXcode-VR ; https://www.thebrickfan.com/lego-education-computer-science-ai-announced-spike-discontinued/).
- **eCalc:** "We have 15,000+ real parts and two decades of calibration; Kodro has no comparable parts database." True; Kodro's parts coverage is a genuine gap against eCalc's depth, offset only by domain (they do not do wheeled robots at all).
- **Everyone:** "The fidelity badges are an admission of weakness." They are, deliberately. The bet, supported by documented practitioner distrust of "accurate physics" marketing, is that admitting limits is the trust wedge, not the vulnerability.
- **Longevity skeptics:** "A small single-product vendor is itself a platform risk." Fair, and the honest answer is architectural: a no-server one-file exe with a documented spec format fails gracefully (the file keeps working), unlike Moxie or RoboMaker (https://www.theregister.com/2024/12/16/moxie_cloud_services_lessons/ ; https://www.therobotreport.com/aws-robomaker-shuts-down-after-failing-to-gain-traction/).

---

## 6. Source appendix (all URLs from the underlying briefs)

### Brief 1: Professional simulators
- https://docs.isaacsim.omniverse.nvidia.com/latest/installation/requirements.html
- https://docs.isaacsim.omniverse.nvidia.com/4.5.0/installation/requirements.html
- https://developer.nvidia.com/isaac/sim
- https://github.com/NVIDIA-Omniverse/kit-usd-agents
- https://en.wikipedia.org/wiki/Gazebo_(simulator)
- https://docs.px4.io/main/en/sim_gazebo_gz/
- https://gazebosim.org/docs/latest/getstarted/
- https://www.mathworks.com/help/robotics/ug/gazebo-simulation-requirements.html
- https://en.wikipedia.org/wiki/Webots
- https://cyberbotics.com/
- https://www.coppeliarobotics.com/pricing
- https://qviro.com/product/coppelia-robotics/coppeliasim-coppeliarobotics
- https://forum.coppeliarobotics.com/viewtopic.php?t=1707
- https://deepmind.google/blog/open-sourcing-mujoco/
- https://www.blackcoffeerobotics.com/blog/autonomous-mobile-robots-which-robot-simulation-software-to-use
- https://pypi.org/project/pybullet/
- https://py.ai/tools/pybullet/

### Brief 2: Education robotics platforms
- https://www.vexrobotics.com/vexcode/vr
- https://vr.vex.com/
- https://edtechimpact.com/products/vexcode-vr/
- https://www.vexrobotics.com/vexcode-vr.html
- https://kb.vex.com/hc/en-us/articles/8608511437076-Using-Offline-VEXcode-VR
- https://kb.vex.com/hc/en-us/articles/360041778591-Understanding-Robot-Features-in-VEXcode-VR
- https://www.tinkercad.com/circuits
- https://www.tinkercad.com/teachers
- https://www.tinkercad.com/help/faq/child-accounts
- https://www.digikey.com/en/maker/blogs/2022/arduino-simulators-for-hobbyists-makers-and-classroom-environments
- https://github.com/OpenRoberta/openroberta-lab
- https://en.wikipedia.org/wiki/Open_Roberta
- https://www.open-roberta.org/lokale-installation/
- https://github.com/OpenRoberta/openroberta-live
- https://robotbenchmark.net/
- https://github.com/cyberbotics/webots-doc/blob/master/blog/robotbenchmark.md
- https://github.com/cyberbotics/webots/tree/master/projects/samples/robotbenchmark
- https://github.com/cyberbotics/webots
- https://gocoderz.com/
- https://gocoderz.com/courses/
- https://stemfinity.com/products/coderz-cyber-robotics-101-school-license
- https://www.amazon.com/Wonder-Workshop-Dash-Activated-Programming/dp/B00SKURVKY
- https://smarterlearningguide.com/dash-and-dot-robot-review/
- https://www.makewonder.com/en/classroom/
- https://education.lego.com/en-us/products/lego-education-spike-prime-set/45678/
- https://www.thebrickfan.com/lego-education-computer-science-ai-announced-spike-discontinued/
- https://education.lego.com/en-us/downloads/spike-app/software/
- https://www.cmu.edu/roboticsacademy/roboticscurriculum/Lego%20Curriculum/spike-virtual.html
- https://spikeprimevirtual.com/faq.html

### Brief 3: AI-assisted design/code tools crossing into robotics
- https://www.anthropic.com/research/project-fetch-robot-dog
- https://www.anthropic.com/research/project-fetch-phase-two
- https://red.anthropic.com/2025/project-fetch/
- https://github.com/microsoft/PromptCraft-Robotics
- https://arxiv.org/pdf/2306.17582
- https://www.theregister.com/2023/02/22/microsoft_chatgpt_robots/
- https://code-as-policies.github.io/
- https://arxiv.org/pdf/2209.07753
- https://github.com/google-research/google-research/tree/master/code_as_policies
- https://www.preprints.org/manuscript/202304.0827/v2
- https://arxiv.org/abs/2308.11236
- https://onlinelibrary.wiley.com/doi/10.1002/spe.3377
- https://language-to-reward.github.io/
- https://bostondynamics.com/blog/robots-that-can-chat/
- https://www.therobotreport.com/boston-dynamics-turns-spot-into-a-tour-guide-with-chatgpt/
- https://en.wikipedia.org/wiki/GitHub_Copilot
- https://arxiv.org/pdf/2507.07846
- https://github.com/jrin771/Everything-LLMs-And-Robotics
- https://github.com/GT-RIPL/Awesome-LLM-Robotics
- https://eureka-research.github.io/
- https://arxiv.org/pdf/2310.12931
- https://blogs.nvidia.com/blog/eureka-robotics-research/
- https://github.com/eureka-research/Eureka
- https://arxiv.org/html/2406.01967v1
- https://github.com/isaac-sim/IsaacLabEureka
- https://github.com/isaac-sim/IsaacLab
- https://robogen-ai.github.io/
- https://arxiv.org/abs/2311.01455
- https://github.com/Genesis-Embodied-AI
- https://aibusinessweekly.net/p/genesis-open-source-physics-simulator-robotics-ai
- https://interestingengineering.com/innovation/genesis-system-robot-training
- https://www.marvik.ai/blog/genesis-redefining-robotics-and-physics-simulations
- https://github.com/nvidia/GR00T-dreams
- https://developer.nvidia.com/blog/enhance-robot-learning-with-synthetic-trajectory-data-generated-by-world-foundation-models/
- https://developer.nvidia.com/blog/r2d2-training-generalist-robots-with-nvidia-research-workflows-and-world-foundation-models/
- https://github.com/whats2000/isaacsim-mcp-server
- https://github.com/omni-mcp/isaac-sim-mcp
- https://forums.developer.nvidia.com/t/setting-up-mcp-server-using-claude-on-a-linux-system-for-isaac-sim/338707
- https://arxiv.org/html/2601.01196v1
- https://github.com/huggingface/lerobot
- https://huggingface.co/docs/lerobot/index
- https://arxiv.org/html/2602.22818v1
- https://interestingengineering.com/ai-robotics/us-hugging-face-3d-printed-lerobot
- https://la-lerobot-global-hackathon.devpost.com/resources
- https://generalroboticslab.com/Text2Robot
- https://arxiv.org/abs/2406.19963
- https://github.com/generalroboticslab/Text2Robot
- https://pratt.duke.edu/news/text2robot/
- https://arxiv.org/abs/2407.08626
- https://robomorph.github.io/
- https://arxiv.org/abs/2506.00276
- https://arxiv.org/pdf/2510.25850
- https://zoo.dev/text-to-cad
- https://zoo.dev/blog/introducing-text-to-cad
- https://adam.new/
- https://techcrunch.com/2025/10/31/yc-alum-adam-raises-4-1m-to-turn-viral-text-to-3d-tool-into-ai-copilot/
- https://github.com/Adam-CAD/CADAM
- https://deepmind.google/models/gemini-robotics/
- https://deepmind.google/models/gemini-robotics/gemini-robotics-on-device/
- https://deepmind.google/blog/gemini-robotics-er-1-6/
- https://ai.google.dev/gemini-api/docs/robotics-overview
- https://developer.nvidia.com/isaac/gr00t
- https://github.com/Nvidia/Isaac-GR00T
- https://nvidianews.nvidia.com/news/nvidia-isaac-gr00t-n1-open-humanoid-robot-foundation-model-simulation-frameworks
- https://huggingface.co/blog/pi0
- https://www.physicalintelligence.company/blog/pi05
- https://www.roboticscenter.ai/physical-intelligence-pi0-vs-openvla
- https://www.figure.ai/news/helix
- https://techstartups.com/2025/02/21/ai-startup-figure-unveils-helix-new-ai-model-lets-robots-follow-voice-commands-handle-unknown-objects/
- https://covariant.ai/insights/introducing-rfm-1-giving-robots-human-like-reasoning-capabilities/
- https://siliconangle.com/2024/09/02/amazon-hires-founders-ai-robotics-startup-covariant/
- https://www.therobotreport.com/intrinsic-is-joining-google-to-advance-physical-ai-in-robotics/
- https://www.cnbc.com/2026/02/25/alphabet-robotics-software-intrinsic-google-ai.html
- https://www.aibase.com/news/14098
- https://www.theregister.com/2024/12/16/moxie_cloud_services_lessons/
- https://mikekalil.com/blog/moxie-ai-robot-shutdown/
- https://www.moxierobot.com/pages/closing-faqs
- https://github.com/kscalelabs
- https://www.humanoidsdaily.com/news/robotis-enters-the-open-source-humanoid-arena-with-ai-sapiens-k0-platform

### Brief 4: Sim-to-real and parts-spec prediction
- https://www.ecalc.ch/
- https://dronevibes.com/forums/threads/ecalc-accuracy.8783/
- https://www.motocalc.com/
- https://www.wattflyer.com/forums/archive/index.php/t-29753.html
- https://gm0.org/en/latest/docs/power-and-electronics/motor-guide/jvn-calculator.html
- https://www.chiefdelphi.com/t/ilite-drivetrain-simulator-v2020/369188
- https://www.reca.lc/
- https://github.com/tervay/recalc
- https://synthesis.autodesk.com/
- https://github.com/Autodesk/synthesis
- https://www.tinkercad.com/simlab
- https://www.tinkercad.com/blog/tinkercad-sim-lab
- https://www.tinkercad.com/blog/tracesandgraphs
- https://pd.vex.com/insights/vexcode-vr-remote-learning-about-vex-robots
- https://www.virtualroboticstoolkit.com/
- https://builderdude35.com/virtual-robotics-toolkit/
- https://stemfinity.com/products/cogmation-robotics-virtual-toolkit-software-lab-license
- https://vrobotsim.com/
- https://ftcsim.org/
- https://github.com/Beta8397/virtual_robot
- https://thinkrobotics.com/blogs/learn/webots-vs-gazebo-choosing-a-robotics-simulator
- https://gazebosim.org/api/sim/7/battery.html
- https://github.com/nilseuropa/gazebo_ros_battery
- https://github.com/ctu-vras/gazebo_ros_battery
- https://discourse.openrobotics.org/t/nonlinear-dynamic-battery-model-plugin/17502
- https://www.sciencedirect.com/science/article/abs/pii/S1569190X22001046
- https://github.com/offroad-robotics/robot-simulator-comparison
- https://www.autodesk.com/products/fusion-360/personal
- https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Fusion-360-Free-License-Changes.html
- https://hackaday.com/2020/09/16/autodesk-announces-major-changes-to-fusion-360-personal-use-license-terms/
- https://www.onshape.com/en/pricing
- https://www.scan2cad.com/blog/cad/onshape-pricing/
- https://onshape4frc.com/calculators
- https://www.simscale.com/product/pricing/
- https://docs.isaacsim.omniverse.nvidia.com/5.1.0/installation/requirements.html
- https://docs.isaacsim.omniverse.nvidia.com/6.0.0/installation/requirements.html
- https://github.com/isaac-sim/IsaacSim/discussions/423
- https://aws.amazon.com/deepracer/faqs/
- https://towardsdatascience.com/aws-deepracer-a-practical-guide-to-reducing-the-sim2real-gap-part-1-580fb1244229/
- https://aws.amazon.com/blogs/machine-learning/celebrating-the-final-aws-deepracer-league-championship-and-road-ahead/
- https://aws-news.com/article/2025-06-19-update-on-the-aws-deepracer-student-portal
- https://arxiv.org/pdf/2011.05617
- https://arxiv.org/pdf/1912.06321
- https://arxiv.org/html/2504.03597v1
- https://roboticsknowledgebase.com/wiki/robotics-project-guide/choose-a-sim/

### Brief 5: Pricing and voice-of-customer
- https://kb.vex.com/hc/en-us/articles/10237033931028-VR-Educators-Start-Here
- https://thelearningcounsel.com/articles/app-of-the-week/coderz-powerful-online-platform-teaches-students-valuable-stem-skills-such-coding-robotics/
- https://www.prnewswire.com/news-releases/imagine-learning-acquires-robotify-innovative-new-platform-designed-to-teach-coding-through-virtual-robotics-simulation-301421187.html
- https://www.siliconrepublic.com/business/robotify-acquired-imagine-learning-edtech-robotics-coding
- https://www.virtualrobotics.education/products/virtual-robotics-toolkit-single-license-perpetual-license
- https://www.smashingrobotics.com/virtual-robotics-toolkit-advanced-lego-mindstorms-simulator/
- https://classic.gazebosim.org/
- https://discourse.openrobotics.org/t/gazebo-classic-end-of-life/48748
- https://gazebosim.org/docs/latest/ros_installation/
- https://gazebosim.org/docs/latest/gazebo_classic_migration/
- https://manual.coppeliarobotics.com/en/licensing.htm
- https://github.com/isaac-sim/IsaacSim
- https://github.com/isaac-sim/IsaacSim/issues/311
- https://mujoco.org/
- https://robodk.com/pricing
- https://robodk.com/forum/Thread-Educational-license-for-student--8426
- https://www.mathworks.com/pricing-licensing.html
- https://www.trustradius.com/products/matlab/pricing
- https://www.theconstruct.ai/pricing/
- https://docs.aws.amazon.com/robomaker/latest/dg/chapter-support-policy.html
- https://www.therobotreport.com/aws-robomaker-shuts-down-after-failing-to-gain-traction/
- https://ftcsimulator.com/
- https://www.vrobotsim.online/
- https://synthesis.autodesk.com/about
- https://news.ycombinator.com/item?id=8948768
- https://news.ycombinator.com/item?id=11384230
- https://news.ycombinator.com/item?id=35204176
- https://news.ycombinator.com/item?id=48586119
- https://news.ycombinator.com/item?id=15754702
- https://news.ycombinator.com/item?id=41277314
- https://news.ycombinator.com/item?id=45478085
- https://news.ycombinator.com/item?id=39920388
- https://news.ycombinator.com/item?id=44902713
- https://github.com/ros-simulation/gazebo_ros_pkgs/issues/1493
- https://answers.ros.org/question/43327/controller-makes-robot-unstable-in-gazebo/
- https://github.com/ms-iot/ROSOnWindows/issues/363
- https://www.mcguirerobotics.com/blog/2025/06/02/ros-2-across-the-windows-verse/
- https://www.vexforum.com/t/vexcode-vr-premium/124134
- https://www.vexforum.com/t/vex-full-volume-vr-code/117438
- https://forums.developer.nvidia.com/t/gpu-requirement/305727