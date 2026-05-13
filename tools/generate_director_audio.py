#!/usr/bin/env python3
"""Generate original temporary Photon audio assets.

These sounds are not final studio assets. They are deterministic, local, and
license-safe placeholders used to validate timing, mix headroom, and manifest
wiring before commissioned audio arrives.
"""

from __future__ import annotations

import math
import os
import random
import shutil
import struct
import subprocess
import tempfile
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIO_ROOT = ROOT / "photon" / "src" / "audio-assets"
SR = 48_000


def clamp(v: float) -> float:
    return max(-1.0, min(1.0, v))


def env_exp(t: float, dur: float, attack: float = 0.01, release: float = 0.08) -> float:
    if t < attack:
        return t / max(attack, 0.001)
    if t > dur - release:
        return max(0.0, (dur - t) / max(release, 0.001))
    return 1.0


def sine(freq: float, t: float) -> float:
    return math.sin(2 * math.pi * freq * t)


def saw(freq: float, t: float) -> float:
    return 2.0 * ((freq * t) % 1.0) - 1.0


def tri(freq: float, t: float) -> float:
    return 2.0 * abs(2.0 * ((freq * t) % 1.0) - 1.0) - 1.0


def noise(seed: int) -> random.Random:
    return random.Random(seed)


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        frames = bytearray()
        for sample in samples:
            v = int(clamp(sample) * 32767)
            frames += struct.pack("<hh", v, v)
        wf.writeframes(frames)


def render(path: str, dur: float, fn) -> None:
    count = int(SR * dur)
    path_obj = Path(path)
    path_obj.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path_obj), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        frames = bytearray()
        for i in range(count):
            sample = int(clamp(fn(i / SR, i)) * 32767)
            frames += struct.pack("<hh", sample, sample)
            if len(frames) >= 65_536:
                wf.writeframes(frames)
                frames.clear()
        if frames:
            wf.writeframes(frames)


def convert_to_ogg(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(src),
            "-c:a",
            "vorbis",
            "-strict",
            "-2",
            "-q:a",
            "5",
            str(dst),
        ],
        check=True,
    )


def make_music(tmp: Path) -> list[tuple[Path, Path]]:
    out: list[tuple[Path, Path]] = []
    dur = 16.0

    def add(epoch: str, name: str, fn, seconds: float = dur) -> None:
        wav = tmp / "music" / epoch / f"{name}.wav"
        render(str(wav), seconds, fn)
        out.append((wav, AUDIO_ROOT / "music" / epoch / f"{name}.ogg"))

    def pulse_fn(freq: float, bpm: float, amp: float, color: float = 1.0):
        beat = 60 / bpm
        def fn(t: float, i: int) -> float:
            gate = max(0, 1 - ((t % beat) / beat) * 1.8)
            half = max(0, 1 - ((t % (beat / 2)) / (beat / 2)) * 2.4)
            return amp * (sine(freq, t) * gate + 0.35 * tri(freq * 2 * color, t) * half)
        return fn

    def texture_fn(base: float, amp: float, slow: float, seed: int):
        rng = noise(seed)
        drift = rng.random() * 0.7 + 0.3
        def fn(t: float, i: int) -> float:
            return amp * (
                0.55 * sine(base + 18 * sine(slow, t), t)
                + 0.30 * sine(base * 1.5 + 12 * sine(slow * 0.6, t + drift), t)
                + 0.15 * saw(base * 0.5, t) * (0.5 + 0.5 * sine(slow * 0.33, t))
            )
        return fn

    def arp_fn(notes: list[float], bpm: float, amp: float):
        step = 60 / bpm / 2
        def fn(t: float, i: int) -> float:
            idx = int(t / step) % len(notes)
            p = (t % step) / step
            env = max(0, 1 - p * 1.4)
            return amp * (sine(notes[idx], t) + 0.35 * sine(notes[idx] * 2, t)) * env
        return fn

    add("inflationary", "pulse", pulse_fn(180, 176, 0.12, 1.4))
    add("inflationary", "texture", texture_fn(72, 0.085, 0.21, 11))

    add("quark-plasma", "pulse", pulse_fn(132, 164, 0.11, 1.2))
    add("quark-plasma", "texture", texture_fn(96, 0.10, 0.38, 12))

    add("recombination", "motion", arp_fn([261.63, 329.63, 392.0, 523.25, 659.25], 118, 0.055))
    add("recombination", "texture", texture_fn(110, 0.060, 0.17, 13))

    add("first-stars", "pulse", pulse_fn(150, 142, 0.105, 1.15))
    add("first-stars", "reward", arp_fn([233.08, 349.23, 466.16, 622.25], 142, 0.060))

    add("galactic", "pulse", pulse_fn(138, 150, 0.095, 1.05))
    add("galactic", "motion", arp_fn([220.0, 261.63, 311.13, 392.0, 466.16], 150, 0.058))

    add(
        "stellar",
        "pulse",
        lambda t, i: (
            (lambda beat: (
            0.10 * sine(150, t) * max(0, 1 - ((t % beat) / beat) * 1.7)
            + 0.035 * tri(300, t) * max(0, 1 - ((t % (beat / 2)) / (beat / 2)) * 2.2)
            ))(60 / 150)
        )
    )
    add(
        "stellar",
        "bass",
        lambda t, i: (
            0.12 * sine(55, t)
            + 0.045 * sine(110, t)
            + 0.04 * saw(27.5, t) * (0.45 + 0.55 * sine(0.25, t))
        ),
    )
    add(
        "stellar",
        "motion",
        lambda t, i: (
            (lambda beat: (
            0.04
            * sum(sine(freq, t) for freq in [330, 440, 550, 660][int((t / (beat / 2)) % 4) : int((t / (beat / 2)) % 4) + 1])
            * (0.3 + 0.7 * max(0, 1 - ((t % (beat / 2)) / (beat / 2))))
            + 0.015 * sine(1320 + 120 * sine(0.5, t), t)
            ))(60 / 150)
        )
    )
    add(
        "stellar",
        "danger",
        lambda t, i: (
            0.035 * sine(185 + 12 * sine(0.33, t), t)
            + 0.025 * saw(92.5, t) * (0.5 + 0.5 * sine(0.125, t))
        ),
    )

    add("degenerate", "bass", texture_fn(48, 0.10, 0.09, 14))
    add("degenerate", "texture", texture_fn(86, 0.050, 0.11, 15))

    add("black-hole", "bass", texture_fn(36, 0.11, 0.045, 16))
    add("black-hole", "texture", texture_fn(54, 0.055, 0.055, 17))

    add(
        "heat-death",
        "low-tone",
        lambda t, i: (
            0.078
            * sine(40 * (1 + 0.012 * sine(0.009, t)), t)
            * (1 - 0.42 * min(1, t / 240))
            * (1 if t < 240 else max(0, 1 - (t - 240) / 120))
        ),
        360.0,
    )
    add(
        "heat-death",
        "vanishing-texture",
        lambda t, i: (
            0.028
            * sine(118 + 6 * sine(0.021, t), t)
            * (0.25 + 0.75 * max(0, sine(0.031, t)))
            * max(0, 1 - t / 210)
        ),
        360.0,
    )
    return out


def sweep(freq0: float, freq1: float, dur: float, amp: float, wave=sine):
    ratio = freq1 / freq0
    def fn(t: float, i: int) -> float:
        p = t / dur
        freq = freq0 * (ratio ** p)
        return amp * wave(freq, t) * env_exp(t, dur, 0.012, dur * 0.35)
    return fn


def make_sfx(tmp: Path) -> list[tuple[Path, Path]]:
    out: list[tuple[Path, Path]] = []

    def add(rel: str, dur: float, fn) -> None:
        wav = tmp / rel.replace(".ogg", ".wav")
        render(str(wav), dur, fn)
        out.append((wav, AUDIO_ROOT / rel))

    for n in range(1, 5):
        add(f"sfx/pickup/pickup-{n:02d}.ogg", 0.32, sweep(660 + n * 45, 1600 + n * 120, 0.32, 0.18, sine))

    for n in range(1, 5):
        add(f"sfx/speed-pad/speed-pad-{n:02d}.ogg", 0.58, sweep(180 + n * 18, 1380 + n * 80, 0.58, 0.19, saw))

    for n in range(1, 7):
        base = 420 + n * 45
        add(
            f"sfx/line-gate/line-gate-{n:02d}.ogg",
            0.28,
            lambda t, i, base=base: 0.10 * (sine(base, t) + sine(base * 1.5, t)) * env_exp(t, 0.28, 0.01, 0.18),
        )

    for n in range(1, 4):
        add(f"sfx/gate-miss/gate-miss-{n:02d}.ogg", 0.26, sweep(440 - n * 35, 130 - n * 8, 0.26, 0.12, saw))

    for n in range(1, 6):
        rng = noise(100 + n)
        add(
            f"sfx/rail-scrape/rail-scrape-{n:02d}.ogg",
            0.32,
            lambda t, i, rng=rng: 0.16 * (rng.random() * 2 - 1) * sine(1300 + 200 * sine(30, t), t) * env_exp(t, 0.32, 0.004, 0.22),
        )

    for name, rate in [("gamma", 1.18), ("visible", 1.0), ("radio", 0.82)]:
        add(f"sfx/wavelength-shift/{name}.ogg", 0.24, sweep(900 * rate, 420 * rate, 0.24, 0.12, tri))

    for n in range(1, 6):
        rng = noise(200 + n)
        add(
            f"sfx/damage-hit/damage-hit-{n:02d}.ogg",
            0.52,
            lambda t, i, rng=rng: (0.17 * (rng.random() * 2 - 1) + 0.15 * sine(95, t)) * env_exp(t, 0.52, 0.003, 0.35),
        )

    for n in range(1, 3):
        rng = noise(300 + n)
        add(
            f"sfx/death/death-absorbed-{n:02d}.ogg",
            1.8,
            lambda t, i, rng=rng: (0.12 * sine(95 * (1 - 0.65 * t / 1.8), t) + 0.06 * (rng.random() * 2 - 1)) * env_exp(t, 1.8, 0.02, 1.2),
        )

    add(
        "sfx/witness/witness-chime-01.ogg",
        4.8,
        lambda t, i: 0.08
        * sum(sine(f, t) for f in [261.63, 392.0, 523.25, 783.99])
        * env_exp(t, 4.8, 0.7, 2.8),
    )

    for n in range(1, 7):
        add(f"sfx/hazard-whoosh/hazard-whoosh-{n:02d}.ogg", 0.46, sweep(900 + n * 40, 210 + n * 15, 0.46, 0.13, sine))

    for n in range(1, 5):
        add(f"sfx/gravity-well-whoosh/gravity-well-whoosh-{n:02d}.ogg", 0.7, sweep(260 + n * 10, 54 + n * 5, 0.7, 0.16, saw))

    add(
        "sfx/engine/engine-loop.ogg",
        8.0,
        lambda t, i: (
            0.105 * sine(55, t)
            + 0.060 * sine(110, t)
            + 0.045 * saw(27.5, t)
            + 0.030 * tri(220, t) * (0.48 + 0.52 * sine(2.0, t))
            + 0.018 * sine(880 + 80 * sine(0.5, t), t) * (0.35 + 0.65 * max(0, sine(4.0, t)))
        ),
    )

    add("sfx/ui/ui-tick.ogg", 0.06, sweep(1400, 1600, 0.06, 0.045, sine))
    add("sfx/ui/ui-click.ogg", 0.12, sweep(860, 360, 0.12, 0.08, tri))
    add("sfx/ui/ui-swoosh.ogg", 0.42, sweep(320, 1800, 0.42, 0.08, sine))

    for n in range(1, 3):
        add(f"sfx/epoch-riser/epoch-riser-{n:02d}.ogg", 1.35, sweep(120 + n * 12, 520 + n * 40, 1.35, 0.11, saw))

    add("sfx/memory-unlock/memory-unlock-01.ogg", 1.2, sweep(330, 990, 1.2, 0.10, sine))

    return out


def main() -> None:
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is required to generate OGG runtime audio")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        assets = make_music(tmp) + make_sfx(tmp)
        for src, dst in assets:
            convert_to_ogg(src, dst)

    print(f"Generated {len(assets)} original temporary audio assets in {AUDIO_ROOT}")


if __name__ == "__main__":
    main()
