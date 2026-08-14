# Local speech-to-text benchmark

What a small offline transcriber costs on the target machine, measured rather than
estimated. Regenerate with:

```bash
python scripts/bench_stt.py --synthesize
```

The `--synthesize` flag rewrites the ten clips in `docs/eval/stt_clips/` first;
without it the script measures the clips already there. Raw output lives in
`docs/eval/stt_bench.json`, which is the file to quote from. This page is a
reading of it, not a second source.

## What was measured

| | |
|---|---|
| Model | `Systran/faster-whisper-base.en` |
| Backend | faster-whisper / CTranslate2 |
| Device, precision | CPU, int8, beam size 1 |
| Downloads during the run | none; `local_files_only=True` |
| Host | Windows 11 (10.0.26200), Intel64 Family 6 Model 151, Python 3.13.3 |
| Clips | 5 commands x 2 voices, 5 timed repeats each |
| Run date | 14 August 2026 |

The five commands are lifted verbatim from `scripts/qa_voice.mjs`, so the audio
exercises the grammar that actually ships rather than sentences chosen to be
easy to hear.

## Cost

| Measure | Value |
|---|---|
| Model load, fresh process | 1.587 s |
| Peak resident memory | 367.5 MB (53.4 MB baseline, so about 314 MB for the model) |
| Median transcription latency | 0.885 s |
| Worst transcription latency | 1.339 s |
| Median real-time factor | 0.371 |
| GPU float16 | unavailable: `RuntimeError: Library cublas64_12.dll is not found or cannot be loaded` |

A real-time factor of 0.371 means a 2.4 second command takes about 0.9 seconds
to transcribe: usable, and well under the point where a learner would assume the
app had ignored them.

### Cold and warm

Every clip was transcribed five times. The first call and the median differ by
under 0.1 s on eight of the ten clips, so there is no meaningful per-clip warm-up
once the model is loaded. The warm-up that matters is the 1.587 s model load,
paid once per process. That number is itself warm in one respect worth stating:
the operating system file cache already held the model weights, so a genuinely
cold disk would be slower.

### The GPU is not available on this machine

The 6 GB RTX 3050 cannot run this path. CTranslate2 needs the CUDA 12 cuBLAS
runtime and it is not installed, so `device="cuda"` fails the moment work is
submitted. Worth stating plainly because the check that produced this line had to
be fixed to get it: constructing `WhisperModel(device="cuda")` succeeds on this
machine and only transcription fails, so an earlier construction-only probe
reported "available" and was wrong. The CPU numbers above are the real ones.

## Accuracy

**These are synthetic-speech word error rates.** The clips are Windows
`System.Speech` synthesis at 16 kHz mono, which is a real waveform through a real
acoustic model but is not a person. Treat every rate below as an upper bound on
how clean audio can get, never as a prediction of a classroom with background
noise and a child's voice. No human speech was recorded or measured.

| Command | Voice | Audio | Median | RTF | WER | Transcript |
|---|---|---|---|---|---|---|
| build | David | 2.40 s | 0.952 s | 0.397 | 0.167 | `Hey Caudreau, build me a rover.` |
| build | Zira | 2.50 s | 0.683 s | 0.274 | 0.167 | `Hey Caudreau, build me a rover.` |
| world | David | 2.37 s | 1.339 s | 0.566 | 0.200 | `Caudreau take me to Mars.` |
| world | Zira | 2.35 s | 0.796 s | 0.339 | 0.200 | `Caudreau take me to Mars.` |
| lesson | David | 2.06 s | 0.916 s | 0.446 | 0.000 | `Open the loops lesson.` |
| lesson | Zira | 2.06 s | 1.188 s | 0.577 | 0.000 | `Open the loops lesson.` |
| lesson_spoken | David | 3.10 s | 0.749 s | 0.242 | 0.500 | `Hey Cottro open the path finding lesson.` |
| lesson_spoken | Zira | 3.09 s | 0.797 s | 0.258 | 0.500 | `Hey Caudreau open the path finding lesson.` |
| barge_in | David | 2.48 s | 0.853 s | 0.345 | 0.333 | `Hey Cottro, stop.` |
| barge_in | Zira | 2.53 s | 1.031 s | 0.408 | 0.333 | `Hey Caudrill, stop.` |

Aggregate word error rate 0.25, computed over all words rather than as a mean of
per-clip rates.

## The finding that changed the product

Every word error above is the same word. The model has never heard "Kodro" and
guesses: `Caudreau`, `Cottro`, `Caudrill`, plus `path finding` for
`pathfinding`. Ten clips out of ten, and not one of them is a spelling anybody
would have written down. Strip the wake word from the references and the
remaining content is transcribed correctly in all ten.

That is not a cosmetic error rate. `voice.js` held a list of plausible
mishearings, and the recogniser produced none of them, so nothing was stripped
and two things broke, both measured before the fix:

- `Hey Caudreau, how do I make the rover go faster?` parsed as a command and set
  the speed to 70. The intent parser anchors its question test at the start of
  the string, so a wake word left in front turns a question into an action on the
  robot.
- `isBargeIn` returned false for every one of the ten transcripts, so saying
  "stop" over a spoken reply did not stop it.

The fix replaces the spelling list with a phonetic skeleton test unioned with the
list, applied to whole leading tokens. `scripts/qa_voice.mjs` now pins the
verbatim transcripts above, so the suite fails if the stripping regresses. The
same file pins the words the rule must not eat, `quiet` first among them since it
is itself an interruption.

## Limits of this benchmark

- Synthetic speech only. No human voice, no accent range, no background noise, no
  child speakers. The WER column is an upper bound and nothing more.
- One machine, one model size. `base.en` was chosen for a 16 GB laptop; smaller
  and larger models were not compared.
- Two synthesised speakers is a range of two, which is barely a range.
- The GPU path is untested rather than slow: it could not run here at all.
- Nothing here measures the browser dictation path the app ships with today,
  which is a different engine entirely and sends audio to Google. This benchmark
  measures the offline alternative.
