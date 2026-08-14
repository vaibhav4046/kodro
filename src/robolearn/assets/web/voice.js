/* Kodro voice - speaking and listening for the Companion.
 *
 * Two separate capabilities with two very different privacy stories, and the
 * difference is the whole reason this file exists rather than three lines
 * inline in the chat panel:
 *
 *   SPEAKING (speechSynthesis) can be fully on-device -- but only if the voice
 *   used is a local one. Chrome ships network voices (the "Google ..." ones)
 *   in the SAME getVoices() list as the local ones, and speaking with a network
 *   voice POSTs the text to a server. So pickVoice() filters on
 *   voice.localService === true and, if there is no local voice on the machine,
 *   speaking is switched off with an honest message. It never silently falls
 *   back to a voice that would send the reply off the laptop.
 *
 *   LISTENING (webkitSpeechRecognition) cannot be made on-device in Chrome.
 *   The audio goes to Google's servers. There is no flag that changes that.
 *   So dictation is OFF by default, behind an explicit opt-in that spells out
 *   where the audio goes, and typing always remains available. Nothing in the
 *   product requires a microphone.
 *
 * Speech is never a second command language. A transcript is normalised and
 * handed to the SAME window.KodroChatIntent parser the typed box uses, which
 * feeds the same preview-then-Apply path. A spoken sentence cannot do anything
 * a typed one cannot, and cannot skip a confirmation.
 *
 * The one exception is an interruption. "Stop", "halt" and "mute" are checked
 * BEFORE the parser and never reach it, because a request to stop that queues
 * behind the reply it is trying to stop is not a stop. See isBargeIn.
 *
 * Exposes window.KodroVoice. The pure parts (spokenForm, pickVoice,
 * normaliseTranscript, transcriptIntent) take their inputs as arguments so
 * scripts/qa_voice.mjs can exercise them in Node with no browser.
 */
(function () {
  'use strict';

  var SPEAK_KEY = 'kodro_voice_speak';
  var DICTATION_KEY = 'kodro_voice_dictation';
  var VOICE_NAME_KEY = 'kodro_voice_name';

  // A spoken reply is listened to, not skimmed. Past roughly this length the
  // learner has stopped following, so speech is cut at a sentence boundary and
  // the full text stays on screen where it can be re-read.
  var MAX_SPOKEN = 320;

  // Shown before dictation can be switched on. Deliberately blunt about the
  // network: an opt-in that hides the cost is not consent.
  var DICTATION_NOTICE =
    'Listening uses your browser speech recogniser, which sends the recorded ' +
    'audio to Google to be transcribed. It is the one part of Kodro that ' +
    'leaves this laptop. Everything else, including the reply spoken back to ' +
    'you, stays on this machine. Typing does the same job with nothing sent.';

  function read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      void e;
      return null;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      void e;
    }
  }

  // --- pure: what a reply sounds like ------------------------------------

  /* Turn a chat reply into something worth hearing.
   *
   * Reading Python aloud is useless -- "def move underscore forward open
   * paren" tells a learner nothing they cannot see better on screen -- so code
   * fences are replaced by a single sentence pointing at the editor, and the
   * markdown that makes text scannable but not speakable is stripped.
   */
  function spokenForm(text) {
    var s = String(text == null ? '' : text);
    var hadCode = /```/.test(s);
    // Unterminated fences happen while a reply is still streaming; treat the
    // rest of the string as code rather than reading half a program out.
    s = s.replace(/```[\s\S]*?```/g, ' ').replace(/```[\s\S]*$/, ' ');
    s = s.replace(/`([^`]*)`/g, '$1');
    s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|\s)\*([^*]+)\*/g, '$1$2');
    s = s.replace(/^\s*[-*+]\s+/gm, '');
    s = s.replace(/\s+/g, ' ').trim();
    if (hadCode) {
      s = s ? s + ' The code is in the editor.' : 'The code is in the editor.';
    }
    if (s.length <= MAX_SPOKEN) return s;
    var cut = s.slice(0, MAX_SPOKEN);
    var stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    if (stop > 80) return cut.slice(0, stop + 1) + ' The rest is on screen.';
    return cut.replace(/\s+\S*$/, '') + '... The rest is on screen.';
  }

  // --- pure: which voice is safe to use ----------------------------------

  /* Choose an on-device voice, or nothing.
   *
   * localService === true is the only signal a browser gives for "this voice
   * is synthesised here". Anything else may POST the text, so anything else is
   * not a candidate -- not even as a fallback when the list is otherwise empty.
   */
  function pickVoice(voices, preferredName) {
    var list = [];
    var all = voices || [];
    for (var i = 0; i < all.length; i += 1) {
      if (all[i] && all[i].localService === true) list.push(all[i]);
    }
    if (!list.length) return null;
    var j;
    if (preferredName) {
      for (j = 0; j < list.length; j += 1) {
        if (list[j].name === preferredName) return list[j];
      }
    }
    for (j = 0; j < list.length; j += 1) {
      if (/^en[-_]GB/i.test(list[j].lang || '')) return list[j];
    }
    for (j = 0; j < list.length; j += 1) {
      if (/^en/i.test(list[j].lang || '')) return list[j];
    }
    return list[0];
  }

  /* Every local voice, for the picker in the panel. */
  function localVoices() {
    var synth = window.speechSynthesis;
    if (!synth || typeof synth.getVoices !== 'function') return [];
    var all = synth.getVoices() || [];
    var out = [];
    for (var i = 0; i < all.length; i += 1) {
      if (all[i] && all[i].localService === true) out.push(all[i]);
    }
    return out;
  }

  // --- pure: what a transcript means -------------------------------------

  // Speech recognisers do not know the word "Kodro" and guess, and they do not
  // guess the same way twice. Ten synthesised clips measured through
  // faster-whisper (docs/eval/stt_bench.json) came back as "Caudreau",
  // "Cottro" and "Caudrill", and not one of them was a spelling a hand-written
  // list held. So the list stays for the spellings actually seen, and a sound
  // test sits beside it for the ones nobody has seen yet.
  //
  // Getting this wrong costs twice. The intent parser anchors its question
  // test at the START of the string, so a wake word left in front of "how do
  // I..." turns a question into a command: "Hey Caudreau, how do I make the
  // rover go faster?" measured as isCommand with speed 70, silently changing
  // the robot. And isBargeIn tests the whole utterance, so "Hey Cottro, stop."
  // stops being an interruption at all, which is the one thing that must never
  // fail to fire.
  //
  // The sound test folds a word down to its consonant skeleton: hard c, k and
  // qu all become k, vowels and the semi-vowels h/w/y go, doubled letters
  // collapse. "kodro", "caudreau", "quadro" and "kodrow" all reduce to "kdr".
  // A skeleton of at most four letters opening k-d-r or k-t-r is a mishearing
  // of the product name. The length cap is what keeps real words out:
  // "quadruped" (kdrpd), "quadrant" (kdrnt) and "cathedral" (ktdrl) are five
  // and survive, while "quiet" (kt), "code" (kd), "clear" (klr), "carry" (kr)
  // and "country" (kntr) never reach the prefix at all. "quiet" matters most
  // of those: it is itself a barge-in word.
  var WAKE_WORDS = ['kodro', 'codro', 'kodo', 'quadro', 'cadre', 'kadro', 'kodra'];
  var GREETING_RE = /^(?:hey|hi|ok|okay)$/i;
  var FILLER_WORD_RE = /^(?:um+|uh+|er+|erm+|hmm+)$/i;

  // One leading word plus whatever punctuation the recogniser hung off it.
  // Whole words on purpose: the previous rule matched a bare prefix, so
  // "kodrow stop" came out as "w stop" and "error, stop" lost its "err".
  var LEAD_RE = /^([A-Za-z']+)\s*[,.!:;-]*\s*/;

  function soundSkeleton(word) {
    var s = String(word).toLowerCase().replace(/[^a-z]/g, '');
    s = s.replace(/^qu/, 'k').replace(/q/g, 'k').replace(/c/g, 'k');
    s = s.replace(/[aeiouhwy]/g, '');
    return s.replace(/(.)\1+/g, '$1');
  }

  function isWakeWord(word) {
    var lower = String(word).toLowerCase();
    for (var i = 0; i < WAKE_WORDS.length; i += 1) {
      if (WAKE_WORDS[i] === lower) return true;
    }
    var skeleton = soundSkeleton(lower);
    return skeleton.length <= 4 && /^k[dt]r/.test(skeleton);
  }

  /* Eat the leading greeting, filler and wake word, in whatever order the
   * speaker produced them.
   *
   * A greeting is only dropped when something follows it, so a learner who
   * says nothing but "hi" still sends "hi" to the chat rather than silence.
   * At most one wake word is taken: a second one is part of the sentence.
   */
  function stripLead(text) {
    var s = text;
    var seenGreeting = false;
    var seenWake = false;
    for (var guard = 0; guard < 4; guard += 1) {
      var match = LEAD_RE.exec(s);
      if (!match) break;
      var word = match[1];
      var rest = s.slice(match[0].length);
      if (FILLER_WORD_RE.test(word)) { s = rest; continue; }
      if (!seenGreeting && !seenWake && GREETING_RE.test(word) && rest) {
        seenGreeting = true;
        s = rest;
        continue;
      }
      if (!seenWake && isWakeWord(word)) {
        seenWake = true;
        s = rest;
        continue;
      }
      break;
    }
    return s;
  }

  // Talking over the reply has to stop the reply, not become a message about
  // stopping. The test is whole-utterance on purpose. "Stop the rover at the
  // wall" and "make it stop colliding" are real instructions that the intent
  // parser already claims -- DIAGNOSE_RE and REPAIR_RE both match on the word
  // "stop" -- so a rule that fired on any sentence CONTAINING it would swallow
  // work the learner meant to do. Only a sentence that is nothing but the
  // interruption counts, which is also exactly how a person interrupts.
  var BARGE_RE = /^(?:please\s+)?(?:stop|halt|mute|quiet|be\s+quiet|shut\s+up|stop\s+it|stop\s+(?:talking|speaking|reading)|enough)\s*[.!?,]*$/i;

  /* Tidy dictation into something the typed-text parser can read.
   *
   * Deliberately small. Anything clever here would be a second grammar living
   * next to KodroChatIntent, and the two would drift.
   */
  function normaliseTranscript(raw) {
    var s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    return stripLead(s).trim();
  }

  /* Is this transcript an interruption rather than an instruction?
   *
   * Pure, and normalised first, so "hey Kodro, stop." and a typed "stop" are
   * the same question. Kept out of KodroChatIntent deliberately: an
   * interruption is not an intent the model or the world ever sees, it is the
   * one thing that has to happen before anything else is considered.
   */
  function isBargeIn(raw) {
    var text = normaliseTranscript(raw);
    if (!text) return false;
    return BARGE_RE.test(text);
  }

  /* Normalise, then hand to the one and only intent parser. */
  function transcriptIntent(raw) {
    var text = normaliseTranscript(raw);
    if (!text) return null;
    if (!window.KodroChatIntent || typeof window.KodroChatIntent.parse !== 'function') return null;
    var intent = window.KodroChatIntent.parse(text);
    if (!intent) return null;
    intent.text = text;
    return intent;
  }

  // --- speaking -----------------------------------------------------------

  var speaking = false;

  function speakEnabled() {
    return read(SPEAK_KEY) === '1';
  }

  function setSpeakEnabled(on) {
    write(SPEAK_KEY, on ? '1' : '0');
    if (!on) cancel();
  }

  function voiceName() {
    return read(VOICE_NAME_KEY) || '';
  }

  function setVoiceName(name) {
    write(VOICE_NAME_KEY, String(name || ''));
  }

  /* Say something, on-device or not at all.
   *
   * Returns the reason it did not speak rather than a bare false, so the panel
   * can tell the learner "no on-device voice is installed" instead of leaving
   * a mute button that looks broken.
   */
  function speak(text) {
    var synth = window.speechSynthesis;
    if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return 'unsupported';
    if (!speakEnabled()) return 'off';
    var body = spokenForm(text);
    if (!body) return 'empty';
    var voice = pickVoice(localVoices(), voiceName());
    if (!voice) return 'no-local-voice';
    try {
      synth.cancel();
      var utterance = new window.SpeechSynthesisUtterance(body);
      utterance.voice = voice;
      utterance.lang = voice.lang || 'en-GB';
      utterance.rate = 0.98;
      utterance.pitch = 1;
      utterance.onend = function () {
        speaking = false;
      };
      utterance.onerror = function () {
        speaking = false;
      };
      speaking = true;
      synth.speak(utterance);
      return 'ok';
    } catch (e) {
      void e;
      speaking = false;
      return 'failed';
    }
  }

  function cancel() {
    speaking = false;
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (e) {
      void e;
    }
  }

  function isSpeaking() {
    return speaking;
  }

  // --- listening ----------------------------------------------------------

  function recogniserCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function dictationAvailable() {
    return !!recogniserCtor();
  }

  function dictationConsented() {
    return read(DICTATION_KEY) === '1';
  }

  function setDictationConsent(on) {
    write(DICTATION_KEY, on ? '1' : '0');
    if (!on) stopDictation();
  }

  var active = null;

  /* Start a single dictation turn.
   *
   * continuous is false on purpose: an always-on microphone in a classroom is
   * a different product with a different consent conversation. One press, one
   * sentence, then it stops.
   */
  function startDictation(handlers) {
    var cb = handlers || {};
    var Ctor = recogniserCtor();
    if (!Ctor) return 'unsupported';
    if (!dictationConsented()) return 'not-consented';
    if (active) return 'busy';
    var rec;
    try {
      rec = new Ctor();
    } catch (e) {
      void e;
      return 'failed';
    }
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-GB';
    rec.maxAlternatives = 1;
    rec.onresult = function (event) {
      var finalText = '';
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i += 1) {
        var chunk = event.results[i][0] ? event.results[i][0].transcript : '';
        if (event.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }
      // An interruption outranks everything else in this handler, including
      // the transcript it arrived in. Speech is silenced on the INTERIM guess,
      // before the recogniser has committed to the sentence, because a
      // barge-in that lands a second late has already failed at its one job.
      // Guessing wrong there costs nothing: the reply text stays on screen and
      // no state changes. Only the FINAL result ends the turn, and it returns
      // before cb.onText, so "stop" never becomes a chat message and never
      // reaches a model.
      if (interim && isBargeIn(interim)) cancel();
      if (finalText && isBargeIn(finalText)) {
        bargeIn();
        if (cb.onBarge) cb.onBarge(normaliseTranscript(finalText));
        return;
      }
      if (interim && cb.onInterim) cb.onInterim(normaliseTranscript(interim));
      if (finalText && cb.onText) cb.onText(normaliseTranscript(finalText));
    };
    rec.onerror = function (event) {
      active = null;
      if (cb.onError) cb.onError((event && event.error) || 'error');
    };
    rec.onend = function () {
      active = null;
      if (cb.onEnd) cb.onEnd();
    };
    try {
      rec.start();
    } catch (e) {
      void e;
      active = null;
      return 'failed';
    }
    active = rec;
    return 'ok';
  }

  function stopDictation() {
    if (!active) return false;
    try {
      active.stop();
    } catch (e) {
      void e;
    }
    active = null;
    return true;
  }

  function isListening() {
    return !!active;
  }

  /* Act on an interruption: silence the reply and end the listening turn.
   *
   * Both halves matter. cancel() stops the speech being talked over, and
   * stopDictation() closes the turn rather than leaving a recogniser running
   * with nothing left to transcribe. Returns whether it actually interrupted
   * anything, so the panel can say "Stopped" only when something stopped.
   */
  function bargeIn() {
    var interrupted = speaking || !!active;
    cancel();
    stopDictation();
    return interrupted;
  }

  /* One object the panel can render straight from, so the UI never has to
   * guess why a control is unavailable. */
  function capabilities() {
    var voices = localVoices();
    var synth = !!(window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function');
    return {
      canSpeak: synth && voices.length > 0,
      speechSupported: synth,
      localVoiceCount: voices.length,
      speakEnabled: speakEnabled(),
      dictationSupported: dictationAvailable(),
      dictationConsented: dictationConsented(),
      dictationNotice: DICTATION_NOTICE,
      // The honest one-liner for the panel when speaking is unavailable.
      speakBlockedReason: !synth
        ? 'This browser has no speech synthesiser.'
        : voices.length === 0
          ? 'No on-device voice is installed, and Kodro will not use a voice that sends the text to a server.'
          : '',
    };
  }

  // getVoices() is frequently empty on first call; the list arrives later.
  // Re-dispatch so a mounted panel can re-render its picker.
  try {
    if (window.speechSynthesis && typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', function () {
        try {
          window.dispatchEvent(new window.CustomEvent('kodro-voices-changed'));
        } catch (e) {
          void e;
        }
      });
    }
  } catch (e) {
    void e;
  }

  window.KodroVoice = {
    spokenForm: spokenForm,
    pickVoice: pickVoice,
    localVoices: localVoices,
    normaliseTranscript: normaliseTranscript,
    isBargeIn: isBargeIn,
    transcriptIntent: transcriptIntent,
    capabilities: capabilities,
    speak: speak,
    cancel: cancel,
    isSpeaking: isSpeaking,
    speakEnabled: speakEnabled,
    setSpeakEnabled: setSpeakEnabled,
    voiceName: voiceName,
    setVoiceName: setVoiceName,
    dictationAvailable: dictationAvailable,
    dictationConsented: dictationConsented,
    setDictationConsent: setDictationConsent,
    startDictation: startDictation,
    stopDictation: stopDictation,
    isListening: isListening,
    bargeIn: bargeIn,
    DICTATION_NOTICE: DICTATION_NOTICE,
    MAX_SPOKEN: MAX_SPOKEN,
  };
})();
