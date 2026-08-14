"""Local speech-to-text benchmark for the KODRO voice layer.

Measures what a learner's machine would actually do: how long the model takes
to load, how long it takes to turn a spoken command into text, how much memory
it holds while doing it, and whether the text it produces still means the same
thing to the intent parser.

Everything here runs on device. The model is read from the local Hugging Face
cache with downloads disabled, so a machine without the model cached will fail
loudly rather than quietly reaching for the network.

The speech is synthesised by the Windows speech engine that ships with the
operating system. That is a real waveform through a real acoustic model, not a
recording of a person, and the difference matters: a word error rate measured
against synthesised speech is an upper bound on how clean the audio can get,
not a prediction of how the product behaves in a classroom with background
noise and a child's voice. Every number this script prints is labelled
accordingly and must stay labelled wherever it is quoted.

Usage:
    python scripts/bench_stt.py --synthesize     # write the clips, then measure
    python scripts/bench_stt.py                  # measure existing clips
"""

from __future__ import annotations

import argparse
import json
import platform
import re
import statistics
import subprocess
import sys
import time
import wave
from dataclasses import dataclass, asdict
from pathlib import Path

MODEL = "Systran/faster-whisper-base.en"

# Five commands taken verbatim from scripts/qa_voice.mjs, where each one already
# has a pinned expected parse. Using the suite's own sentences means the audio
# is testing the grammar that ships rather than a sentence invented to be easy.
COMMANDS: list[tuple[str, str, str]] = [
    ("build", "hey kodro build me a rover", "build a robot"),
    ("world", "kodro take me to mars", "change the world"),
    ("lesson", "open the loops lesson", "open a lesson"),
    ("lesson_spoken", "hey kodro open the pathfinding lesson", "open a lesson by name"),
    ("barge_in", "hey kodro, stop", "interrupt whatever is speaking"),
]

# Both voices the operating system installs by default. One speaker is an
# anecdote; two is the beginning of a range.
VOICES = ["Microsoft David Desktop", "Microsoft Zira Desktop"]

REPEATS = 5


@dataclass
class Clip:
    command: str
    voice: str
    reference: str
    path: Path
    seconds: float


def synthesize(outdir: Path) -> None:
    """Write one 16 kHz mono wav per command per voice using the OS speech engine."""
    if platform.system() != "Windows":
        sys.exit("--synthesize uses the Windows speech engine; run it on Windows "
                 "or supply your own clips in " + str(outdir))
    outdir.mkdir(parents=True, exist_ok=True)
    jobs = [
        {"voice": voice, "text": text, "path": str(outdir / f"{key}__{slug(voice)}.wav")}
        for key, text, _ in COMMANDS
        for voice in VOICES
    ]
    script = r"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$jobs = [Console]::In.ReadToEnd() | ConvertFrom-Json
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    16000,
    [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($job in $jobs) {
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $s.SelectVoice($job.voice)
    $s.SetOutputToWaveFile($job.path, $fmt)
    $s.Speak($job.text)
    $s.SetOutputToNull()
    $s.Dispose()
    Write-Output $job.path
}
"""
    done = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
        input=json.dumps(jobs), capture_output=True, text=True,
    )
    if done.returncode != 0:
        sys.exit("speech synthesis failed:\n" + done.stderr)
    print(f"wrote {len(jobs)} clips to {outdir}")


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def load_clips(outdir: Path) -> list[Clip]:
    clips: list[Clip] = []
    for key, text, _ in COMMANDS:
        for voice in VOICES:
            path = outdir / f"{key}__{slug(voice)}.wav"
            if not path.exists():
                sys.exit(f"missing clip {path}; run with --synthesize first")
            with wave.open(str(path)) as handle:
                seconds = handle.getnframes() / handle.getframerate()
            clips.append(Clip(key, voice, text, path, round(seconds, 3)))
    return clips


def normalise(text: str) -> list[str]:
    """Compare meaning, not punctuation. Whisper writes 'Kodro, stop.' where the
    reference says 'kodro stop'; that is the same sentence and the intent parser
    treats it as one, so scoring it as two errors would be measuring the
    transcriber's punctuation policy instead of its accuracy."""
    return re.sub(r"[^a-z0-9 ]+", " ", text.lower()).split()


def word_error_rate(reference: str, hypothesis: str) -> tuple[float, int, int]:
    ref, hyp = normalise(reference), normalise(hypothesis)
    if not ref:
        return (0.0 if not hyp else 1.0), 0, 0
    # Levenshtein over words.
    previous = list(range(len(hyp) + 1))
    for i, ref_word in enumerate(ref, start=1):
        current = [i]
        for j, hyp_word in enumerate(hyp, start=1):
            current.append(min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + (ref_word != hyp_word),
            ))
        previous = current
    return round(previous[-1] / len(ref), 4), previous[-1], len(ref)


def peak_ram_mb() -> float | None:
    try:
        import psutil
    except ImportError:
        return None
    info = psutil.Process().memory_info()
    # peak_wset is the high-water mark on Windows; elsewhere fall back to the
    # current resident size and say so in the report rather than pretending it
    # is a peak.
    peak = getattr(info, "peak_wset", None) or getattr(info, "rss", 0)
    return round(peak / (1024 * 1024), 1)


def try_gpu(clip: Path) -> str:
    """A 6 GB card is the target machine, so whether the GPU path is reachable
    at all is a finding either way. Report the real error, do not swallow it.

    Constructing the model is not the test. CTranslate2 builds a cuda device
    handle happily and only looks for the CUDA libraries when work is actually
    submitted, so a construction-only check reports success on a machine that
    cannot transcribe a single second of audio. Transcribe something."""
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel(MODEL, device="cuda", compute_type="float16", local_files_only=True)
        segments, _info = model.transcribe(str(clip), beam_size=1, language="en")
        list(segments)
        return "available"
    except Exception as error:  # noqa: BLE001 - the message is the result
        return f"unavailable: {type(error).__name__}: {str(error).strip().splitlines()[0][:200]}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--synthesize", action="store_true",
                        help="write the wav clips with the Windows speech engine first")
    parser.add_argument("--audio", default=None, help="directory holding the clips")
    parser.add_argument("--out", default=None, help="where to write the JSON result")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    audio_dir = Path(args.audio) if args.audio else root / "docs" / "eval" / "stt_clips"
    out_path = Path(args.out) if args.out else root / "docs" / "eval" / "stt_bench.json"

    if args.synthesize:
        synthesize(audio_dir)
    clips = load_clips(audio_dir)

    from faster_whisper import WhisperModel

    baseline_ram = peak_ram_mb()
    load_start = time.perf_counter()
    model = WhisperModel(MODEL, device="cpu", compute_type="int8", local_files_only=True)
    load_seconds = round(time.perf_counter() - load_start, 3)

    results = []
    for clip in clips:
        timings = []
        transcript = ""
        for _ in range(REPEATS):
            start = time.perf_counter()
            segments, _info = model.transcribe(str(clip.path), beam_size=1, language="en")
            transcript = " ".join(segment.text for segment in segments).strip()
            timings.append(time.perf_counter() - start)
        median = statistics.median(timings)
        rate, errors, words = word_error_rate(clip.reference, transcript)
        results.append({
            "command": clip.command,
            "voice": clip.voice,
            "reference": clip.reference,
            "transcript": transcript,
            "audio_seconds": clip.seconds,
            "first_call_seconds": round(timings[0], 3),
            "median_seconds": round(median, 3),
            "real_time_factor": round(median / clip.seconds, 3),
            "word_error_rate": rate,
            "word_errors": errors,
            "reference_words": words,
        })

    medians = [row["median_seconds"] for row in results]
    report = {
        "model": MODEL,
        "backend": "faster-whisper / CTranslate2",
        "device": "cpu",
        "compute_type": "int8",
        "beam_size": 1,
        "repeats_per_clip": REPEATS,
        "downloads": "none; local_files_only=True",
        "audio_source": ("Windows System.Speech synthesis, 16 kHz mono. Synthetic "
                         "speech, not human speech: treat every word error rate "
                         "below as indicative of a clean-audio upper bound only."),
        "machine": {
            "platform": platform.platform(),
            "processor": platform.processor(),
            "python": platform.python_version(),
        },
        "model_load_seconds": load_seconds,
        "model_load_note": ("fresh process, operating system file cache already warm; "
                            "a genuinely cold disk would be slower"),
        "baseline_peak_ram_mb": baseline_ram,
        "peak_ram_mb": peak_ram_mb(),
        "gpu_float16": try_gpu(clips[0].path),
        "median_latency_seconds": round(statistics.median(medians), 3),
        "worst_latency_seconds": round(max(medians), 3),
        "median_real_time_factor": round(
            statistics.median([row["real_time_factor"] for row in results]), 3),
        "mean_word_error_rate": round(
            sum(row["word_errors"] for row in results)
            / max(1, sum(row["reference_words"] for row in results)), 4),
        "clips": results,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"model            {MODEL}  ({report['device']}, {report['compute_type']})")
    print(f"load             {load_seconds}s")
    print(f"peak RAM         {report['peak_ram_mb']} MB (baseline {baseline_ram} MB)")
    print(f"gpu float16      {report['gpu_float16']}")
    print(f"median latency   {report['median_latency_seconds']}s")
    print(f"median RTF       {report['median_real_time_factor']}")
    print(f"aggregate WER    {report['mean_word_error_rate']} (synthetic speech)")
    print()
    for row in results:
        flag = "  " if row["word_error_rate"] == 0 else "!!"
        print(f"{flag} {row['command']:<14} {row['voice'].split()[1]:<6} "
              f"{row['audio_seconds']:>5}s  {row['median_seconds']:>6}s  "
              f"rtf {row['real_time_factor']:>5}  wer {row['word_error_rate']:<7} "
              f"{row['transcript']!r}")
    print(f"\nwrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
