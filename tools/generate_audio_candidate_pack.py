#!/usr/bin/env python3
"""Generate an original Photon audio candidate pack.

Outputs stay in photon/output/audio-candidate-forge so they can be reviewed,
scored, and licensed deliberately before anything touches runtime assets.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import shutil
import struct
import subprocess
import tempfile
import wave
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable


ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "photon" / "output" / "audio-candidate-forge"
MATRIX_PATH = ROOT / "docs" / "evidence" / "audio-candidate-forge" / "prompt-matrix.json"
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


def chirp(freq0: float, freq1: float, t: float, dur: float, phase: float = 0.0) -> float:
    p = clamp(t / max(dur, 0.001), 0.0, 1.0)
    return math.sin(TAU * (freq0 * t + 0.5 * (freq1 - freq0) * p * t) + phase)


def env(t: float, dur: float, attack: float = 0.01, release: float = 0.2, curve: float = 1.4) -> float:
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


def soft_clip(value: float) -> float:
    return math.tanh(1.18 * value) / math.tanh(1.18)


def filtered_noise(seed: int, alpha: float) -> Callable[[], float]:
    rng = random.Random(seed)
    state = 0.0

    def sample() -> float:
        nonlocal state
        state += alpha * (rng.uniform(-1.0, 1.0) - state)
        return state

    return sample


def read_prompt_matrix() -> dict[str, dict]:
    if not MATRIX_PATH.exists():
        return {}
    data = json.loads(MATRIX_PATH.read_text())
    return {entry["id"]: entry for entry in data.get("matrix", [])}


def render_wav(path: Path, dur: float, fn: StereoFn, target_peak: float = 0.82) -> None:
    frames: list[tuple[float, float]] = []
    peak = 0.0
    for i in range(int(SR * dur)):
        left, right = fn(i / SR, i)
        left = soft_clip(left) if math.isfinite(left) else 0.0
        right = soft_clip(right) if math.isfinite(right) else 0.0
        peak = max(peak, abs(left), abs(right))
        frames.append((left, right))

    scale = target_peak / peak if peak > target_peak and peak > 0 else 1.0
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
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
            "7",
            str(dst),
        ],
        check=True,
    )


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def music_stem(matrix_id: str, rel: str, dur: float, target_peak: float, fn: StereoFn) -> dict:
    return {
        "matrix_id": matrix_id,
        "rel": rel,
        "dur": dur,
        "target_peak": target_peak,
        "fn": fn,
    }


def sfx(matrix_id: str, rel: str, dur: float, target_peak: float, fn: StereoFn) -> dict:
    return music_stem(matrix_id, rel, dur, target_peak, fn)


def stellar_pulse() -> StereoFn:
    air_l = filtered_noise(2101, 0.08)
    air_r = filtered_noise(2102, 0.08)

    def fn(t: float, i: int) -> tuple[float, float]:
        beat = 60 / 156
        phase = (t % beat) / beat
        half = (t % (beat / 2)) / (beat / 2)
        gate = max(0.0, 1.0 - phase * 1.85)
        tick = max(0.0, 1.0 - half * 3.0)
        pulse = 0.19 * sine(73.5, t) * gate + 0.065 * tri(294, t) * tick
        top = 0.025 * sine(1176 + 32 * sine(0.5, t), t) * tick
        width = 0.016 * sine(880, t, 0.4) * gate
        return pulse + top + width + 0.012 * air_l(), pulse + top - width + 0.012 * air_r()

    return fn


def stellar_bass() -> StereoFn:
    def fn(t: float, i: int) -> tuple[float, float]:
        bar = 60 / 156 * 4
        side = 0.5 + 0.5 * sine(1 / bar, t)
        sub = 0.20 * sine(49, t) + 0.09 * sine(98, t)
        drive = 0.045 * saw(24.5, t) * side
        return sub + drive, sub + drive * 0.98

    return fn


def stellar_motion() -> StereoFn:
    notes = [392.0, 466.16, 587.33, 698.46, 783.99, 932.33]

    def fn(t: float, i: int) -> tuple[float, float]:
        step = 60 / 156 / 2
        idx = int(t / step) % len(notes)
        p = (t % step) / step
        pluck = max(0.0, 1.0 - p * 1.65)
        freq = notes[idx]
        mono = (0.062 * sine(freq, t) + 0.028 * sine(freq * 2.01, t)) * pluck
        shimmer = 0.018 * sine(1760 + 180 * sine(0.23, t), t) * (0.5 + 0.5 * sine(0.7, t))
        return pan(mono + shimmer, -0.55 + 1.1 * ((idx % 6) / 5))

    return fn


def stellar_danger() -> StereoFn:
    dust = filtered_noise(2201, 0.05)

    def fn(t: float, i: int) -> tuple[float, float]:
        slow = 0.5 + 0.5 * sine(0.08, t)
        strain = 0.06 * sine(185 + 9 * sine(0.37, t), t) + 0.035 * saw(92.5, t)
        thin = 0.028 * sine(740 + 70 * sine(0.13, t), t)
        left, right = pan((strain + thin) * (0.45 + 0.55 * slow), 0.22 * sine(0.05, t))
        return left + 0.012 * dust(), right - 0.01 * dust()

    return fn


def heat_low() -> StereoFn:
    def fn(t: float, i: int) -> tuple[float, float]:
        fade = max(0.0, 1.0 - t / 80)
        tone = 0.11 * sine(39.5 * (1 + 0.009 * sine(0.013, t)), t) * fade
        return tone, tone * 0.985

    return fn


def heat_texture() -> StereoFn:
    dust_l = filtered_noise(2301, 0.025)
    dust_r = filtered_noise(2302, 0.025)

    def fn(t: float, i: int) -> tuple[float, float]:
        fade = max(0.0, 1.0 - t / 65)
        breath = 0.034 * sine(118 + 4 * sine(0.03, t), t) * fade * (0.35 + 0.65 * sine(0.019, t) ** 2)
        return breath + 0.018 * dust_l() * fade, breath * 0.93 + 0.018 * dust_r() * fade

    return fn


def speed_pad(n: int) -> StereoFn:
    air_l = filtered_noise(3000 + n, 0.20)
    air_r = filtered_noise(3100 + n, 0.18)

    def fn(t: float, i: int) -> tuple[float, float]:
        dur = 0.72
        p = t / dur
        shove = exp_tail(t, 7.0)
        sub = 0.28 * sine(58 + n * 3, t) * shove
        rise = 0.25 * chirp(170 + n * 20, 2600 + n * 110, t, dur) * env(t, dur, 0.006, 0.22, 1.6)
        sparkle = 0.06 * saw(520 + 1300 * p, t) * env(t, dur, 0.004, 0.18, 1.2)
        l, r = pan(rise + sparkle, -0.6 + 1.2 * p)
        return sub + l + 0.055 * air_l() * shove, sub + r + 0.055 * air_r() * shove

    return fn


def line_gate(n: int) -> StereoFn:
    base = 455 + n * 52

    def fn(t: float, i: int) -> tuple[float, float]:
        dur = 0.33
        body = env(t, dur, 0.002, 0.22, 1.9)
        click = exp_tail(t, 65)
        left = (0.18 * sine(base, t) + 0.11 * sine(base * 1.5, t, 0.2)) * body
        right = (0.18 * sine(base * 1.006, t, 0.1) + 0.11 * sine(base * 1.515, t, 0.4)) * body
        snap_l, snap_r = pan(0.11 * chirp(base * 2.1, base * 3.2, t, 0.08) * click, 0.15)
        return left + snap_l, right + snap_r

    return fn


def gate_miss(n: int) -> StereoFn:
    grit = filtered_noise(4000 + n, 0.28)

    def fn(t: float, i: int) -> tuple[float, float]:
        dur = 0.36
        fall = 0.24 * chirp(560 - n * 35, 130 - n * 9, t, dur) * env(t, dur, 0.002, 0.22, 1.5)
        thud = 0.15 * sine(86 - n * 3, t) * exp_tail(t, 8)
        l, r = pan(fall + 0.05 * grit() * exp_tail(t, 15), -0.12)
        return l + thud, r + thud

    return fn


def rail_scrape(n: int) -> StereoFn:
    metal_l = filtered_noise(5000 + n, 0.42)
    metal_r = filtered_noise(5100 + n, 0.39)
    squeal = 1400 + n * 95

    def fn(t: float, i: int) -> tuple[float, float]:
        dur = 0.52
        scrape = env(t, dur, 0.002, 0.32, 1.15)
        chatter = 0.55 + 0.45 * sine(31 + n, t)
        left = 0.19 * metal_l() * scrape * chatter + 0.09 * sine(squeal + 160 * sine(17, t), t) * scrape
        right = 0.18 * metal_r() * scrape * (0.55 + 0.45 * sine(27 + n, t, 0.8)) + 0.08 * sine(squeal * 1.03, t) * scrape
        return left, right

    return fn


def whoosh(n: int, gravity: bool = False) -> StereoFn:
    noise_l = filtered_noise(6000 + n + (100 if gravity else 0), 0.18 if gravity else 0.24)
    noise_r = filtered_noise(6100 + n + (100 if gravity else 0), 0.18 if gravity else 0.24)
    side = -1 if n % 2 else 1

    def fn(t: float, i: int) -> tuple[float, float]:
        dur = 1.12 if gravity else 0.72
        p = t / dur
        shape = math.sin(math.pi * p) ** (0.7 if gravity else 0.55)
        if gravity:
            tone = 0.24 * chirp(250 + n * 11, 42 + n * 2, t, dur) * shape
            bend = 0.11 * saw(92 + 17 * sine(2.0, t), t) * shape
            pan_x = 0.58 * sine(0.5, t, n)
            l, r = pan(tone + bend, pan_x)
            return l + 0.08 * noise_l() * shape, r + 0.08 * noise_r() * shape
        tone = 0.18 * chirp(1280 + n * 44, 210 + n * 16, t, dur) * shape
        l, r = pan(tone, side * (0.9 - 1.8 * p))
        return l + 0.14 * noise_l() * shape, r + 0.14 * noise_r() * shape

    return fn


def damage_hit(n: int) -> StereoFn:
    crack_l = filtered_noise(7000 + n, 0.45)
    crack_r = filtered_noise(7100 + n, 0.41)

    def fn(t: float, i: int) -> tuple[float, float]:
        dur = 0.72
        sub = 0.34 * sine(78 - n * 2, t) * exp_tail(t, 13)
        glass_l = 0.17 * crack_l() * exp_tail(t, 18)
        glass_r = 0.17 * crack_r() * exp_tail(t, 16)
        absorb = 0.12 * chirp(450 + n * 40, 92 + n * 5, t, dur) * env(t, dur, 0.001, 0.5, 1.9)
        l, r = pan(absorb, -0.18 + n * 0.07)
        return sub + glass_l + l, sub + glass_r + r

    return fn


def death(n: int) -> StereoFn:
    dust_l = filtered_noise(8000 + n, 0.08)
    dust_r = filtered_noise(8100 + n, 0.08)

    def fn(t: float, i: int) -> tuple[float, float]:
        dur = 2.5
        p = t / dur
        sink = env(t, dur, 0.03, 1.7, 2.0)
        low = 0.32 * chirp(122 - n * 8, 24 + n * 2, t, dur) * sink
        fold = 0.12 * sine(220 * (1.0 - 0.58 * p), t, 0.4) * sink
        last = 0.05 * sine(622 / (1 + n * 0.04), t) * exp_tail(max(0.0, t - 0.35), 1.7) * sink
        l, r = pan(low + fold, 0.25 * sine(0.28, t))
        return l + last + 0.07 * dust_l() * (1 - p), r + last * 1.006 + 0.07 * dust_r() * (1 - p)

    return fn


def candidates() -> list[dict]:
    out = [
        music_stem("music-stellar-pulse", "music/stellar/pulse.ogg", 32.0, 0.78, stellar_pulse()),
        music_stem("music-stellar-bass", "music/stellar/bass.ogg", 32.0, 0.74, stellar_bass()),
        music_stem("music-stellar-motion", "music/stellar/motion.ogg", 32.0, 0.68, stellar_motion()),
        music_stem("music-stellar-danger", "music/stellar/danger.ogg", 32.0, 0.52, stellar_danger()),
        music_stem("music-heat-death-low-tone", "music/heat-death/low-tone.ogg", 90.0, 0.55, heat_low()),
        music_stem("music-heat-death-vanishing-texture", "music/heat-death/vanishing-texture.ogg", 90.0, 0.38, heat_texture()),
    ]
    out += [sfx(f"sfx-speedpad-{n:02d}", f"sfx/speed-pad/speed-pad-{n:02d}.ogg", 0.72, 0.84, speed_pad(n)) for n in range(1, 5)]
    out += [sfx(f"sfx-linegate-{n:02d}", f"sfx/line-gate/line-gate-{n:02d}.ogg", 0.33, 0.62, line_gate(n)) for n in range(1, 7)]
    out += [sfx(f"sfx-gatemiss-{n:02d}", f"sfx/gate-miss/gate-miss-{n:02d}.ogg", 0.36, 0.58, gate_miss(n)) for n in range(1, 4)]
    out += [sfx(f"sfx-railscrape-{n:02d}", f"sfx/rail-scrape/rail-scrape-{n:02d}.ogg", 0.52, 0.64, rail_scrape(n)) for n in range(1, 6)]
    out += [sfx(f"sfx-gravitywellwhoosh-{n:02d}", f"sfx/gravity-well-whoosh/gravity-well-whoosh-{n:02d}.ogg", 1.12, 0.78, whoosh(n, True)) for n in range(1, 5)]
    out += [sfx(f"sfx-hazardwhoosh-{n:02d}", f"sfx/hazard-whoosh/hazard-whoosh-{n:02d}.ogg", 0.72, 0.72, whoosh(n, False)) for n in range(1, 7)]
    out += [sfx(f"sfx-damagehit-{n:02d}", f"sfx/damage-hit/damage-hit-{n:02d}.ogg", 0.72, 0.84, damage_hit(n)) for n in range(1, 6)]
    out += [sfx(f"sfx-death-{n:02d}", f"sfx/death/death-absorbed-{n:02d}.ogg", 2.5, 0.82, death(n)) for n in range(1, 3)]
    return out


def write_metadata(meta_path: Path, ogg_path: Path, wav_path: Path, candidate: dict, matrix: dict[str, dict], batch: str) -> None:
    prompt = matrix.get(candidate["matrix_id"], {}).get("prompt", "")
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    payload = {
        "schema": "photon-audio-candidate.v1",
        "batch": batch,
        "matrix_id": candidate["matrix_id"],
        "target_path": candidate["rel"],
        "source": "original-local-procedural-candidate",
        "model_id": "local/procedural-photon-candidate-pack",
        "model_revision": "tools/generate_audio_candidate_pack.py",
        "license_tag": "internal-temp-original",
        "allowed_game_runtime": False,
        "generated_at": now,
        "duration_seconds": candidate["dur"],
        "sample_rate": SR,
        "prompt_sha256": hashlib.sha256(prompt.encode("utf8")).hexdigest() if prompt else None,
        "prompt": prompt,
        "generation_params": {
            "target_peak": candidate["target_peak"],
            "ogg_quality": 7,
            "channels": 2,
        },
        "files": {
            "ogg": ogg_path.name,
            "ogg_sha256": hash_file(ogg_path),
            "wav_master": wav_path.name,
            "wav_sha256": hash_file(wav_path),
        },
        "review_status": "candidate-only",
        "notes": "Generated for direction and listening review. Do not copy into runtime assets until approved.",
    }
    meta_path.write_text(json.dumps(payload, indent=2) + "\n")


def listening_index(batch_dir: Path, generated: list[dict]) -> None:
    rows = []
    for item in generated:
        rel = Path("runtime") / item["rel"]
        rows.append(f'      <tr><td>{item["matrix_id"]}</td><td><code>{item["rel"]}</code></td><td><audio controls preload="none" src="{rel.as_posix()}"></audio></td></tr>')
    html = "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        "  <title>Photon Audio Candidate Pack</title>",
        "  <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:24px;background:#090b10;color:#eef2ff}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #263044;padding:10px;text-align:left}audio{width:320px}code{color:#a7f3d0}</style>",
        "</head>",
        "<body>",
        "  <h1>Photon Audio Candidate Pack</h1>",
        "  <p>Candidate-only listening board. Keep files out of runtime assets until approved.</p>",
        "  <table>",
        "    <thead><tr><th>Matrix ID</th><th>Target</th><th>Listen</th></tr></thead>",
        "    <tbody>",
        *rows,
        "    </tbody>",
        "  </table>",
        "</body>",
        "</html>",
    ])
    (batch_dir / "listen.html").write_text(html)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Photon music and SFX candidate audio")
    parser.add_argument("--batch", default="local-forge-001")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is required")

    batch_dir = OUT_ROOT / args.batch
    runtime_dir = batch_dir / "runtime"
    masters_dir = batch_dir / "masters"
    if batch_dir.exists() and not args.force:
        raise SystemExit(f"{batch_dir} already exists; pass --force to overwrite")
    batch_dir.mkdir(parents=True, exist_ok=True)
    runtime_dir.mkdir(parents=True, exist_ok=True)
    masters_dir.mkdir(parents=True, exist_ok=True)

    matrix = read_prompt_matrix()
    generated = []
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        for candidate in candidates():
            wav_tmp = tmp / candidate["rel"].replace(".ogg", ".wav")
            wav_master = masters_dir / candidate["rel"].replace(".ogg", ".wav")
            ogg_path = runtime_dir / candidate["rel"]
            meta_path = ogg_path.with_suffix(".meta.json")
            render_wav(wav_tmp, candidate["dur"], candidate["fn"], candidate["target_peak"])
            wav_master.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(wav_tmp, wav_master)
            convert_to_ogg(wav_tmp, ogg_path)
            write_metadata(meta_path, ogg_path, wav_master, candidate, matrix, args.batch)
            generated.append(candidate)

    listening_index(batch_dir, generated)
    summary = {
        "batch": args.batch,
        "path": str(batch_dir.relative_to(ROOT)),
        "count": len(generated),
        "music": len([item for item in generated if item["matrix_id"].startswith("music-")]),
        "sfx": len([item for item in generated if item["matrix_id"].startswith("sfx-")]),
        "listen": str((batch_dir / "listen.html").relative_to(ROOT)),
    }
    (batch_dir / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
