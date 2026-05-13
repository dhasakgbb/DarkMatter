#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const photonDir = join(root, 'photon');
const manifestPath = join(photonDir, 'src', 'audio-manifest.json');
const bundledRoot = join(photonDir, 'src', 'audio-assets');
const publicRoot = join(photonDir, 'public', 'audio');
const evidenceDir = join(root, 'docs', 'evidence', 'audio-engagement');
const asJson = process.argv.includes('--json');
const writeReport = process.argv.includes('--write-report');
const strict = process.argv.includes('--strict');
const sampleRate = 16_000;
const windowMs = 50;
const windowSamples = Math.round(sampleRate * windowMs / 1000);

const musicIntent = {
  Inflationary: 'pressure',
  'Quark Plasma': 'pressure',
  Recombination: 'clarity',
  'First Stars': 'lift',
  Galactic: 'flow',
  Stellar: 'peak',
  Degenerate: 'cooldown',
  'Black Hole': 'restraint',
  'Heat Death': 'absence',
};

const sfxRole = {
  speedPad: 'reward',
  lineGate: 'reward',
  gateMiss: 'negative',
  railScrape: 'strain',
  pickup: 'reward',
  wavelengthShift: 'state',
  damageHit: 'impact',
  death: 'meaning',
  witnessChime: 'meaning',
  hazardWhoosh: 'threat',
  gravityWellWhoosh: 'threat',
  engineLoop: 'loop',
  uiTick: 'ui',
  uiClick: 'ui',
  uiSwoosh: 'ui',
  epochRiser: 'transition',
  memoryUnlock: 'meaning',
};

const requiredSfxVariants = {
  speedPad: 4,
  lineGate: 6,
  gateMiss: 3,
  railScrape: 5,
  pickup: 4,
  wavelengthShift: 3,
  damageHit: 5,
  death: 2,
  witnessChime: 1,
  hazardWhoosh: 6,
  gravityWellWhoosh: 4,
  engineLoop: 1,
  uiTick: 1,
  uiClick: 1,
  uiSwoosh: 1,
  epochRiser: 2,
  memoryUnlock: 1,
};

const requiredMusicStems = {
  Stellar: ['pulse', 'bass', 'motion', 'danger'],
  'Heat Death': ['low-tone', 'vanishing-texture'],
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function round(value, places = 3) {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function db(value) {
  return 20 * Math.log10(Math.max(value, 1e-7));
}

function scoreRange(value, low, high) {
  if (!Number.isFinite(value)) return 0;
  if (value >= low && value <= high) return 1;
  const span = Math.max(1e-7, high - low);
  if (value < low) return clamp(1 - (low - value) / span);
  return clamp(1 - (value - high) / span);
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp((sorted.length - 1) * p, 0, sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function commandAvailable(command) {
  return spawnSync(command, ['-version'], { encoding: 'utf8' }).status === 0;
}

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function usesDirectorTempAssets(manifest) {
  return /director-temp|temporary|generated/i.test(String(manifest.notes ?? ''));
}

function resolveAssetPath(relPath) {
  const bundledPath = join(bundledRoot, relPath);
  if (existsSync(bundledPath)) return bundledPath;
  const publicPath = join(publicRoot, relPath);
  if (existsSync(publicPath)) return publicPath;
  return null;
}

function manifestEntries(manifest) {
  const entries = [];
  for (const [epoch, entry] of Object.entries(manifest.music ?? {})) {
    if (entry.enabled === false) continue;
    for (const stem of entry.stems ?? []) {
      if (stem.enabled === false) continue;
      entries.push({
        kind: 'music', cue: epoch, stem: stem.stem ?? 'stem', path: stem.path,
        gain: stem.gain ?? 1, loop: stem.loop !== false,
        role: musicIntent[epoch] ?? 'epoch', absolutePath: resolveAssetPath(stem.path),
      });
    }
  }
  for (const [cue, entry] of Object.entries(manifest.sfx ?? {})) {
    if (entry.enabled === false) continue;
    for (const variant of entry.variants ?? []) {
      if (variant.enabled === false) continue;
      entries.push({
        kind: 'sfx', cue, path: variant.path,
        gain: (entry.gain ?? 1) * (variant.gain ?? 1),
        rate: (entry.rate ?? 1) * (variant.rate ?? 1),
        loop: variant.loop === true, spatial: entry.spatial === true,
        role: sfxRole[cue] ?? 'cue', absolutePath: resolveAssetPath(variant.path),
      });
    }
  }
  return entries;
}

function decodePcm(filePath) {
  const result = spawnSync('ffmpeg', [
    '-v', 'error', '-i', filePath,
    '-ac', '1', '-ar', String(sampleRate),
    '-f', 'f32le', 'pipe:1',
  ], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(result.stderr?.toString('utf8').trim() || `ffmpeg failed for ${filePath}`);
  }
  const count = Math.floor(result.stdout.byteLength / 4);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) samples[i] = result.stdout.readFloatLE(i * 4);
  return samples;
}

function analyzeSamples(samples) {
  if (samples.length === 0) {
    return emptyMetrics();
  }

  let sumSquares = 0;
  let peak = 0;
  let zeroCrossings = 0;
  let previousSign = 0;
  const windowRms = [];
  const windowDb = [];

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const abs = Math.abs(sample);
    sumSquares += sample * sample;
    if (abs > peak) peak = abs;
    const sign = sample >= 0 ? 1 : -1;
    if (previousSign !== 0 && sign !== previousSign) zeroCrossings += 1;
    previousSign = sign;
  }

  for (let start = 0; start < samples.length; start += windowSamples) {
    const end = Math.min(samples.length, start + windowSamples);
    let windowSquares = 0;
    for (let i = start; i < end; i++) windowSquares += samples[i] * samples[i];
    const rms = Math.sqrt(windowSquares / Math.max(1, end - start));
    windowRms.push(rms);
    windowDb.push(db(rms));
  }

  let transientCount = 0;
  for (let i = 2; i < windowDb.length; i++) {
    const rise = windowDb[i] - windowDb[i - 1];
    if (windowDb[i] > -42 && rise > 4.5) transientCount += 1;
  }

  const durationSeconds = samples.length / sampleRate;
  const rms = Math.sqrt(sumSquares / samples.length);
  const rmsDb = db(rms);
  const peakDb = db(peak);
  const activeWindows = windowDb.filter((value) => value > -45);
  const silenceRatio = windowDb.filter((value) => value <= -45).length / Math.max(1, windowDb.length);
  const p95 = percentile(activeWindows.length ? activeWindows : windowDb, 0.95);
  const p10 = percentile(activeWindows.length ? activeWindows : windowDb, 0.10);

  return {
    durationSeconds,
    rmsDb,
    peakDb,
    crestDb: peakDb - rmsDb,
    dynamicRangeDb: Math.max(0, p95 - p10),
    motionDb: std(activeWindows.length ? activeWindows : windowDb),
    transientDensity: transientCount / Math.max(0.1, durationSeconds),
    pulseClarity: pulseClarity(windowRms),
    zeroCrossingsPerSecond: zeroCrossings / Math.max(0.1, durationSeconds),
    silenceRatio,
    activityRatio: activeWindows.length / Math.max(1, windowDb.length),
  };
}

function emptyMetrics() {
  return {
    durationSeconds: 0, rmsDb: -140, peakDb: -140, crestDb: 0,
    dynamicRangeDb: 0, motionDb: 0, transientDensity: 0,
    pulseClarity: 0, zeroCrossingsPerSecond: 0, silenceRatio: 1,
    activityRatio: 0,
  };
}

function pulseClarity(envelope) {
  if (envelope.length < 12) return 0;
  const avg = mean(envelope);
  const centered = envelope.map((value) => value - avg);
  if (centered.reduce((sum, value) => sum + value * value, 0) <= 1e-9) return 0;
  let best = 0;
  const minLag = 5;
  const maxLag = Math.min(80, Math.floor(envelope.length / 2));
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let left = 0;
    let right = 0;
    for (let i = lag; i < centered.length; i++) {
      corr += centered[i] * centered[i - lag];
      left += centered[i] ** 2;
      right += centered[i - lag] ** 2;
    }
    const normalized = corr / Math.sqrt(Math.max(1e-9, left * right));
    if (normalized > best) best = normalized;
  }
  return clamp(best);
}

function scoreMusic(entry, metrics) {
  const durationScore = entry.role === 'absence'
    ? scoreRange(metrics.durationSeconds, 180, 420)
    : scoreRange(metrics.durationSeconds, 30, 150);
  const loudnessScore = entry.role === 'peak'
    ? scoreRange(metrics.rmsDb, -26, -11)
    : entry.role === 'absence'
      ? scoreRange(metrics.rmsDb, -44, -18)
      : scoreRange(metrics.rmsDb, -34, -12);
  const transientScore = entry.role === 'absence'
    ? scoreRange(metrics.transientDensity, 0, 0.6)
    : entry.role === 'restraint'
      ? scoreRange(metrics.transientDensity, 0, 1.2)
      : scoreRange(metrics.transientDensity, 0.25, 5.5);
  const pulseScore = ['peak', 'flow', 'pressure', 'lift'].includes(entry.role)
    ? scoreRange(metrics.pulseClarity, 0.08, 0.85)
    : scoreRange(metrics.pulseClarity, 0, 0.7);
  const silenceScore = entry.role === 'absence'
    ? scoreRange(metrics.silenceRatio, 0.05, 0.8)
    : scoreRange(metrics.silenceRatio, 0, 0.25);

  return weightedScore({
    duration: [durationScore, 1.3],
    headroom: [metrics.peakDb <= -0.5 ? 1 : clamp(1 - (metrics.peakDb + 0.5) / 2), 1.2],
    loop: [entry.loop || entry.role === 'absence' ? 1 : 0.55, 0.9],
    loudness: [loudnessScore, 1.1],
    motion: [entry.role === 'absence' ? scoreRange(metrics.motionDb, 0.05, 5.5) : scoreRange(metrics.motionDb, 0.8, 10), 1.2],
    transientDensity: [transientScore, 1],
    pulseClarity: [pulseScore, 0.8],
    silence: [silenceScore, entry.role === 'absence' ? 1.2 : 0.4],
  });
}

function scoreSfx(entry, metrics) {
  const target = sfxTargets(entry.role);
  return weightedScore({
    duration: [scoreRange(metrics.durationSeconds, target.duration[0], target.duration[1]), 1.4],
    headroom: [metrics.peakDb <= -0.5 ? 1 : clamp(1 - (metrics.peakDb + 0.5) / 2), 1.2],
    loudness: [scoreRange(metrics.rmsDb, target.rms[0], target.rms[1]), 0.9],
    crest: [scoreRange(metrics.crestDb, target.crest[0], target.crest[1]), 1],
    transientDensity: [scoreRange(metrics.transientDensity, target.transients[0], target.transients[1]), 1.1],
    brightness: [scoreRange(metrics.zeroCrossingsPerSecond, target.zcr[0], target.zcr[1]), 0.7],
    trim: [scoreRange(metrics.silenceRatio, target.silence[0], target.silence[1]), 0.8],
  });
}

function sfxTargets(role) {
  const defaults = { duration: [0.06, 1.2], rms: [-34, -9], crest: [5, 24], transients: [0.4, 18], zcr: [200, 6500], silence: [0, 0.35] };
  return {
    reward: { duration: [0.08, 0.75], rms: [-30, -8], crest: [4, 20], transients: [1, 22], zcr: [450, 8000], silence: [0, 0.22] },
    negative: { duration: [0.08, 0.8], rms: [-32, -8], crest: [4, 22], transients: [0.5, 16], zcr: [180, 5500], silence: [0, 0.25] },
    strain: { duration: [0.08, 0.9], rms: [-34, -8], crest: [5, 28], transients: [0.5, 20], zcr: [800, 10000], silence: [0, 0.25] },
    state: { duration: [0.12, 0.9], rms: [-34, -8], crest: [4, 22], transients: [0.4, 16], zcr: [250, 7500], silence: [0, 0.25] },
    impact: { duration: [0.08, 0.8], rms: [-28, -7], crest: [5, 24], transients: [1, 24], zcr: [300, 8500], silence: [0, 0.2] },
    threat: { duration: [0.18, 1.6], rms: [-38, -10], crest: [5, 28], transients: [0, 10], zcr: [200, 7000], silence: [0, 0.35] },
    meaning: { duration: [0.8, 6.5], rms: [-38, -10], crest: [4, 26], transients: [0, 8], zcr: [80, 5500], silence: [0, 0.45] },
    loop: { duration: [0.8, 12], rms: [-42, -12], crest: [2, 20], transients: [0, 8], zcr: [40, 4000], silence: [0, 0.2] },
    ui: { duration: [0.03, 0.45], rms: [-36, -12], crest: [4, 26], transients: [1, 35], zcr: [400, 9000], silence: [0, 0.25] },
    transition: { duration: [1.0, 4.5], rms: [-38, -9], crest: [4, 26], transients: [0, 8], zcr: [120, 7500], silence: [0, 0.35] },
  }[role] ?? defaults;
}

function weightedScore(parts) {
  let weight = 0;
  let total = 0;
  const breakdown = {};
  for (const [name, [score, partWeight]] of Object.entries(parts)) {
    const safeScore = clamp(score);
    breakdown[name] = round(safeScore * 100, 1);
    total += safeScore * partWeight;
    weight += partWeight;
  }
  return { score: Math.round((total / weight) * 100), breakdown };
}

function averageScores(items) {
  if (items.length === 0) return 0;
  return Math.round(mean(items.map((item) => item.score)));
}

function coverageScores(manifest) {
  const musicStemCoverage = {};
  for (const [epoch, required] of Object.entries(requiredMusicStems)) {
    const stems = new Set((manifest.music?.[epoch]?.stems ?? [])
      .filter((stem) => manifest.music?.[epoch]?.enabled !== false && stem.enabled !== false)
      .map((stem) => stem.stem ?? 'stem'));
    const present = required.filter((stem) => stems.has(stem));
    musicStemCoverage[epoch] = { required, present, score: Math.round((present.length / required.length) * 100) };
  }

  const sfxCoverage = {};
  for (const [cue, required] of Object.entries(requiredSfxVariants)) {
    const entry = manifest.sfx?.[cue];
    const present = (entry?.variants ?? []).filter((variant) => entry?.enabled !== false && variant.enabled !== false).length;
    sfxCoverage[cue] = { required, present, score: Math.round(clamp(present / required) * 100) };
  }

  return {
    musicStemCoverage,
    sfxCoverage,
    musicScore: Math.round(mean(Object.values(musicStemCoverage).map((item) => item.score))),
    sfxScore: Math.round(mean(Object.values(sfxCoverage).map((item) => item.score))),
  };
}

function lowestParts(scored, count = 3) {
  return Object.entries(scored.breakdown)
    .sort((a, b) => a[1] - b[1])
    .slice(0, count)
    .map(([name, value]) => `${name} ${value}`);
}

function cleanEntry(entry) {
  const clean = { ...entry };
  delete clean.absolutePath;
  return clean;
}

function severityRank(severity) {
  return { high: 0, medium: 1, low: 2 }[severity] ?? 3;
}

function makeFindings(report) {
  const findings = [];
  if (report.gates?.directorTempAssets) {
    findings.push({ severity: 'high', issue: 'Current assets are director-temp placeholders', evidence: 'Raw waveform scores can guide tuning, but final engagement/identity still requires commissioned or licensed production audio.' });
  }
  for (const entry of report.entries) {
    if (entry.status !== 'ok') {
      findings.push({ severity: 'high', issue: `${entry.kind}:${entry.cue} could not be analyzed`, evidence: entry.error || entry.path });
      continue;
    }
    if (entry.score < 55) {
      findings.push({ severity: 'medium', issue: `${entry.kind}:${entry.cue} scores low (${entry.score})`, evidence: `${entry.path}: ${entry.lowestParts.join(', ')}` });
    }
    if (entry.metrics.peakDb > -0.1) {
      findings.push({ severity: 'medium', issue: `${entry.kind}:${entry.cue} has little peak headroom`, evidence: `${entry.path}: peak ${round(entry.metrics.peakDb, 1)} dBFS` });
    }
  }

  for (const [epoch, item] of Object.entries(report.coverage.musicStemCoverage)) {
    if (item.score < 100) {
      findings.push({ severity: epoch === 'Stellar' ? 'high' : 'medium', issue: `${epoch} is missing required production stems`, evidence: `present ${item.present.join(', ') || 'none'}; required ${item.required.join(', ')}` });
    }
  }
  for (const [cue, item] of Object.entries(report.coverage.sfxCoverage)) {
    if (item.score < 100) {
      const severity = ['speedPad', 'lineGate', 'railScrape', 'damageHit', 'hazardWhoosh', 'gravityWellWhoosh'].includes(cue) ? 'medium' : 'low';
      findings.push({ severity, issue: `${cue} needs more final variations`, evidence: `${item.present}/${item.required} variants` });
    }
  }
  return findings.sort((a, b) => severityRank(a.severity) - severityRank(b.severity)).slice(0, 24);
}

function buildReport() {
  const ffmpegAvailable = commandAvailable('ffmpeg');
  const manifest = readManifest();
  const entries = manifestEntries(manifest);
  const coverage = coverageScores(manifest);

  if (!ffmpegAvailable) {
    const report = {
      generatedAt: new Date().toISOString(), manifest: relative(root, manifestPath),
      environment: { ffmpegAvailable, sampleRate, windowMs },
      summary: { overall: 0, music: 0, sfx: 0, heatDeath: 0, racingReadability: 0, coverage: 0 },
      coverage,
      entries: entries.map((entry) => ({ ...cleanEntry(entry), status: 'skipped', error: 'ffmpeg unavailable' })),
    };
    report.findings = [{ severity: 'high', issue: 'ffmpeg is unavailable', evidence: 'Install ffmpeg to run waveform engagement analysis.' }];
    return report;
  }

  const analyzed = [];
  for (const entry of entries) {
    if (!entry.absolutePath) {
      analyzed.push({ ...cleanEntry(entry), status: 'missing', score: 0, error: 'asset path not found' });
      continue;
    }
    try {
      const metrics = analyzeSamples(decodePcm(entry.absolutePath));
      const scored = entry.kind === 'music' ? scoreMusic(entry, metrics) : scoreSfx(entry, metrics);
      analyzed.push({
        ...cleanEntry(entry), status: 'ok', score: scored.score, breakdown: scored.breakdown,
        lowestParts: lowestParts(scored),
        metrics: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, round(value, 3)])),
      });
    } catch (err) {
      analyzed.push({ ...cleanEntry(entry), status: 'error', score: 0, error: String(err?.message || err) });
    }
  }

  const musicEntries = analyzed.filter((entry) => entry.kind === 'music' && entry.status === 'ok');
  const sfxEntries = analyzed.filter((entry) => entry.kind === 'sfx' && entry.status === 'ok');
  const heatDeathEntries = musicEntries.filter((entry) => entry.cue === 'Heat Death');
  const racingCueNames = new Set(['speedPad', 'lineGate', 'gateMiss', 'railScrape', 'pickup', 'wavelengthShift', 'damageHit', 'hazardWhoosh', 'gravityWellWhoosh']);
  const racingEntries = sfxEntries.filter((entry) => racingCueNames.has(entry.cue));
  const musicScore = averageScores(musicEntries);
  const sfxScore = averageScores(sfxEntries);
  const heatDeathScore = averageScores(heatDeathEntries);
  const racingScore = averageScores(racingEntries);
  const coverageScore = Math.round((coverage.musicScore * 0.35) + (coverage.sfxScore * 0.65));
  const rawWaveform = Math.round(musicScore * 0.28 + sfxScore * 0.23 + heatDeathScore * 0.18 + racingScore * 0.21 + coverageScore * 0.10);
  const directorTempAssets = usesDirectorTempAssets(manifest);
  const productionCap = directorTempAssets ? 68 : null;
  const overall = productionCap === null ? rawWaveform : Math.min(rawWaveform, productionCap);

  const report = {
    generatedAt: new Date().toISOString(),
    manifest: relative(root, manifestPath),
    environment: { ffmpegAvailable, sampleRate, windowMs },
    gates: {
      directorTempAssets,
      productionCap,
      note: directorTempAssets ? 'Current manifest identifies these as director-temp/generated placeholder assets; raw waveform scores are reference signals, not final audio signoff.' : 'No director-temp manifest gate detected.',
    },
    summary: { overall, rawWaveform, music: musicScore, sfx: sfxScore, heatDeath: heatDeathScore, racingReadability: racingScore, coverage: coverageScore },
    coverage,
    entries: analyzed,
  };
  report.findings = makeFindings(report);
  return report;
}

function verdict(score) {
  if (score >= 85) return 'studio-ready signal';
  if (score >= 72) return 'promising, needs playtest confirmation';
  if (score >= 60) return 'usable temp/reference quality';
  return 'not ready for final audio signoff';
}

function printHuman(report) {
  console.log('Photon audio engagement score');
  console.log(`manifest: ${report.manifest}`);
  console.log(`overall: ${report.summary.overall}/100 (${verdict(report.summary.overall)})`);
  if (report.summary.rawWaveform !== report.summary.overall) {
    console.log(`raw waveform potential: ${report.summary.rawWaveform}/100`);
    console.log(`production gate: ${report.gates.note}`);
  }
  console.log(`music: ${report.summary.music}/100`);
  console.log(`sfx: ${report.summary.sfx}/100`);
  console.log(`racing readability: ${report.summary.racingReadability}/100`);
  console.log(`Heat Death restraint: ${report.summary.heatDeath}/100`);
  console.log(`coverage: ${report.summary.coverage}/100`);

  const notable = [...report.entries].filter((entry) => entry.status === 'ok').sort((a, b) => a.score - b.score).slice(0, 12);
  if (notable.length > 0) {
    console.log('\nLowest-scoring analyzed assets:');
    for (const entry of notable) {
      const label = entry.kind === 'music' ? `${entry.cue}/${entry.stem}` : entry.cue;
      console.log(`- ${entry.score}/100 ${entry.kind}:${label} (${entry.lowestParts.join(', ')})`);
    }
  }

  if (report.findings.length > 0) {
    console.log('\nFindings:');
    for (const finding of report.findings.slice(0, 12)) {
      console.log(`- ${finding.severity}: ${finding.issue} — ${finding.evidence}`);
    }
  }
}

function markdownReport(report) {
  const lines = [];
  lines.push('# Photon Audio Engagement Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Signal | Score |');
  lines.push('|---|---:|');
  for (const [key, value] of Object.entries(report.summary)) lines.push(`| ${key} | ${value} |`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  if (report.findings.length === 0) {
    lines.push('No automated findings. Human listening and in-game playtest are still required.');
  } else {
    for (const finding of report.findings) lines.push(`- **${finding.severity}:** ${finding.issue} (${finding.evidence})`);
  }
  lines.push('');
  lines.push('## Lowest Scoring Assets');
  lines.push('');
  lines.push('| Score | Kind | Cue | Asset | Lowest Parts |');
  lines.push('|---:|---|---|---|---|');
  for (const entry of [...report.entries].filter((item) => item.status === 'ok').sort((a, b) => a.score - b.score).slice(0, 24)) {
    const cue = entry.kind === 'music' ? `${entry.cue}/${entry.stem}` : entry.cue;
    lines.push(`| ${entry.score} | ${entry.kind} | ${cue} | ${entry.path} | ${entry.lowestParts.join('; ')} |`);
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- This is an automated screening signal, not a replacement for listening tests.');
  lines.push('- Scores reward Photon-specific goals: racing readability, musical movement, headroom, variation coverage, and Heat Death restraint.');
  lines.push('- Final audio still needs in-game playtesting on headphones and laptop speakers.');
  return `${lines.join('\n')}\n`;
}

const report = buildReport();

if (writeReport) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, 'audio-engagement-report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(evidenceDir, 'audio-engagement-report.md'), markdownReport(report));
}

if (asJson) console.log(JSON.stringify(report, null, 2));
else printHuman(report);

if (strict && report.findings.some((finding) => finding.severity === 'high')) process.exitCode = 1;
