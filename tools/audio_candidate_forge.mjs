#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const manifestPath = join(root, 'photon', 'src', 'audio-manifest.json');
const outDir = join(root, 'docs', 'evidence', 'audio-candidate-forge');
const args = new Set(process.argv.slice(2));
const candidateRootArg = valueAfter('--candidate-root');
const write = args.has('--write') || !args.has('--print');
const asJson = args.has('--json');

const modelLanes = [
  {
    id: 'musicgen-medium',
    model: 'facebook/musicgen-medium',
    url: 'https://hf.co/facebook/musicgen-medium',
    license: 'cc-by-nc-4.0',
    allowedUse: 'reference-only unless separate commercial rights are obtained',
    bestFor: 'epoch music loops, pulse beds, restrained melodic motion',
  },
  {
    id: 'musicgen-stereo-large',
    model: 'facebook/musicgen-stereo-large',
    url: 'https://hf.co/facebook/musicgen-stereo-large',
    license: 'cc-by-nc-4.0',
    allowedUse: 'reference-only unless separate commercial rights are obtained',
    bestFor: 'wide music references and final-composer briefing material',
  },
  {
    id: 'audioldm2',
    model: 'cvssp/audioldm2',
    url: 'https://hf.co/cvssp/audioldm2',
    license: 'cc-by-nc-sa-4.0',
    allowedUse: 'reference-only unless separate commercial rights are obtained',
    bestFor: 'SFX sketches, transition textures, gravity pressure, one-shot variations',
  },
  {
    id: 'audioldm2-music',
    model: 'cvssp/audioldm2-music',
    url: 'https://hf.co/cvssp/audioldm2-music',
    license: 'cc-by-nc-sa-4.0',
    allowedUse: 'reference-only unless separate commercial rights are obtained',
    bestFor: 'longer music mood studies and Heat Death texture studies',
  },
];

const epochStyle = {
  Inflationary: 'violent spacetime expansion, fast pressure pulses, unstable low-end surges, no heroic melody',
  'Quark Plasma': 'granular heat, charged collisions, dense but readable transient motion',
  Recombination: 'fog clearing into open stereo space, calmer harmonic bloom, less density',
  'First Stars': 'blue-hot ignition, bright reward shimmer over restrained danger',
  Galactic: 'confident curved racing line, magnetic sweep, forward momentum',
  Stellar: 'main high-speed racing identity, clean pulse, readable bass, motion and danger stems',
  Degenerate: 'cooler heavy matter, rarer movement, weight without clutter',
  'Black Hole': 'sparse gravity pressure, long bends, near-silence around low-frequency mass',
  'Heat Death': 'authored absence, vanishing texture, sparse low tone, emotionally cold but intentional',
};

const stemStyle = {
  pulse: 'rhythmic propulsion stem with clear tempo and low transient clutter',
  texture: 'wide atmospheric layer with motion but no lead melody',
  motion: 'side-band movement stem that makes speed feel faster without masking SFX',
  reward: 'subtle lift layer that can bloom during clean driving',
  bass: 'controlled low stem with browser and laptop-speaker headroom',
  danger: 'thin tension stem that reads as risk without trailer-riser spam',
  'low-tone': 'minimal low tone with long decay, no ordinary race groove',
  'vanishing-texture': 'slowly disappearing high-air texture with silence as a feature',
};

const sfxStyle = {
  pickup: 'short luminous reward pickup, tiny pitch lift, clean transient, no arcade coin cliche',
  speedPad: 'instant acceleration shove, bright leading edge, low body, satisfying but not explosive',
  lineGate: 'precise racing-line confirmation tick, musical but very short, rewards clean driving',
  gateMiss: 'dry negative cue, quick downward bend, informative not punishingly loud',
  railScrape: 'energy rail friction scrape, tense stereo motion, non-fatiguing over repeats',
  wavelengthShift: 'spectral state change, gamma bright snap, visible balanced chime, radio warm drop',
  damageHit: 'clear impact with photon-energy loss, punchy and brief, no muddy explosion',
  death: 'absorption ending cue, authored failure, cosmic but not melodramatic',
  witnessChime: 'rare memory/witness chime, fragile and meaningful',
  hazardWhoosh: 'fast object pass-by, Doppler-like threat read, leaves room for steering cues',
  gravityWellWhoosh: 'massive curved gravity pass-by, low pressure plus bending air, spatially readable',
  engineLoop: 'continuous photon motion bed, loopable, subtle, no motor literalism',
  uiTick: 'small UI tick, clean synthetic click, soft enough for menus',
  uiClick: 'positive UI confirm, crisp and restrained',
  uiSwoosh: 'short panel transition sweep, no big trailer whoosh',
  epochRiser: 'epoch transition lift, cosmic scale, not EDM riser spam',
  memoryUnlock: 'meaningful unlock cue, warm but restrained',
};

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function kebab(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function promptBase() {
  return [
    'Photon is a browser cosmic racing game.',
    'The player is a photon racing from the Big Bang to Heat Death.',
    'Audio must make speed, route precision, danger, and cosmic time readable.',
    'Avoid generic synthwave, EDM drops, trailer riser spam, distorted clipping, and melodic clutter.',
    'Leave space for short SFX and laptop speakers.',
  ].join(' ');
}

function musicPrompt(epoch, stem, manifestEntry) {
  const duration = epoch === 'Heat Death' ? 60 : 45;
  return [
    promptBase(),
    `Create a ${duration}-second loopable ${stem} music stem for the ${epoch} epoch.`,
    `Epoch intent: ${manifestEntry.intent}`,
    `Epoch style: ${epochStyle[epoch] ?? 'cosmic racing identity'}.`,
    `Stem role: ${stemStyle[stem] ?? 'supporting interactive music stem'}.`,
    'Deliver a dry stem that can layer with other stems; no mastering limiter pumping.',
  ].join(' ');
}

function sfxPrompt(cue, variantIndex, variantCount) {
  const variation = variantCount > 1 ? `variation ${variantIndex + 1} of ${variantCount}` : 'single signature version';
  return [
    promptBase(),
    `Create a short game SFX cue for ${cue}, ${variation}.`,
    `Cue role: ${sfxStyle[cue] ?? 'readable gameplay cue'}.`,
    'Target short duration, clear attack, controlled tail, no clipping, no spoken voice, no copyrighted motif.',
  ].join(' ');
}

function buildMatrix(manifest) {
  const entries = [];
  for (const [epoch, entry] of Object.entries(manifest.music ?? {})) {
    if (entry.enabled === false) continue;
    for (const stem of entry.stems ?? []) {
      if (stem.enabled === false) continue;
      const modelLane = epoch === 'Heat Death' ? 'audioldm2-music' : 'musicgen-medium';
      entries.push({
        id: `music-${kebab(epoch)}-${kebab(stem.stem)}`,
        kind: 'music',
        cue: epoch,
        stem: stem.stem,
        targetPath: stem.path,
        durationSeconds: epoch === 'Heat Death' ? 60 : 45,
        loop: stem.loop !== false,
        modelLane,
        prompt: musicPrompt(epoch, stem.stem, entry),
        acceptance: [
          'exports as WAV master plus OGG runtime copy',
          'loop clicks are absent or documented',
          'does not mask speedPad, lineGate, gateMiss, railScrape, damageHit, or death',
          epoch === 'Heat Death' ? 'silence/restraint is intentional and authored' : 'speed feels stronger without clutter',
        ],
      });
    }
  }

  for (const [cue, entry] of Object.entries(manifest.sfx ?? {})) {
    if (entry.enabled === false) continue;
    const variants = entry.variants ?? [];
    variants.forEach((variant, index) => {
      if (variant.enabled === false) return;
      entries.push({
        id: `sfx-${kebab(cue)}-${String(index + 1).padStart(2, '0')}`,
        kind: 'sfx',
        cue,
        variant: index + 1,
        targetPath: variant.path,
        durationSeconds: variant.loop ? 6 : sfxDuration(cue),
        loop: variant.loop === true,
        modelLane: sfxModelLane(cue),
        prompt: sfxPrompt(cue, index, variants.length),
        acceptance: [
          'attack is readable during a fast run',
          'tail clears before common cue repetition becomes annoying',
          'peak headroom leaves room for music',
          'variant is recognizably same cue but not identical to siblings',
        ],
      });
    });
  }

  return entries;
}

function sfxDuration(cue) {
  if (cue === 'death') return 2.4;
  if (cue === 'epochRiser') return 3.5;
  if (cue === 'engineLoop') return 6;
  if (cue.includes('Whoosh')) return 1.1;
  if (cue === 'railScrape') return 0.65;
  return 0.45;
}

function sfxModelLane(cue) {
  if (cue === 'engineLoop' || cue === 'death' || cue === 'epochRiser' || cue === 'memoryUnlock') return 'audioldm2';
  if (cue.includes('Whoosh') || cue === 'railScrape' || cue === 'damageHit') return 'audioldm2';
  return 'audioldm2';
}

function findFiles(dir) {
  if (!dir || !existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...findFiles(path));
    else if (/\.(wav|ogg|mp3|flac)$/i.test(name)) out.push({ path, bytes: stat.size });
  }
  return out;
}

function probe(filePath) {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=sample_rate,channels',
    '-of', 'json',
    filePath,
  ], { encoding: 'utf8' });
  if (result.status !== 0) return { ok: false, error: (result.stderr || result.stdout).trim() };
  try {
    const parsed = JSON.parse(result.stdout);
    return {
      ok: true,
      durationSeconds: Number(parsed.format?.duration ?? 0),
      sampleRate: Number(parsed.streams?.[0]?.sample_rate ?? 0),
      channels: Number(parsed.streams?.[0]?.channels ?? 0),
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function inventoryCandidateRoot(candidateRoot, matrix) {
  const files = findFiles(candidateRoot);
  return files.map((file) => {
    const rel = relative(candidateRoot, file.path);
    const normalized = rel.toLowerCase();
    const exact = matrix.find((entry) => entry.targetPath.toLowerCase() === normalized);
    const guessed = exact ?? matrix.find((entry) => {
      const tokens = [
        entry.id,
        entry.targetPath,
      ].map((token) => kebab(token ?? '')).filter(Boolean);
      return tokens.some((token) => normalized.includes(token));
    });
    return {
      file: rel,
      bytes: file.bytes,
      probe: probe(file.path),
      guessedMatrixId: guessed?.id ?? null,
      guessedTargetPath: guessed?.targetPath ?? null,
      importStatus: 'candidate-only',
    };
  });
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeOutputs(matrix, inventory) {
  ensureDir(outDir);
  writeFileSync(join(outDir, 'prompt-matrix.json'), JSON.stringify({ modelLanes, matrix }, null, 2));
  writeFileSync(join(outDir, 'prompt-matrix.md'), matrixMarkdown(matrix));
  writeFileSync(join(outDir, 'license-ledger-template.csv'), licenseLedgerCsv(matrix));
  writeFileSync(join(outDir, 'import-plan.md'), importPlanMarkdown(matrix));
  if (inventory) {
    writeFileSync(join(outDir, 'candidate-inventory.json'), JSON.stringify(inventory, null, 2));
    writeFileSync(join(outDir, 'candidate-inventory.md'), inventoryMarkdown(inventory));
  }
}

function matrixMarkdown(matrix) {
  const music = matrix.filter((entry) => entry.kind === 'music');
  const sfx = matrix.filter((entry) => entry.kind === 'sfx');
  return [
    '# Photon HF Audio Candidate Prompt Matrix',
    '',
    'Generated by `node tools/audio_candidate_forge.mjs --write`.',
    '',
    'These prompts create reference candidates and briefing material. Do not promote any model output into runtime assets until the license ledger says commercial game, trailer, stream, storefront, and soundtrack use are cleared.',
    '',
    '## Model Lanes',
    '',
    '| Lane | Model | License | Use |',
    '|---|---|---|---|',
    ...modelLanes.map((lane) => `| ${lane.id} | [${lane.model}](${lane.url}) | ${lane.license} | ${lane.allowedUse} |`),
    '',
    '## Music',
    '',
    '| ID | Epoch | Stem | Target | Model Lane | Duration |',
    '|---|---|---|---|---|---:|',
    ...music.map((entry) => `| ${entry.id} | ${entry.cue} | ${entry.stem} | \`${entry.targetPath}\` | ${entry.modelLane} | ${entry.durationSeconds}s |`),
    '',
    '## SFX',
    '',
    '| ID | Cue | Variant | Target | Model Lane | Duration |',
    '|---|---|---:|---|---|---:|',
    ...sfx.map((entry) => `| ${entry.id} | ${entry.cue} | ${entry.variant} | \`${entry.targetPath}\` | ${entry.modelLane} | ${entry.durationSeconds}s |`),
    '',
    '## Prompt Details',
    '',
    ...matrix.flatMap((entry) => [
      `### ${entry.id}`,
      '',
      `Target: \`${entry.targetPath}\``,
      '',
      '```text',
      entry.prompt,
      '```',
      '',
    ]),
  ].join('\n');
}

function licenseLedgerCsv(matrix) {
  const header = [
    'matrix_id',
    'candidate_file',
    'model_or_source',
    'source_url',
    'license',
    'rights_holder',
    'allowed_game_runtime',
    'allowed_trailers_streams_storefront',
    'allowed_soundtrack_release',
    'content_id_risk',
    'approved_by',
    'approval_date',
    'notes',
  ].join(',');
  const rows = matrix.map((entry) => [
    entry.id,
    '',
    modelLanes.find((lane) => lane.id === entry.modelLane)?.model ?? entry.modelLane,
    modelLanes.find((lane) => lane.id === entry.modelLane)?.url ?? '',
    modelLanes.find((lane) => lane.id === entry.modelLane)?.license ?? '',
    '',
    'NO',
    'NO',
    'NO',
    'UNKNOWN',
    '',
    '',
    'Reference-only until cleared',
  ].map(csv).join(','));
  return [header, ...rows].join('\n') + '\n';
}

function csv(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function importPlanMarkdown(matrix) {
  return [
    '# Photon Audio Candidate Import Plan',
    '',
    '## Forge Commands',
    '',
    '```bash',
    'node tools/audio_candidate_forge.mjs --write',
    'node tools/audio_candidate_forge.mjs --write --candidate-root photon/output/audio-candidate-forge',
    '```',
    '',
    '## Generation Rule',
    '',
    'Generate candidates outside the runtime asset folders first. Recommended scratch root:',
    '',
    '```text',
    'photon/output/audio-candidate-forge/',
    '```',
    '',
    'Only copy a candidate into `photon/src/audio-assets/` after the license ledger is cleared and the cue is selected.',
    '',
    '## Runtime Promotion Gate',
    '',
    '1. Convert selected source masters to OGG runtime copies.',
    '2. Replace or add one cue group at a time in `photon/src/audio-assets/`.',
    '3. Update `photon/src/audio-manifest.json` only for cleared assets.',
    '4. Run `node tools/audit_audio_manifest.mjs`.',
    '5. Run `node tools/score_audio_engagement.mjs --write-report`.',
    '6. Run `node tools/playtest_audio_cdp.mjs` and do headphone/laptop listening.',
    '',
    '## Suggested First Music Batch',
    '',
    ...matrix
      .filter((entry) => entry.kind === 'music' && ['Stellar', 'Heat Death'].includes(entry.cue))
      .map((entry) => `- ${entry.id}: ${entry.prompt}`),
    '',
    '## Suggested First SFX Batch',
    '',
    ...matrix
      .filter((entry) => ['speedPad', 'lineGate', 'gateMiss', 'railScrape', 'gravityWellWhoosh'].includes(entry.cue))
      .slice(0, 24)
      .map((entry) => `- ${entry.id}: ${entry.prompt}`),
    '',
  ].join('\n');
}

function inventoryMarkdown(inventory) {
  return [
    '# Photon Audio Candidate Inventory',
    '',
    '| File | Duration | Channels | Guess | Import Status |',
    '|---|---:|---:|---|---|',
    ...inventory.map((item) => {
      const duration = item.probe.ok ? `${item.probe.durationSeconds.toFixed(2)}s` : 'probe failed';
      const channels = item.probe.ok ? item.probe.channels : '';
      const guess = item.guessedMatrixId ? `${item.guessedMatrixId} -> \`${item.guessedTargetPath}\`` : '';
      return `| \`${item.file}\` | ${duration} | ${channels} | ${guess} | ${item.importStatus} |`;
    }),
    '',
  ].join('\n');
}

const manifest = readManifest();
const matrix = buildMatrix(manifest);
const inventory = candidateRootArg ? inventoryCandidateRoot(resolve(candidateRootArg), matrix) : null;

if (write) writeOutputs(matrix, inventory);

if (asJson) {
  console.log(JSON.stringify({ outDir: relative(root, outDir), modelLanes, matrix, inventory }, null, 2));
} else {
  console.log(`Photon audio candidate forge: ${matrix.length} prompts (${matrix.filter((entry) => entry.kind === 'music').length} music, ${matrix.filter((entry) => entry.kind === 'sfx').length} sfx)`);
  if (write) console.log(`wrote ${relative(root, outDir)}`);
  if (inventory) console.log(`inventoried ${inventory.length} candidate files from ${candidateRootArg}`);
}
