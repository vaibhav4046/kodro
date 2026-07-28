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

  // A message that clearly asks a question is never treated as a command.
  var QUESTION_RE = /^\s*(how|what|why|when|where|which|who|can|could|should|would|does|do|is|are|will|explain|tell me)\b/i;

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

  function findPreset(rows, text) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].re.test(text)) return { id: rows[i].id, label: rows[i].label };
    }
    return null;
  }

  // parse(text) -> { build, world, isCommand }
  //   build: true when the text is an imperative to build/create a robot.
  //   world: {id,label} when the text names a place to move to, else null.
  //   isCommand: build || !!world  (whether any world/robot action should run).
  function parse(text) {
    var raw = String(text || '');
    var t = raw.toLowerCase();
    var isQuestion = QUESTION_RE.test(raw);

    var named = findWorld(t);
    // Never act on a question ("how do I make the rover faster?", "why crash on mars?").
    var build = !isQuestion && BUILD_CMD_RE.test(t);

    // Honour a named world when the message either moves explicitly ("go to
    // mars", "on the moon") OR is itself a build command ("build a mars rover"
    // -> put it on Mars). A bare place phrase ("on/to/in <place>") also counts.
    var explicitMove = !!named && (MOVE_VERB.test(t) || /\b(on|to|in)\s+(the\s+)?[a-z]/.test(t));
    var world = (!isQuestion && named && (explicitMove || build)) ? named : null;

    // Weather and time changes are deterministic app controls, not model
    // guesses. A bare mention such as "does rain affect grip?" remains a
    // question; an explicit "make it rain" becomes an action.
    var time = findPreset(TIMES, t);
    var weather = findPreset(WEATHERS, t);
    var environment = (!isQuestion && ENV_VERB.test(t) && (time || weather))
      ? { time: time, weather: weather } : null;

    var diagnose = DIAGNOSE_RE.test(t);
    var repair = !isQuestion && REPAIR_RE.test(t);
    var speed = null;
    var speedMatch = t.match(/\b(?:set|change|limit|make)\b[^.?!]*\bspeed\b[^0-9]{0,12}(\d{1,3})\s*%?/i);
    if (!isQuestion && speedMatch) speed = Math.max(0, Math.min(100, parseInt(speedMatch[1], 10)));
    else if (!isQuestion && /\b(slow down|slower|reduce speed)\b/i.test(t)) speed = 30;
    else if (!isQuestion && /\b(speed up|faster|increase speed)\b/i.test(t)) speed = 70;

    return {
      build: build,
      world: world,
      environment: environment,
      diagnose: diagnose,
      repair: repair,
      speed: speed,
      isCommand: build || !!world || !!environment || diagnose || repair || speed !== null,
    };
  }

  window.KodroChatIntent = { parse: parse, findWorld: findWorld };
})();
