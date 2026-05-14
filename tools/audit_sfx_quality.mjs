#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const photonDir = join(root, 'photon');
const manifestPath = join(photonDir, 'src', 'audio-manifest.json');
const bundledRoot = join(photonDir, 'src', 'audio-assets');
const asJson = process.argv.includes('--json');

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function enabledSfxEntries(manifest) {
  const entries = [];
  for (const [cue, entry] of Object.entries(manifest.sfx ?? {})) {
    if (entry.enabled === false) continue;
    for (const variant of entry.variants ?? []) {
      if (variant.enabled === false) continue;
      entries.push({ cue, path: variant.path, file: join(bundledRoot, variant.path) });
    }
  }
  return entries;
}

function fail(path, message, detail = '') {
  return { path, message, detail };
}

function probeAudio(entry) {
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels,sample_rate,duration', '-of', 'json', entry.file],
    { encoding: 'utf8' },
  );
  if (probe.status !== 0) {
    return { issues: [fail(entry.path, 'ffprobe failed', (probe.stderr || probe.stdout).trim())] };
  }
  const stream = JSON.parse(probe.stdout).streams?.[0];
  if (!stream) return { issues: [fail(entry.path, 'no audio stream')] };

  const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', entry.file, '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  if (decoded.status !== 0) {
    return { issues: [fail(entry.path, 'ffmpeg decode failed', decoded.stderr.toString().trim())] };
  }
  const samples = decoded.stdout.length / 8;
  if (samples <= 0) return { issues: [fail(entry.path, 'decoded to silence/no samples')] };

  let peak = 0;
  let energy = 0;
  let diffEnergy = 0;
  for (let offset = 0; offset < decoded.stdout.length; offset += 8) {
    const left = decoded.stdout.readFloatLE(offset);
    const right = decoded.stdout.readFloatLE(offset + 4);
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    energy += (left * left + right * right) * 0.5;
    const diff = left - right;
    diffEnergy += diff * diff;
  }

  const stats = {
    cue: entry.cue,
    path: entry.path,
    channels: Number(stream.channels),
    sampleRate: Number(stream.sample_rate),
    duration: Number(stream.duration),
    peak,
    rms: Math.sqrt(energy / samples),
    stereoDiffRms: Math.sqrt(diffEnergy / samples),
  };

  const issues = [];
  if (stats.channels !== 2) issues.push(fail(entry.path, 'expected stereo stream', `${stats.channels} channels`));
  if (stats.sampleRate !== 48000) issues.push(fail(entry.path, 'expected 48 kHz sample rate', `${stats.sampleRate} Hz`));
  if (!Number.isFinite(stats.duration) || stats.duration < 0.045) issues.push(fail(entry.path, 'duration too short', String(stats.duration)));
  if (stats.duration > 10) issues.push(fail(entry.path, 'SFX duration too long', `${stats.duration.toFixed(2)}s`));
  if (stats.peak >= 0.98) issues.push(fail(entry.path, 'peak too close to clipping', stats.peak.toFixed(3)));
  if (stats.peak < 0.05) issues.push(fail(entry.path, 'peak too low or nearly silent', stats.peak.toFixed(3)));
  if (stats.rms < 0.006) issues.push(fail(entry.path, 'RMS too low or nearly silent', stats.rms.toFixed(4)));
  if (stats.stereoDiffRms <= 0.003) issues.push(fail(entry.path, 'stereo width collapsed to dual-mono', stats.stereoDiffRms.toFixed(4)));
  return { stats, issues };
}

const manifest = readManifest();
const entries = enabledSfxEntries(manifest);
const results = entries.map(probeAudio);
const stats = results.map((result) => result.stats).filter(Boolean);
const issues = results.flatMap((result) => result.issues ?? []);
const summary = {
  checked: entries.length,
  issues,
  peak: {
    min: Math.min(...stats.map((item) => item.peak)),
    max: Math.max(...stats.map((item) => item.peak)),
  },
  rms: {
    min: Math.min(...stats.map((item) => item.rms)),
    max: Math.max(...stats.map((item) => item.rms)),
  },
  stereoDiffRms: {
    min: Math.min(...stats.map((item) => item.stereoDiffRms)),
    max: Math.max(...stats.map((item) => item.stereoDiffRms)),
  },
};

if (asJson) {
  console.log(JSON.stringify({ summary, stats }, null, 2));
} else {
  console.log('Photon SFX quality audit');
  console.log(`checked: ${summary.checked} enabled SFX assets`);
  console.log(`peak: ${summary.peak.min.toFixed(3)}-${summary.peak.max.toFixed(3)}`);
  console.log(`rms: ${summary.rms.min.toFixed(4)}-${summary.rms.max.toFixed(4)}`);
  console.log(`stereo diff rms: ${summary.stereoDiffRms.min.toFixed(4)}-${summary.stereoDiffRms.max.toFixed(4)}`);
  console.log(`issues: ${summary.issues.length}`);
  for (const issue of summary.issues) console.log(`- ${issue.path}: ${issue.message}${issue.detail ? ` (${issue.detail})` : ''}`);
}

if (issues.length > 0) process.exitCode = 1;
