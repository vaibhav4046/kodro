/* Voice-layer QA.
 *
 * Three claims the product makes about voice, each of which is a lie if this
 * file fails:
 *
 *   1. Speaking never leaves the laptop. pickVoice must reject every voice with
 *      localService !== true, including when that leaves it nothing to say. A
 *      "helpful" fallback to a Google network voice would POST the reply text.
 *   2. Speech is not a second command language. A transcript is normalised and
 *      handed to KodroChatIntent, so a spoken question stays a question and a
 *      spoken command is exactly as powerful as the typed one -- no more.
 *   3. A reply is spoken as English, not as source code read character by
 *      character.
 *
 * Both modules are loaded the way the browser loads them (bare IIFEs against a
 * window shim), so the code under test is the code that ships.
 *
 *   node scripts/qa_voice.mjs      # exits non-zero on any failure
 */
import { readFileSync } from 'node:fs';

const WEB = new URL('../src/robolearn/assets/web/', import.meta.url);
const VOICE = readFileSync(new URL('voice.js', WEB), 'utf8');
const INTENT = readFileSync(new URL('chat-intent.js', WEB), 'utf8');

// Minimal window shim. No speechSynthesis and no SpeechRecognition: the pure
// functions must work without them, and capabilities() must report the absence
// honestly rather than throwing.
const store = new Map();
const win = {
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  },
  addEventListener() {},
  dispatchEvent() {},
};
new Function('window', INTENT)(win);
new Function('window', VOICE)(win);
const V = win.KodroVoice;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass += 1; else { fail += 1; console.error('FAIL  ' + m); } };

// --- 1. the privacy claim ------------------------------------------------

const NETWORK_VOICE = { name: 'Google UK English Female', lang: 'en-GB', localService: false };
const LOCAL_GB = { name: 'Daniel', lang: 'en-GB', localService: true };
const LOCAL_US = { name: 'Samantha', lang: 'en-US', localService: true };
const LOCAL_DE = { name: 'Anna', lang: 'de-DE', localService: true };

ok(V.pickVoice([NETWORK_VOICE], '') === null,
  'pickVoice returns nothing rather than using a network voice');
ok(V.pickVoice([NETWORK_VOICE, LOCAL_US], '') === LOCAL_US,
  'pickVoice skips the network voice and takes the local one');
ok(V.pickVoice([LOCAL_DE, LOCAL_US, LOCAL_GB], '') === LOCAL_GB,
  'pickVoice prefers en-GB when several local voices exist');
ok(V.pickVoice([LOCAL_DE, LOCAL_US], '') === LOCAL_US,
  'pickVoice falls back to any English local voice before a non-English one');
ok(V.pickVoice([LOCAL_GB, LOCAL_US], 'Samantha') === LOCAL_US,
  'pickVoice honours the saved voice name');
ok(V.pickVoice([LOCAL_GB], 'Google UK English Female') === LOCAL_GB,
  'a saved name that is now a network voice does not resurrect it');
ok(V.pickVoice([], '') === null && V.pickVoice(null, '') === null,
  'pickVoice survives an empty or missing voice list');

// Without speechSynthesis in the shim, speak() must refuse and say why.
ok(V.speak('hello') === 'unsupported', 'speak refuses when the browser has no synthesiser');
const caps = V.capabilities();
ok(caps.canSpeak === false && caps.localVoiceCount === 0,
  'capabilities reports speaking unavailable with no voices');
ok(typeof caps.speakBlockedReason === 'string' && caps.speakBlockedReason.length > 20,
  'capabilities explains in words why speaking is unavailable');
ok(/audio/i.test(V.DICTATION_NOTICE) && /Google/.test(V.DICTATION_NOTICE),
  'the dictation notice names what is sent and where');

// Listening is off until consented, and consent is not implied by support.
ok(V.dictationConsented() === false, 'dictation is off by default');
ok(V.startDictation({}) === 'unsupported', 'startDictation refuses with no recogniser present');
V.setDictationConsent(true);
ok(V.dictationConsented() === true, 'consent persists once given');
V.setDictationConsent(false);
ok(V.dictationConsented() === false, 'consent can be withdrawn');

// --- 2. speech is not a second grammar -----------------------------------

ok(V.normaliseTranscript('  hey Kodro,   build a rover  ') === 'build a rover',
  'normaliseTranscript strips the wake word and collapses whitespace');
ok(V.normaliseTranscript('Codro go to mars') === 'go to mars',
  'a mis-heard wake word is stripped too');
ok(V.normaliseTranscript('um, slow the robot down') === 'slow the robot down',
  'leading filler is dropped');
ok(V.normaliseTranscript('build a rover') === 'build a rover',
  'a transcript with no wake word is left alone');
ok(V.normaliseTranscript('') === '' && V.normaliseTranscript(null) === '',
  'empty input stays empty');

// The load-bearing case: KodroChatIntent anchors its question test at the START
// of the string, so a wake word left in front would turn a question into a
// command. This is why normalisation runs before parsing, not after.
const asked = V.transcriptIntent('Kodro, how do I make the rover go faster?');
ok(asked && asked.isCommand === false,
  'a spoken question stays a question once the wake word is stripped');
const raw = win.KodroChatIntent.parse('Kodro, how do I make the rover go faster?');
ok(raw.speed === 70 && raw.isCommand === true,
  'and without stripping it the parser WOULD have fired -- the reason this step exists');

const built = V.transcriptIntent('hey kodro build me a rover');
ok(built && built.build === true, 'a spoken build command reaches the parser');
const moved = V.transcriptIntent('kodro take me to mars');
ok(moved && moved.world && moved.world.id === 'mars', 'a spoken move command resolves the world');
ok(V.transcriptIntent('   ') === null, 'silence produces no intent');

// A spoken sentence must never gain power a typed one lacks.
const spokenSentences = [
  'build a rover', 'take me to the reef', 'set the time to night',
  'slow the robot down', 'explain the last run', 'how does the ultrasonic work?',
  'write me a python program', 'fix the collision',
];
let sameAsTyped = true;
for (const sentence of spokenSentences) {
  const viaVoice = V.transcriptIntent(sentence);
  const viaKeyboard = win.KodroChatIntent.parse(sentence);
  if (JSON.stringify({ ...viaVoice, text: undefined }) !== JSON.stringify({ ...viaKeyboard, text: undefined })) {
    sameAsTyped = false;
    console.error('      differs: ' + sentence);
  }
}
ok(sameAsTyped, 'every spoken sentence parses identically to the typed one');

// --- 2b. reaching the lessons by voice -----------------------------------
//
// The platform is a lesson library first. If the mic can drive the rover to
// Mars but cannot open lesson five, voice is a toy bolted to the side rather
// than a way to use the product. These cases pin both halves: the phrases that
// must open a lesson, and the near-misses that must not.

const L = t => { const i = win.KodroChatIntent.parse(t); return i.lesson ? i.lesson.id : null; };

ok(L('open the loops lesson') === '05_iteration',
  'naming a lesson with an opening verb resolves it');
ok(L('teach me recursion') === '09_recursion',
  'asking to be taught a topic opens its lesson without the word "lesson"');
ok(L('start lesson 5') === '05_iteration',
  'a lesson number resolves to the lesson with that filename prefix');
const spokenLesson = V.transcriptIntent('hey kodro open the pathfinding lesson');
ok(spokenLesson && spokenLesson.lesson && spokenLesson.lesson.id === '08_pathfinding',
  'a spoken lesson command survives wake-word stripping and reaches the parser');

// Ordering inside the LESSONS table. Each of these has a more generic entry
// that would swallow it if the table were listed in file order.
ok(L('open the nested loops lesson') === '13_nested_loops',
  'nested loops beats the plain iteration lesson');
ok(L('teach me functions with parameters') === '15_parameters',
  'parameters beats the plain functions lesson');
ok(L('open the counting lesson') === '14_counting',
  'counting beats the variables lesson, whose own title contains "variable"');
ok(L('open the fix the condition lesson') === '04a_fix_the_condition',
  'the repair lesson beats selection, which matches the word "condition"');

// Near-misses. Opening a lesson resets the stage and swaps the program buffer,
// so firing on a sentence that only mentions one would be an unasked-for jump.
ok(L('how do I finish the loops lesson') === null,
  'a wh-question about a lesson is not a request to open it');
ok(L('should I start the loops lesson') === null,
  'a hypothetical about a lesson is not a request to open it');
ok(L('my loop is broken') === null,
  'a bare topic word in a coding problem stays a coding problem');
ok(L('this lesson is hard') === null,
  'naming a lesson without a verb that opens it is not a command');
ok(L('write me the code for the loops lesson') === null,
  'a code request stays a code request: the model drafts, the library is untouched');

// Precedence. One sentence must not trigger two competing project changes.
const both = win.KodroChatIntent.parse('take me to the recursion lesson on mars');
ok(both.lesson && both.lesson.id === '09_recursion' && both.world === null,
  'a lesson wins over a world named in the same sentence');

// --- 3. what a reply sounds like -----------------------------------------

const withCode = 'Here is the fix:\n```python\nmove_forward(2)\nturn_left(90)\n```\nApply it when ready.';
const said = V.spokenForm(withCode);
ok(!/move_forward|```/.test(said), 'spokenForm never reads a code block aloud');
ok(/Here is the fix/.test(said) && /code is in the editor/i.test(said),
  'spokenForm keeps the prose and points at the editor');
ok(V.spokenForm('```python\nx = 1\n```') === 'The code is in the editor.',
  'a reply that is only code becomes one short sentence');
ok(V.spokenForm('Start the ```python\nx = 1') === 'Start the The code is in the editor.'
  || !/x = 1/.test(V.spokenForm('Start the ```python\nx = 1')),
  'a half-streamed code fence is not read out');
ok(V.spokenForm('## Heading\n- **bold** point\n- `code` word') === 'Heading bold point code word',
  'markdown scaffolding is stripped');
const long = V.spokenForm('This is a sentence. '.repeat(60));
ok(long.length < 400 && /on screen/.test(long),
  'a long reply is cut short and says where the rest is');
ok(V.spokenForm('') === '' && V.spokenForm(null) === '' && V.spokenForm(undefined) === '',
  'spokenForm survives empty input');

console.log((fail ? 'FAIL' : 'PASS') + '  voice: ' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
