/* Chat intent parser for the Vibe assistant. Decides whether a chat message is
 * a COMMAND to build a robot or move to a world/site, versus an ordinary
 * request the model should answer with code or words.
 *
 * Deliberately CONSERVATIVE: a coding question like "how do I make the rover go
 * faster?" must NOT trigger a rebuild. Only clear imperative build/move phrasing
 * fires an action; everything else falls through to the normal chat path. Pure
 * and deterministic so it can be unit-tested without a browser.
 */
(function () {
  'use strict';

  // Natural-language -> world / site id, with a human label for the reply.
  // Base worlds: city, room, earth, mars, underwater, space. The rest are sites.
  var WORLDS = [
    // Specific sites come before their base worlds. "Olympus Mons on Mars"
    // must open Olympus, not stop at the first generic Mars match.
    { re: /\bolympus\b/, id: 'olympus', label: 'Olympus Mons, Mars' },
    { re: /\bmariana\b|\bchallenger deep\b|\babyss\b/, id: 'mariana', label: 'the Mariana Trench' },
    { re: /\breef\b|\bcoral\b|\bgreat barrier\b/, id: 'reef', label: 'the Great Barrier Reef' },
    { re: /\btycho\b|\bmoon\b|\blunar\b/, id: 'tycho', label: 'Tycho Crater on the Moon' },
    { re: /\beuropa\b/, id: 'europa', label: 'Europa' },
    { re: /\bwarehouse\b/, id: 'warehouse', label: 'the warehouse' },
    { re: /\blab\b|\blaboratory\b|\btest bay\b/, id: 'lab', label: 'the robotics lab' },
    { re: /\bcity\b|\bstreet\b|\broad\b|\btraffic\b|\burban\b/, id: 'city', label: 'the city streets' },
    { re: /\broom\b|\bhome\b|\bhouse\b|\bindoor\b/, id: 'room', label: 'a home room' },
    { re: /\bsahara\b|\bdesert\b/, id: 'sahara', label: 'the Sahara' },
    { re: /\bamazon\b|\bjungle\b|\brainforest\b/, id: 'amazon', label: 'the Amazon' },
    { re: /\bantarctica\b|\bantarctic\b|\bice\b/, id: 'antarctica', label: 'Antarctica' },
    { re: /\bindia\b/, id: 'india', label: 'India' },
    { re: /\bkenya\b|\bsavann?ah?\b/, id: 'kenya', label: 'Kenya' },
    { re: /\bjapan\b|\btokyo\b/, id: 'japan', label: 'Japan' },
    { re: /\begypt\b|\bpyramid\b/, id: 'egypt', label: 'Egypt' },
    { re: /\biceland\b|\bvolcan/, id: 'iceland', label: 'Iceland' },
    { re: /\bnepal\b|\bhimalaya|\bmountain\b/, id: 'nepal', label: 'Nepal' },
    { re: /\bmars\b|\bmartian\b|\bred planet\b/, id: 'mars', label: 'Mars' },
    { re: /\bunderwater\b|\bocean\b|\bsea ?floor\b|\bunder the sea\b|\bseabed\b/, id: 'underwater', label: 'the ocean floor' },
    { re: /\bspace\b|\borbit\b/, id: 'space', label: 'space' },
    { re: /\bearth\b|\bgrass\b|\bfield\b/, id: 'earth', label: 'Earth' },
  ];

  var TIMES = [
    { re: /\bdawn\b|\bsunrise\b|\bearly morning\b/, id: 'dawn', label: 'dawn' },
    { re: /\bdusk\b|\bsunset\b|\bevening\b/, id: 'dusk', label: 'dusk' },
    { re: /\bnight\b|\bnight-time\b|\bnighttime\b|\bdark\b/, id: 'night', label: 'night' },
    { re: /\bnoon\b|\bmidday\b|\bdaylight\b|\bday time\b|\bdaytime\b/, id: 'noon', label: 'noon' },
  ];
  var WEATHERS = [
    { re: /\bdust storm\b|\bsandstorm\b|\bstorm\b/, id: 'storm', label: 'a dust storm' },
    { re: /\brain\b|\braining\b|\brainy\b|\bwet weather\b/, id: 'rain', label: 'rain' },
    { re: /\bsnow\b|\bsnowing\b|\bsnowy\b/, id: 'snow', label: 'snow' },
    { re: /\bclear\b|\bclear weather\b|\bno weather\b|\bdry weather\b/, id: 'clear', label: 'clear weather' },
  ];

  // Natural-language -> lesson id. Ordered SPECIFIC BEFORE GENERIC for the same
  // reason WORLDS is: "nested loops" must not stop at the plain loops lesson,
  // "functions with parameters" must not stop at functions, and "counting" must
  // not stop at variables (the counting lesson's own title contains the word
  // "variable"). The ids are the filenames in lessons/library, and a unit test
  // asserts every id here still exists there.
  var LESSONS = [
    { re: /\bbroken program\b|\bfix the turn\b|\bfix the broken\b/, id: '00d_fix_the_turn', label: 'Fix the Broken Program' },
    { re: /\bbackwards test\b|\bfix the condition\b|\bbackward test\b/, id: '04a_fix_the_condition', label: 'Fix the Backwards Test' },
    { re: /\blook before you move\b|\blook first\b/, id: '00c_look_first', label: 'Look Before You Move' },
    { re: /\bsquare\b/, id: '00b_repeat_square', label: 'Make a Square' },
    { re: /\bnested loops?\b|\bloop inside a loop\b|\bloops? in(?:side)? loops?\b/, id: '13_nested_loops', label: 'Nested loops' },
    { re: /\bparameters?\b|\barguments?\b/, id: '15_parameters', label: 'Functions with parameters' },
    { re: /\bfunctions?\b|\bsubroutines?\b|\bprocedures?\b/, id: '06_functions', label: 'Functions' },
    { re: /\bcounting\b|\bcounter\b|\bcount up\b/, id: '14_counting', label: 'Counting with a variable' },
    { re: /\bvariables?\b|\bone name used twice\b/, id: '16_variables', label: 'One name, used twice' },
    { re: /\blists?\b|\barrays?\b/, id: '17_lists', label: 'A list drives the route' },
    { re: /\brecursion\b|\brecursive\b/, id: '09_recursion', label: 'Recursion' },
    { re: /\boptimisation\b|\boptimization\b|\boptimis|\boptimiz/, id: '10_optimisation', label: 'Optimisation' },
    { re: /\bdecomposition\b|\bdecompose\b|\bbreak(?:ing)? (?:it|the problem) down\b/, id: '11_decomposition', label: 'Decomposition' },
    { re: /\babstraction\b|\babstract\b/, id: '12_abstraction', label: 'Abstraction' },
    { re: /\bpathfinding\b|\bpath finding\b|\bmaze\b|\bshortest path\b/, id: '08_pathfinding', label: 'Pathfinding basics' },
    { re: /\bsensors?\b|\bsensing\b/, id: '07_sensors', label: 'Reading sensors' },
    { re: /\biteration\b|\bwhile[- ]loops?\b|\bloops?\b|\blooping\b|\brepeat\b|\brepeating\b/, id: '05_iteration', label: 'Iteration with while-loops' },
    { re: /\bselection\b|\bif ?\/ ?else\b|\bif[- ]else\b|\bif statements?\b|\bconditionals?\b|\bcondition\b/, id: '04_selection', label: 'Selection (if / else)' },
    { re: /\bsequence\b|\bsequencing\b|\bin order\b/, id: '03_sequence', label: 'Sequence' },
    { re: /\bmove and turn\b|\bmoving and turning\b/, id: '02_move_turn', label: 'Move and turn' },
    { re: /\bturn the corner\b|\bcorner\b/, id: '00a_turn_the_corner', label: 'Turn the Corner' },
    { re: /\bhello,? rover\b|\bfirst programme?\b/, id: '01_hello_rover', label: 'Hello, Rover!' },
    { re: /\bdrive to the flag\b|\bfirst drive\b|\bflag\b/, id: '00_first_drive', label: 'Drive to the Flag' },
    { re: /\bwatch it,? then change it\b|\bwatch it go\b/, id: '000_watch_it_go', label: 'Watch It, Then Change It' },
  ];

  // A message that clearly asks a question is never treated as a command.
  var QUESTION_RE = /^\s*(how|what|why|when|where|which|who|can|could|should|would|does|do|is|are|will|explain|tell me)\b/i;
  // Lesson gating, kept as conservative as the rest of the file. A bare topic
  // word is NOT enough: "my loop is broken" must stay a coding question. Either
  // the learner names the thing ("lesson", "exercise") or asks to be taught it.
  var LESSON_MARK = /\blessons?\b|\btutorials?\b|\bexercises?\b|\bactivit(?:y|ies)\b|\bchallenges?\b/;
  var LESSON_VERB = /\b(?:teach|learn|learning|practi[sc]e|practi[sc]ing|study|revise)\b/;
  var OPEN_VERB = /\b(?:open|start|begin|load|launch|resume|continue|do|go to|take me to|switch to|jump to|show me|next)\b/;
  // "how do I finish the loops lesson" and "should I start the loops lesson"
  // are asking ABOUT a lesson. Opening one would answer a question the learner
  // did not ask, so both interrogative shapes are refused outright.
  var WH_RE = /^\s*(?:how|what|why|when|where|which|who)\b/;
  var HYPOTHETICAL_RE = /^\s*(?:should|would|is|are|will|does|did|has|have|am|was)\b/;
  var LESSON_NUM_RE = /\blessons?\s*(?:number\s*)?(\d{1,2})\b/;
  // A request for code may legitimately mention a world, speed, collision or
  // weather as program context. Let the model draft and validate that program
  // instead of firing one of the immediate project-control shortcuts.
  var CODE_REQUEST_RE = /\b(code|program|programme|python|script|function|loop|complete replacement|replace (the )?current program)\b/i;

  // A build command needs the verb, an INDEFINITE article (a/an/new/another/…),
  // then a robot noun. The article is what separates "make A rover" (build) from
  // "make THE rover spin" (a coding request about the existing robot).
  var BUILD_CMD_RE = /\b(build|make|create|design|assemble|construct|spawn|give me|i want|i need|let'?s build)\b[^.?!]*?\b(a|an|another|new|some|\d+)\b[^.?!]*?\b(rover|robot|car|vehicle|arm|manipulator|drone|bot|crawler|buggy|machine)\b/i;
  var MOVE_VERB = /\b(go to|take me to|take us to|switch to|move to|drive to|send (me|it|us) to|put (me|it|us) (on|in)|set the world to|explore|deploy (on|in|to)|visit|travel to)\b/i;
  var ENV_VERB = /\b(set|switch|change|make|turn|use|add|show|give me|i want)\b/i;
  var DIAGNOSE_RE = /\b(why|explain|diagnose|what happened|what went wrong|reason)\b[^.?!]*\b(crash|collision|collide|fail|failed|failure|stuck|stall|stalled|stop|stopped|battery|run|test|movement|move)\b|\b(explain|diagnose)\s+(the\s+)?(last\s+)?(run|test|result|collision|failure)\b/i;
  var REPAIR_RE = /\b(fix|repair|prevent|avoid|solve|stop)\b[^.?!]*\b(crash|collision|colliding|failure|failing|obstacle|hazard)\b|\b(make|keep)\b[^.?!]*\b(safer|safe)\b/i;

  function findWorld(t) {
    for (var i = 0; i < WORLDS.length; i++) {
      if (WORLDS[i].re.test(t)) return { id: WORLDS[i].id, label: WORLDS[i].label };
    }
    return null;
  }

  /* "lesson 5" -> the lesson whose filename starts 05_. Only the two-digit
   * prefixes are addressable this way: 00a/00b/00c/00d and 000 are the
   * pre-numbered starter lessons and are reached by name, not by number.
   */
  function lessonByNumber(t) {
    var m = t.match(LESSON_NUM_RE);
    if (!m) return null;
    var n = parseInt(m[1], 10);
    if (isNaN(n)) return null;
    var prefix = (n < 10 ? '0' : '') + n + '_';
    for (var i = 0; i < LESSONS.length; i++) {
      if (LESSONS[i].id.indexOf(prefix) === 0) return { id: LESSONS[i].id, label: LESSONS[i].label };
    }
    return null;
  }

  /* Decide whether the text asks to OPEN a lesson, and which one.
   *
   * Two ways in. Either the learner names the artefact ("open the loops
   * lesson", "lesson 5") or asks to be taught the topic ("teach me
   * recursion"). Naming a lesson without a verb that opens it ("this lesson is
   * hard") is not a command, and neither is any question about a lesson.
   */
  function findLesson(t) {
    if (WH_RE.test(t) || HYPOTHETICAL_RE.test(t)) return null;
    var marked = LESSON_MARK.test(t);
    var teaching = LESSON_VERB.test(t);
    if (!marked && !teaching) return null;
    if (marked && !teaching && !OPEN_VERB.test(t)) return null;
    var numbered = marked ? lessonByNumber(t) : null;
    if (numbered) return numbered;
    for (var i = 0; i < LESSONS.length; i++) {
      if (LESSONS[i].re.test(t)) return { id: LESSONS[i].id, label: LESSONS[i].label };
    }
    return null;
  }

  function findPreset(rows, text) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].re.test(text)) return { id: rows[i].id, label: rows[i].label };
    }
    return null;
  }

  // parse(text) -> { build, world, lesson, environment, diagnose, repair, speed, isCommand }
  //   build: true when the text is an imperative to build/create a robot.
  //   world: {id,label} when the text names a place to move to, else null.
  //   lesson: {id,label} when the text asks to open a lesson, else null. Wins
  //     over build and world, which it suppresses.
  //   isCommand: true when any of the above should run.
  function parse(text) {
    var raw = String(text || '');
    var t = raw.toLowerCase();
    var isQuestion = QUESTION_RE.test(raw);
    var isCodeRequest = CODE_REQUEST_RE.test(t);

    // Lesson navigation runs its own, narrower question test rather than the
    // blanket one. "Can you open the loops lesson" opens with an interrogative
    // but is a request, and refusing it would leave the mic unable to reach the
    // one thing the platform is for. "Write me the code for the loops lesson"
    // stays a code request: the model drafts, the library is not touched.
    var lesson = !isCodeRequest ? findLesson(t) : null;

    var named = findWorld(t);
    // Never act on a question ("how do I make the rover faster?", "why crash on mars?").
    // Opening a lesson also swaps the world and the program buffer, so it wins
    // outright: one sentence must not trigger two competing project changes.
    var build = !lesson && !isQuestion && !isCodeRequest && BUILD_CMD_RE.test(t);

    // Honour a named world when the message either moves explicitly ("go to
    // mars", "on the moon") OR is itself a build command ("build a mars rover"
    // -> put it on Mars). A bare place phrase ("on/to/in <place>") also counts.
    var explicitMove = !!named && (MOVE_VERB.test(t) || /\b(on|to|in)\s+(the\s+)?[a-z]/.test(t));
    var world = (!lesson && !isQuestion && !isCodeRequest && named && (explicitMove || build)) ? named : null;

    // Weather and time changes are deterministic app controls, not model
    // guesses. A bare mention such as "does rain affect grip?" remains a
    // question; an explicit "make it rain" becomes an action.
    var time = findPreset(TIMES, t);
    var weather = findPreset(WEATHERS, t);
    var environment = (!isQuestion && !isCodeRequest && ENV_VERB.test(t) && (time || weather))
      ? { time: time, weather: weather } : null;

    var diagnose = !isCodeRequest && DIAGNOSE_RE.test(t);
    var repair = !isQuestion && !isCodeRequest && REPAIR_RE.test(t);
    var speed = null;
    var speedMatch = t.match(/\b(?:set|change|limit|make)\b[^.?!]*\bspeed\b[^0-9]{0,12}(\d{1,3})\s*%?/i);
    if (!isQuestion && !isCodeRequest && speedMatch) speed = Math.max(0, Math.min(100, parseInt(speedMatch[1], 10)));
    else if (!isQuestion && !isCodeRequest && /\b(slow down|slower|reduce speed)\b/i.test(t)) speed = 30;
    else if (!isQuestion && !isCodeRequest && /\b(speed up|faster|increase speed)\b/i.test(t)) speed = 70;

    return {
      build: build,
      world: world,
      lesson: lesson,
      environment: environment,
      diagnose: diagnose,
      repair: repair,
      speed: speed,
      isCommand: build || !!world || !!lesson || !!environment || diagnose || repair || speed !== null,
    };
  }

  window.KodroChatIntent = { parse: parse, findWorld: findWorld, findLesson: findLesson, LESSONS: LESSONS };
})();
