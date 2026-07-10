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
    { re: /\bmars\b|\bmartian\b|\bred planet\b/, id: 'mars', label: 'Mars' },
    { re: /\bolympus\b/, id: 'olympus', label: 'Olympus Mons, Mars' },
    { re: /\bunderwater\b|\bocean\b|\bsea ?floor\b|\bunder the sea\b|\bseabed\b/, id: 'underwater', label: 'the ocean floor' },
    { re: /\breef\b|\bcoral\b/, id: 'reef', label: 'a coral reef' },
    { re: /\bmariana\b|\bdeep ?sea\b|\babyss\b/, id: 'mariana', label: 'the Mariana Trench' },
    { re: /\bmoon\b|\blunar\b|\btycho\b/, id: 'space', label: 'the Moon' },
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
    { re: /\bearth\b|\bgrass\b|\bfield\b/, id: 'earth', label: 'Earth' },
  ];

  // A message that clearly asks a question is never treated as a command.
  var QUESTION_RE = /^\s*(how|what|why|when|where|which|who|can|could|should|would|does|do|is|are|will|explain|tell me)\b/i;

  // A build command needs the verb, an INDEFINITE article (a/an/new/another/…),
  // then a robot noun. The article is what separates "make A rover" (build) from
  // "make THE rover spin" (a coding request about the existing robot).
  var BUILD_CMD_RE = /\b(build|make|create|design|assemble|construct|spawn|give me|i want|i need|let'?s build)\b[^.?!]*?\b(a|an|another|new|some|\d+)\b[^.?!]*?\b(rover|robot|car|vehicle|arm|manipulator|drone|bot|crawler|buggy|machine)\b/i;
  var MOVE_VERB = /\b(go to|take me to|take us to|switch to|move to|drive to|send (me|it|us) to|put (me|it|us) (on|in)|set the world to|explore|deploy (on|in|to)|visit|travel to)\b/i;

  function findWorld(t) {
    for (var i = 0; i < WORLDS.length; i++) {
      if (WORLDS[i].re.test(t)) return { id: WORLDS[i].id, label: WORLDS[i].label };
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

    return { build: build, world: world, isCommand: build || !!world };
  }

  window.KodroChatIntent = { parse: parse, findWorld: findWorld };
})();
