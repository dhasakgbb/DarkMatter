#!/usr/bin/env python3
"""Generate layered stereo Photon SFX assets.

These are original, deterministic, license-safe director assets for runtime
playtesting. They replace the earlier mono sweep placeholders with layered
stereo cues, clearer transients, controlled headroom, and stronger cue identity.
"""

from __future__ import annotations

import argparse
import math
import random
import shutil
import struct
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
AUDIO_ROOT = ROOT / "photon" / "src" / "audio-assets"
SR = 48_000
TAU = math.tau
StereoFn = Callable[[float, int], tuple[float, float]]


def clamp(value: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def sine(freq: float, t: float, phase: float = 0.0) -> float:
    return math.sin(TAU * freq * t + phase)


def tri(freq: float, t: float, phase: float = 0.0) -> float:
    return 2.0 * abs(2.0 * (((freq * t) + phase / TAU) % 1.0) - 1.0) - 1.0


def saw(freq: float, t: float, phase: float = 0.0) -> float:
    return 2.0 * (((freq * t) + phase / TAU) % 1.0) - 1.0


def chirp(f0: float, f1: float, t: float, dur: float, phase: float = 0.0) -> float:
    p = clamp(t / max(dur, 0.001), 0.0, 1.0)
    return math.sin(TAU * (f0 * t + 0.5 * (f1 - f0) * p * t) + phase)


def env(t: float, dur: float, attack: float = 0.01, release: float = 0.12, curve: float = 1.0) -> float:
    if t < attack:
        return (t / max(attack, 0.001)) ** 0.7
    if t > dur - release:
        return max(0.0, (dur - t) / max(release, 0.001)) ** curve
    return 1.0


def exp_tail(t: float, decay: float) -> float:
    return math.exp(-max(0.0, t) * decay)


def pan(mono: float, x: float) -> tuple[float, float]:
    x = clamp(x, -1.0, 1.0)
    angle = (x + 1.0) * math.pi / 4.0
    return mono * math.cos(angle), mono * math.sin(angle)


def add(a: tuple[float, float], b: tuple[float, float]) -> tuple[float, float]:
    return a[0] + b[0], a[1] + b[1]


def soft_clip(x: float) -> float:
    return math.tanh(1.25 * x) / math.tanh(1.25)


def filtered_noise(seed: int, alpha: float = 0.16) -> Callable[[], float]:
    rng = random.Random(seed)
    state = 0.0

    def sample() -> float:
        nonlocal state
        state += alpha * (rng.uniform(-1.0, 1.0) - state)
        return state

    return sample


def render(rel: str, dur: float, fn: StereoFn, target_peak: float = 0.82) -> tuple[Path, Path]:
    frames: list[tuple[float, float]] = []
    peak = 0.0
    count = int(SR * dur)
    for i in range(count):
        left, right = fn(i / SR, i)
        left = soft_clip(left) if math.isfinite(left) else 0.0
        right = soft_clip(right) if math.isfinite(right) else 0.0
        peak = max(peak, abs(left), abs(right))
        frames.append((left, right))
    scale = target_peak / peak if peak > target_peak and peak > 0 else 1.0

    wav_path = Path(rel.replace(".ogg", ".wav"))
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        out = bytearray()
        for left, right in frames:
            out += struct.pack("<hh", int(clamp(left * scale) * 32767), int(clamp(right * scale) * 32767))
            if len(out) >= 65_536:
                wf.writeframes(out)
                out.clear()
        if out:
            wf.writeframes(out)
    return wav_path, AUDIO_ROOT / rel


def convert_to_ogg(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src),
        "-c:a", "vorbis", "-strict", "-2", "-q:a", "6", str(dst),
    ], check=True)


def pickup_asset(n: int) -> tuple[str, float, StereoFn, float]:
    dur = 0.46
    base = 700 + 55 * n
    phases = [0.31 * n, 0.8 + 0.17 * n, 1.6]

    def fn(t: float, i: int) -> tuple[float, float]:
        body = env(t, dur, 0.006, 0.34, 1.7)
        sparkle = exp_tail(t, 10.0)
        tone_l = (
            0.21 * sine(base, t, phases[0])
            + 0.12 * sine(base * 1.505, t, phases[1])
            + 0.07 * sine(base * 2.01, t, phases[2])
        ) * body
        tone_r = (
            0.20 * sine(base * 1.006, t, phases[0] + 0.18)
            + 0.12 * sine(base * 1.515, t, phases[1] + 0.1)
            + 0.07 * sine(base * 2.035, t, phases[2] + 0.2)
        ) * body
        lift = 0.08 * chirp(base * 1.1, base * 2.8, t, dur) * sparkle
        l2, r2 = pan(lift, -0.16 + 0.08 * n)
        return tone_l + l2, tone_r + r2

    return f"sfx/pickup/pickup-{n:02d}.ogg", dur, fn, 0.66


def speed_pad_asset(n: int) -> tuple[str, float, StereoFn, float]:
    dur = 0.74
    noise_l = filtered_noise(1200 + n, 0.22)
    noise_r = filtered_noise(2200 + n, 0.18)

    def fn(t: float, i: int) -> tuple[float, float]:
        p = t / dur
        shove = exp_tail(t, 8.5)
        sub = 0.28 * sine(54 + n * 3, t) * exp_tail(t, 5.2)
        rise = 0.22 * chirp(165 + n * 18, 2200 + n * 90, t, dur) * env(t, dur, 0.012, 0.22, 1.4)
        bright = 0.08 * saw(360 + n * 30 + 680 * p, t) * env(t, dur, 0.01, 0.32, 1.2)
        air_l = 0.055 * noise_l() * (0.7 * shove + 0.3 * env(t, dur, 0.03, 0.18, 2.0))
        air_r = 0.055 * noise_r() * (0.7 * shove + 0.3 * env(t, dur, 0.03, 0.18, 2.0))
        sweep_l, sweep_r = pan(rise + bright, -0.45 + 0.9 * p)
        return sub + sweep_l + air_l, sub + sweep_r + air_r

    return f"sfx/speed-pad/speed-pad-{n:02d}.ogg", dur, fn, 0.84


def line_gate_asset(n: int) -> tuple[str, float, StereoFn, float]:
    dur = 0.34
    base = 470 + 48 * n
    accent = 1.0 + min(n, 6) * 0.045

    def fn(t: float, i: int) -> tuple[float, float]:
        hit = exp_tail(t, 55.0)
        tail = env(t, dur, 0.004, 0.24, 1.8)
        dyad_l = 0.18 * sine(base, t) + 0.12 * sine(base * 1.498, t, 0.18) + 0.06 * sine(base * 2.01, t, 1.1)
        dyad_r = 0.18 * sine(base * 1.004, t, 0.1) + 0.12 * sine(base * 1.515, t, 0.42) + 0.06 * sine(base * 2.04, t, 1.32)
        transient = 0.10 * chirp(base * 2.1, base * 3.3, t, 0.09) * hit
        l2, r2 = pan(transient, 0.22)
        return accent * dyad_l * tail + l2, accent * dyad_r * tail + r2

    return f"sfx/line-gate/line-gate-{n:02d}.ogg", dur, fn, 0.64


def gate_miss_asset(n: int) -> tuple[str, float, StereoFn, float]:
    dur = 0.34
    noise = filtered_noise(3300 + n, 0.28)

    def fn(t: float, i: int) -> tuple[float, float]:
        fall = 0.22 * chirp(520 - n * 35, 145 - n * 8, t, dur) * env(t, dur, 0.004, 0.20, 1.5)
        thunk = 0.16 * sine(92 - n * 4, t) * exp_tail(t, 9.0)
        grit = 0.045 * noise() * exp_tail(t, 16.0)
        left, right = pan(fall + grit, -0.12)
        return left + thunk, right + thunk

    return f"sfx/gate-miss/gate-miss-{n:02d}.ogg", dur, fn, 0.55


def rail_scrape_asset(n: int) -> tuple[str, float, StereoFn, float]:
    dur = 0.48
    noise_l = filtered_noise(4100 + n, 0.42)
    noise_r = filtered_noise(5100 + n, 0.39)
    squeal = 1480 + 95 * n

    def fn(t: float, i: int) -> tuple[float, float]:
        scrape_env = env(t, dur, 0.003, 0.31, 1.2)
        chatter = 0.5 + 0.5 * sine(34 + n, t)
        metal_l = 0.18 * noise_l() * scrape_env * chatter
        metal_r = 0.17 * noise_r() * scrape_env * (0.55 + 0.45 * sine(29 + n, t, 0.8))
        ring_l = 0.09 * sine(squeal + 180 * sine(19, t), t) * scrape_env
        ring_r = 0.08 * sine(squeal * 1.035 + 160 * sine(17, t, 0.7), t) * scrape_env
        return metal_l + ring_l, metal_r + ring_r

    return f"sfx/rail-scrape/rail-scrape-{n:02d}.ogg", dur, fn, 0.62


def wavelength_asset(name: str, rate: float) -> tuple[str, float, StereoFn, float]:
    dur = 0.32
    base = {"gamma": 1420, "visible": 880, "radio": 360}[name] * rate
    dest = {"gamma": 2600, "visible": 620, "radio": 190}[name] * rate

    def fn(t: float, i: int) -> tuple[float, float]:
        body = env(t, dur, 0.006, 0.19, 1.5)
        prism = 0.20 * chirp(base, dest, t, dur) * body
        lock = 0.09 * sine(math.sqrt(base * dest), t, 0.2) * exp_tail(t, 7.0)
        shimmer = 0.045 * sine(base * 2.02, t, 1.2) * exp_tail(t, 12.0)
        l, r = pan(prism + shimmer, {"gamma": -0.25, "visible": 0.0, "radio": 0.25}[name])
        return l + lock, r + lock * 0.96

    return f"sfx/wavelength-shift/{name}.ogg", dur, fn, 0.60


def ui_assets() -> list[tuple[str, float, StereoFn, float]]:
    def tick(t: float, i: int) -> tuple[float, float]:
        v = 0.10 * sine(1720, t) * env(t, 0.07, 0.001, 0.055, 1.7)
        return pan(v, -0.08)

    def click(t: float, i: int) -> tuple[float, float]:
        v = (0.12 * sine(740, t) + 0.05 * sine(1180, t)) * env(t, 0.13, 0.001, 0.10, 1.4)
        return pan(v, 0.08)

    noise_l = filtered_noise(7001, 0.2)
    noise_r = filtered_noise(7002, 0.2)

    def swoosh(t: float, i: int) -> tuple[float, float]:
        p = t / 0.44
        v = 0.12 * chirp(280, 1900, t, 0.44) * env(t, 0.44, 0.02, 0.16, 1.3)
        air_l = 0.035 * noise_l() * env(t, 0.44, 0.02, 0.20, 1.6)
        air_r = 0.035 * noise_r() * env(t, 0.44, 0.02, 0.20, 1.6)
        l, r = pan(v, -0.35 + 0.7 * p)
        return l + air_l, r + air_r

    return [
        ("sfx/ui/ui-tick.ogg", 0.07, tick, 0.32),
        ("sfx/ui/ui-click.ogg", 0.13, click, 0.43),
        ("sfx/ui/ui-swoosh.ogg", 0.44, swoosh, 0.50),
    ]


def memory_unlock_asset() -> tuple[str, float, StereoFn, float]:
    dur = 1.55
    freqs = [392.0, 523.25, 659.25, 987.77]

    def fn(t: float, i: int) -> tuple[float, float]:
        bloom = env(t, dur, 0.08, 1.05, 1.8)
        left = sum(0.055 * sine(f, t, 0.2 * idx) for idx, f in enumerate(freqs)) * bloom
        right = sum(0.055 * sine(f * 1.004, t, 0.25 + 0.22 * idx) for idx, f in enumerate(freqs)) * bloom
        glint = 0.06 * chirp(950, 2200, t, 0.52) * exp_tail(t, 3.2)
        l2, r2 = pan(glint, 0.18)
        return left + l2, right + r2

    return "sfx/memory-unlock/memory-unlock-01.ogg", dur, fn, 0.60


def racing_assets() -> list[tuple[str, float, StereoFn, float]]:
    assets: list[tuple[str, float, StereoFn, float]] = []
    assets += [pickup_asset(n) for n in range(1, 5)]
    assets += [speed_pad_asset(n) for n in range(1, 5)]
    assets += [line_gate_asset(n) for n in range(1, 7)]
    assets += [gate_miss_asset(n) for n in range(1, 4)]
    assets += [rail_scrape_asset(n) for n in range(1, 6)]
    assets += [wavelength_asset("gamma", 1.0), wavelength_asset("visible", 1.0), wavelength_asset("radio", 1.0)]
    assets += ui_assets()
    assets.append(memory_unlock_asset())
    return assets


def hazard_whoosh_asset(n: int) -> tuple[str, float, StereoFn, float]:
    dur = 0.62
    noise_l = filtered_noise(8000 + n, 0.24)
    noise_r = filtered_noise(9000 + n, 0.24)
    side = -1.0 if n % 2 else 1.0

    def fn(t: float, i: int) -> tuple[float, float]:
        p = t / dur
        whoosh_env = math.sin(math.pi * p) ** 0.6
        tone = 0.16 * chirp(1120 + n * 45, 220 + n * 14, t, dur) * whoosh_env
        air = 0.16 * whoosh_env
        pan_x = side * (0.85 - 1.7 * p)
        l, r = pan(tone, pan_x)
        return l + air * noise_l(), r + air * noise_r()

    return f"sfx/hazard-whoosh/hazard-whoosh-{n:02d}.ogg", dur, fn, 0.70


def gravity_whoosh_asset(n: int) -> tuple[str, float, StereoFn, float]:
    dur = 0.98
    noise_l = filtered_noise(10000 + n, 0.13)
    noise_r = filtered_noise(11000 + n, 0.13)

    def fn(t: float, i: int) -> tuple[float, float]:
        p = t / dur
        pressure = math.sin(math.pi * p) ** 0.72
        sub = 0.25 * chirp(245 + n * 12, 48 + n * 3, t, dur) * pressure
        bend = 0.11 * saw(96 + 20 * sine(2.2, t), t) * pressure
        air_l = 0.07 * noise_l() * pressure
        air_r = 0.07 * noise_r() * pressure
        pan_x = 0.55 * sine(0.7, t, n)
        l, r = pan(sub + bend, pan_x)
        return l + air_l, r + air_r

    return f"sfx/gravity-well-whoosh/gravity-well-whoosh-{n:02d}.ogg", dur, fn, 0.78


def damage_hit_asset(n: int) -> tuple[str, float, StereoFn, float]:
    dur = 0.72
    crack_l = filtered_noise(12000 + n, 0.45)
    crack_r = filtered_noise(13000 + n, 0.41)

    def fn(t: float, i: int) -> tuple[float, float]:
        impact = exp_tail(t, 13.0)
        tail = env(t, dur, 0.001, 0.50, 1.9)
        sub = 0.32 * sine(76 - n * 2, t) * impact
        glass_l = 0.17 * crack_l() * exp_tail(t, 18.0)
        glass_r = 0.17 * crack_r() * exp_tail(t, 16.0)
        absorb = 0.12 * chirp(420 + n * 40, 90 + n * 5, t, dur) * tail
        l, r = pan(absorb, -0.18 + n * 0.07)
        return sub + glass_l + l, sub + glass_r + r

    return f"sfx/damage-hit/damage-hit-{n:02d}.ogg", dur, fn, 0.84


def death_asset(n: int) -> tuple[str, float, StereoFn, float]:
    dur = 2.35
    dust_l = filtered_noise(14000 + n, 0.08)
    dust_r = filtered_noise(15000 + n, 0.08)

    def fn(t: float, i: int) -> tuple[float, float]:
        p = t / dur
        sink = env(t, dur, 0.03, 1.55, 2.0)
        low = 0.32 * chirp(118 - n * 8, 26 + n * 2, t, dur) * sink
        fold = 0.13 * sine(220 * (1.0 - 0.58 * p), t, 0.4) * sink
        dust = 0.09 * (1.0 - p) * (dust_l() + dust_r()) * 0.5
        last = 0.05 * sine(622.25 / (1 + n * 0.04), t) * exp_tail(max(0.0, t - 0.35), 1.8) * env(t, dur, 0.3, 1.4, 2.0)
        l, r = pan(low + fold + dust, 0.25 * sine(0.28, t))
        return l + last, r + last * 1.006

    return f"sfx/death/death-absorbed-{n:02d}.ogg", dur, fn, 0.82


def witness_asset() -> tuple[str, float, StereoFn, float]:
    dur = 4.8
    freqs = [261.63, 392.0, 523.25, 783.99, 1046.5]

    def fn(t: float, i: int) -> tuple[float, float]:
        bloom = env(t, dur, 0.65, 2.7, 1.9)
        shimmer = 0.5 + 0.5 * sine(0.17, t)
        left = sum(0.05 * sine(f, t, idx * 0.31) for idx, f in enumerate(freqs)) * bloom
        right = sum(0.05 * sine(f * 1.003, t, 0.2 + idx * 0.33) for idx, f in enumerate(freqs)) * bloom
        overtone = 0.035 * sine(1567.98 + 11 * sine(0.11, t), t) * bloom * shimmer
        return left + overtone, right + overtone * 0.92

    return "sfx/witness/witness-chime-01.ogg", dur, fn, 0.66


def epoch_riser_asset(n: int) -> tuple[str, float, StereoFn, float]:
    dur = 1.48
    noise_l = filtered_noise(16000 + n, 0.18)
    noise_r = filtered_noise(17000 + n, 0.18)

    def fn(t: float, i: int) -> tuple[float, float]:
        p = t / dur
        rise_env = env(t, dur, 0.05, 0.16, 1.0)
        rise = 0.18 * chirp(126 + n * 14, 980 + n * 90, t, dur) * rise_env
        pressure = 0.11 * saw(64 + 90 * p, t) * rise_env
        snap = 0.08 * chirp(880, 2400, max(0.0, t - 1.18), 0.24) * exp_tail(max(0.0, t - 1.18), 7.0) if t > 1.18 else 0.0
        l, r = pan(rise + pressure + snap, -0.35 + 0.7 * p)
        return l + 0.055 * noise_l() * rise_env, r + 0.055 * noise_r() * rise_env

    return f"sfx/epoch-riser/epoch-riser-{n:02d}.ogg", dur, fn, 0.74


def engine_loop_asset() -> tuple[str, float, StereoFn, float]:
    dur = 8.0

    def fn(t: float, i: int) -> tuple[float, float]:
        pulse = 0.5 + 0.5 * sine(2.0, t)
        sub = 0.18 * sine(55, t) + 0.09 * sine(110, t)
        motion_l = 0.055 * tri(220, t) * pulse + 0.035 * sine(880 + 70 * sine(0.5, t), t)
        motion_r = 0.055 * tri(220 * 1.003, t, 0.15) * pulse + 0.035 * sine(884 + 70 * sine(0.5, t, 0.4), t)
        growl = 0.055 * saw(27.5, t) * (0.42 + 0.58 * sine(0.25, t) ** 2)
        return sub + growl + motion_l, sub + growl + motion_r

    return "sfx/engine/engine-loop.ogg", dur, fn, 0.72


def world_assets() -> list[tuple[str, float, StereoFn, float]]:
    assets: list[tuple[str, float, StereoFn, float]] = []
    assets += [damage_hit_asset(n) for n in range(1, 6)]
    assets += [death_asset(n) for n in range(1, 3)]
    assets += [hazard_whoosh_asset(n) for n in range(1, 7)]
    assets += [gravity_whoosh_asset(n) for n in range(1, 5)]
    assets += [epoch_riser_asset(n) for n in range(1, 3)]
    assets.append(witness_asset())
    assets.append(engine_loop_asset())
    return assets


def selected_assets(group: str) -> list[tuple[str, float, StereoFn, float]]:
    if group == "racing":
        return racing_assets()
    if group == "world":
        return world_assets()
    return racing_assets() + world_assets()


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate layered stereo Photon SFX assets")
    parser.add_argument("--group", choices=["racing", "world", "all"], default="all")
    args = parser.parse_args()
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is required to generate OGG runtime audio")

    assets = selected_assets(args.group)
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        old_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp)
            rendered = [render(rel, dur, fn, peak) for rel, dur, fn, peak in assets]
            for src, dst in rendered:
                convert_to_ogg(src, dst)
        finally:
            import os
            os.chdir(old_cwd)
    print(f"Generated {len(assets)} layered stereo SFX assets in {AUDIO_ROOT}")


if __name__ == "__main__":
    main()
