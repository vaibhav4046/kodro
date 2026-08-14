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
/* The dictation notice has to survive being read on any engine, because
 * recogniserCtor() takes whatever the runtime exposes and the shipped desktop
 * surface is the platform web view, not Chrome. The notice used to say the
 * audio went to Google, which is a claim the code never establishes and which
 * is wrong wherever the engine is not Chrome's. These five checks pin the
 * facts that hold everywhere and forbid the regression that named one vendor.
 *
 * The vendor check is deliberately a denylist of the three companies whose
 * engines the product can actually land on, not a ban on the word "browser":
 * the notice must still say who receives the audio in general terms. */
ok(/audio/i.test(V.DICTATION_NOTICE), 'the dictation notice says audio is what gets sent');
ok(/off this machine|leaves this laptop/i.test(V.DICTATION_NOTICE),
  'the dictation notice says the recording leaves the device');
ok(/not to Kodro|nor see|neither choose/i.test(V.DICTATION_NOTICE),
  'the dictation notice says Kodro neither picks nor can inspect the recipient');
ok(!/\b(Google|Microsoft|Apple)\b/.test(V.DICTATION_NOTICE),
  'the dictation notice names no single vendor as the recipient, since the engine decides');
ok(/typing/i.test(V.DICTATION_NOTICE),
  'the dictation notice offers typing as the alternative that sends nothing');

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

// --- 2a. the wake word a recogniser actually returns ----------------------
//
// Every string below is verbatim output from faster-whisper on the ten clips
// in docs/eval/stt_bench.json. None of them spells the product name, and
// before the sound test was added none of them was stripped: the question
// became a speed command and the interruption stopped interrupting. These are
// the measured cases, so they are the ones pinned.

ok(V.normaliseTranscript('Hey Caudreau, build me a rover.') === 'build me a rover.',
  'the wake word whisper actually produces is stripped');
ok(V.normaliseTranscript('Caudreau take me to Mars.') === 'take me to Mars.',
  'a mishearing with no greeting in front of it is stripped');
ok(V.normaliseTranscript('Hey Cottro open the path finding lesson.') === 'open the path finding lesson.',
  'a second mishearing of the same word is stripped');
ok(V.isBargeIn('Hey Cottro, stop.') === true,
  'the interruption whisper heard as "Cottro" still interrupts');
ok(V.isBargeIn('Hey, Caudrill. Stop.') === true && V.isBargeIn('Hey Caudrill, stop.') === true,
  'and so does the one it heard as "Caudrill", in both punctuations it produced');
const misheard = V.transcriptIntent('Hey Caudreau, how do I make the rover go faster?');
ok(misheard && misheard.isCommand === false && misheard.speed == null,
  'a question survives a mis-heard wake word instead of setting the speed');

// Whole words only. The old rule matched a bare prefix, so "kodrow" left a
// stray "w" in front of the sentence and "errors" lost its "err".
ok(V.normaliseTranscript('kodrow stop') === 'stop',
  'a longer mishearing is consumed whole, leaving no debris');
ok(V.normaliseTranscript('errors in my loop') === 'errors in my loop',
  'a word that merely starts like a filler sound is left intact');

// The sound test earns its keep by what it refuses. Each of these is a word a
// learner really says, and each one is close enough to the product name that a
// looser rule would eat it. "quiet" matters most: it is a barge-in word.
ok(V.normaliseTranscript('quiet') === 'quiet' && V.isBargeIn('quiet') === true,
  'the sound test does not swallow "quiet", which is itself an interruption');
for (const kept of [
  'clear the program', 'code a rover for me', 'country roads', 'carry the value',
  'quadrant three is empty', 'cathedral world please', 'quadruped robot',
]) {
  ok(V.normaliseTranscript(kept) === kept,
    'the sound test leaves a real word alone: ' + JSON.stringify(kept));
}

// A greeting on its own is a message, not a prefix to something else.
ok(V.normaliseTranscript('hi') === 'hi' && V.normaliseTranscript('okay') === 'okay',
  'a bare greeting reaches the chat instead of being stripped to nothing');
ok(V.normaliseTranscript('okay stop') === 'stop',
  'but a greeting in front of an interruption is dropped');

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

// --- 2c. interrupting ----------------------------------------------------
//
// "Stop" outranks everything else. The risk is not that it fails to fire, it
// is that it fires too eagerly: the intent parser already claims sentences
// containing the word ("stop it colliding" is a repair request, "why did it
// stop" is a diagnosis), and swallowing one of those would silently throw away
// work the learner asked for. So both halves are pinned here.

for (const said of [
  'stop', 'Stop.', 'stop!', 'STOP', 'halt', 'mute', 'quiet', 'be quiet',
  'shut up', 'stop talking', 'stop speaking', 'stop reading', 'stop it',
  'enough', 'please stop', 'hey kodro, stop', 'Kodro stop.', 'um, stop',
]) {
  ok(V.isBargeIn(said) === true, 'isBargeIn accepts the interruption: ' + JSON.stringify(said));
}

for (const said of [
  'stop the rover when it sees a wall',
  'make it stop colliding',
  'why did it stop',
  'stop at the red wall',
  'how do I stop the loop',
  'the robot stopped',
  'mute the sound in lesson three',
  '', '   ',
]) {
  ok(V.isBargeIn(said) === false, 'isBargeIn refuses the instruction: ' + JSON.stringify(said));
}
ok(V.isBargeIn(null) === false && V.isBargeIn(undefined) === false,
  'isBargeIn survives missing input');

// The load-bearing half of the near-misses: they are not merely "not a stop",
// they are commands that still work. A barge-in rule that ate these would look
// fine in isolation and lose a repair request in the product.
const stillWorks = win.KodroChatIntent.parse('make it stop colliding');
ok(stillWorks.repair === true, 'a repair request containing "stop" survives the barge-in check');
const stillDiagnoses = win.KodroChatIntent.parse('why did it stop');
ok(stillDiagnoses.diagnose === true, 'a diagnosis containing "stop" survives the barge-in check');

// Priority inside the recogniser. A fake recogniser is installed here rather
// than earlier so the "no recogniser present" assertions above still test the
// real absence.
function makeEvent(text, isFinal) {
  const result = [{ transcript: text }];
  result.isFinal = isFinal;
  return { resultIndex: 0, results: [result] };
}
let live = null;
function FakeRecogniser() { live = this; }
FakeRecogniser.prototype.start = function () { };
FakeRecogniser.prototype.stop = function () { if (this.onend) this.onend(); };
win.SpeechRecognition = FakeRecogniser;
V.setDictationConsent(true);

const heard = [], barged = [], seen = [];
const turn = () => V.startDictation({
  onInterim: t => seen.push(t),
  onText: t => heard.push(t),
  onBarge: t => barged.push(t),
  onEnd: () => { },
});

ok(turn() === 'ok', 'startDictation runs once a recogniser exists and consent is given');
live.onresult(makeEvent('sto', false));
live.onresult(makeEvent('stop', true));
ok(barged.length === 1 && barged[0] === 'stop', 'a final "stop" fires the barge-in callback');
ok(heard.length === 0, 'and never reaches onText, so it never becomes a chat message or a model call');
ok(V.isListening() === false, 'the listening turn ends on a barge-in');

ok(turn() === 'ok', 'a new turn starts after an interruption');
live.onresult(makeEvent('build a rover', true));
ok(heard.length === 1 && heard[0] === 'build a rover',
  'an ordinary sentence still reaches onText unchanged');
V.stopDictation();

ok(turn() === 'ok', 'and a third turn starts');
live.onresult(makeEvent('make it stop colliding', true));
ok(heard.length === 2 && heard[1] === 'make it stop colliding' && barged.length === 1,
  'a sentence that merely contains "stop" is passed through, not swallowed');
V.stopDictation();

// bargeIn() itself is safe with nothing to interrupt: the panel calls it from a
// typed "stop" too, where there may be no speech and no microphone at all.
ok(V.bargeIn() === false, 'bargeIn reports honestly that it interrupted nothing');
delete win.SpeechRecognition;
V.setDictationConsent(false);

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
