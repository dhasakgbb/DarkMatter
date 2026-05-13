#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const photonDir = join(root, 'photon');
const manifestPath = join(photonDir, 'src', 'audio-manifest.json');
const bundledRoot = join(photonDir, 'src', 'audio-assets');
const publicRoot = join(photonDir, 'public', 'audio');
const asJson = process.argv.includes('--json');

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function walkAudioFiles(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...walkAudioFiles(path, rel));
    } else if (name.endsWith('.ogg') || name.endsWith('.wav')) {
      out.push({ rel, path, bytes: stat.size });
    }
  }
  return out;
}

function manifestEntries(manifest) {
  const entries = [];
  for (const [epoch, entry] of Object.entries(manifest.music ?? {})) {
    for (const stem of entry.stems ?? []) {
      entries.push({
        kind: 'music',
        cue: epoch,
        stem: stem.stem ?? 'stem',
        path: stem.path,
        enabled: entry.enabled !== false && stem.enabled !== false,
      });
    }
  }
  for (const [cue, entry] of Object.entries(manifest.sfx ?? {})) {
    for (const variant of entry.variants ?? []) {
      entries.push({
        kind: 'sfx',
        cue,
        path: variant.path,
        enabled: entry.enabled !== false && variant.enabled !== false,
      });
    }
  }
  return entries;
}

function probeDurations(files) {
  const ffprobeAvailable = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' }).status === 0;
  if (!ffprobeAvailable) return { available: false, checked: 0, failures: [], durations: [] };

  const failures = [];
  const durations = [];
  for (const file of files) {
    const result = spawnSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file.path],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) {
      failures.push({ path: file.rel, error: (result.stderr || result.stdout).trim() });
      continue;
    }
    const seconds = Number(result.stdout.trim());
    durations.push({ path: file.rel, seconds, bytes: file.bytes });
  }

  return { available: true, checked: files.length, failures, durations };
}

function summarize() {
  const manifest = readManifest();
  const entries = manifestEntries(manifest);
  const bundledAssets = walkAudioFiles(bundledRoot);
  const publicAssets = walkAudioFiles(publicRoot);
  const bundledSet = new Set(bundledAssets.map((asset) => asset.rel));
  const publicSet = new Set(publicAssets.map((asset) => asset.rel));
  const wantedSet = new Set(entries.map((entry) => entry.path));
  const enabled = entries.filter((entry) => entry.enabled);
  const missing = enabled.filter((entry) => !bundledSet.has(entry.path) && !publicSet.has(entry.path));
  const orphanedBundled = bundledAssets.filter((asset) => !wantedSet.has(asset.rel));
  const orphanedPublic = publicAssets.filter((asset) => !wantedSet.has(asset.rel));
  const allAssets = [...bundledAssets, ...publicAssets];
  const probe = probeDurations(allAssets);
  const seconds = probe.durations.map((item) => item.seconds).filter(Number.isFinite).sort((a, b) => a - b);
  const bytes = bundledAssets.map((asset) => asset.bytes).sort((a, b) => a - b);

  const byMusicEpoch = Object.fromEntries(Object.entries(manifest.music ?? {}).map(([epoch, entry]) => [
    epoch,
    (entry.stems ?? []).filter((stem) => entry.enabled !== false && stem.enabled !== false).length,
  ]));
  const bySfxCue = Object.fromEntries(Object.entries(manifest.sfx ?? {}).map(([cue, entry]) => [
    cue,
    (entry.variants ?? []).filter((variant) => entry.enabled !== false && variant.enabled !== false).length,
  ]));

  return {
    manifest: {
      path: relative(root, manifestPath),
      schema: manifest.schema,
      version: manifest.version,
      entries: entries.length,
      enabledMusic: enabled.filter((entry) => entry.kind === 'music').length,
      enabledSfx: enabled.filter((entry) => entry.kind === 'sfx').length,
      disabled: entries.filter((entry) => !entry.enabled).length,
    },
    assets: {
      bundledFiles: bundledAssets.length,
      publicFiles: publicAssets.length,
      bundledBytes: bundledAssets.reduce((sum, asset) => sum + asset.bytes, 0),
      bundledMinBytes: bytes[0] ?? 0,
      bundledMaxBytes: bytes.at(-1) ?? 0,
      missing,
      orphanedBundled: orphanedBundled.map((asset) => asset.rel),
      orphanedPublic: orphanedPublic.map((asset) => asset.rel),
    },
    probe: {
      ffprobeAvailable: probe.available,
      checked: probe.checked,
      failures: probe.failures,
      durationSeconds: {
        min: seconds[0] ?? 0,
        max: seconds.at(-1) ?? 0,
        total: seconds.reduce((sum, value) => sum + value, 0),
      },
    },
    coverage: { byMusicEpoch, bySfxCue },
  };
}

function printHuman(summary) {
  console.log('Photon audio manifest audit');
  console.log(`manifest: ${summary.manifest.path} (${summary.manifest.schema}, v${summary.manifest.version})`);
  console.log(`enabled entries: ${summary.manifest.enabledMusic} music + ${summary.manifest.enabledSfx} sfx`);
  console.log(`bundled assets: ${summary.assets.bundledFiles} files, ${summary.assets.bundledBytes} bytes`);
  console.log(`public assets: ${summary.assets.publicFiles} files`);
  console.log(`missing enabled manifest paths: ${summary.assets.missing.length}`);
  console.log(`orphaned bundled assets: ${summary.assets.orphanedBundled.length}`);
  console.log(`orphaned public assets: ${summary.assets.orphanedPublic.length}`);
  if (summary.probe.ffprobeAvailable) {
    console.log(
      `ffprobe: ${summary.probe.checked} checked, ${summary.probe.failures.length} failures, `
      + `${summary.probe.durationSeconds.min.toFixed(2)}s-${summary.probe.durationSeconds.max.toFixed(2)}s, `
      + `${summary.probe.durationSeconds.total.toFixed(2)}s total`,
    );
  } else {
    console.log('ffprobe: unavailable, decode-duration probe skipped');
  }

  if (summary.assets.missing.length > 0) {
    console.log('\nMissing enabled paths:');
    for (const entry of summary.assets.missing) console.log(`- ${entry.kind}:${entry.cue} -> ${entry.path}`);
  }
  if (summary.probe.failures.length > 0) {
    console.log('\nDecode/probe failures:');
    for (const failure of summary.probe.failures) console.log(`- ${failure.path}: ${failure.error}`);
  }
}

const summary = summarize();
if (asJson) console.log(JSON.stringify(summary, null, 2));
else printHuman(summary);

if (summary.assets.missing.length > 0 || summary.probe.failures.length > 0) {
  process.exitCode = 1;
}