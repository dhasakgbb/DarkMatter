#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const batch = process.argv.includes('--batch')
  ? process.argv[process.argv.indexOf('--batch') + 1]
  : 'gemini-lyria-001';
const apiKey = process.env.GEMINI_API_KEY;
const outRoot = join(root, 'photon', 'output', 'audio-candidate-forge', batch);
const runtimeRoot = join(outRoot, 'runtime');
const sourceRoot = join(outRoot, 'sources');
const docsRoot = join(root, 'docs', 'evidence', 'audio-candidate-forge');

if (!apiKey) {
  console.error('GEMINI_API_KEY is required.');
  process.exit(1);
}

const candidates = [
  {
    id: 'music-stellar-main-lyria',
    targetPath: 'music/stellar/main-lyria.mp3',
    runtimePath: 'music/stellar/main-lyria.ogg',
    model: 'lyria-3-clip-preview',
    prompt: [
      'Create a 30-second instrumental-only game soundtrack clip for Photon, a high-speed cosmic racing game.',
      'High-end, dark, expensive, futuristic, clean, anti-corny.',
      'The player is a photon racing through deep space from the Big Bang toward heat death.',
      'Style: precision sci-fi racing, tight sub pulse, metallic transient rhythm, glassy spatial motion, restrained harmony, dangerous momentum.',
      'Avoid synthwave nostalgia, retro arcade sounds, happy melodies, heroic fanfare, EDM drops, vocals, lyrics, distorted harsh treble, and cheesy trailer risers.',
      'Mix target: polished AAA game soundtrack, fast but spacious, leaves room for gameplay SFX.',
      'Instrumental only, no vocals.',
    ].join(' '),
  },
  {
    id: 'music-heat-death-lyria',
    targetPath: 'music/heat-death/ending-lyria.mp3',
    runtimePath: 'music/heat-death/ending-lyria.ogg',
    model: 'lyria-3-clip-preview',
    prompt: [
      'Create a 30-second instrumental-only ambient ending cue for Photon, a cosmic racing game reaching heat death.',
      'High-end sparse sound design, vast cold space, fading energy, fragile low tone, vanishing high air, almost no rhythm.',
      'It should feel authored and emotionally difficult, not empty by accident.',
      'Avoid melody, vocals, lyrics, synthwave, horror stingers, cheesy sadness, orchestral melodrama, and harsh treble.',
      'Mix target: premium cinematic game ending texture with silence and restraint.',
      'Instrumental only, no vocals.',
    ].join(' '),
  },
  {
    id: 'sfx-gravity-well-passby-lyria',
    targetPath: 'sfx/gravity-well-whoosh/gravity-well-passby-lyria.mp3',
    runtimePath: 'sfx/gravity-well-whoosh/gravity-well-passby-lyria.ogg',
    model: 'lyria-3-clip-preview',
    prompt: [
      'Create a 30-second instrumental-only non-melodic sound design study for a game SFX cue.',
      'Subject: massive gravity well pass-by at extreme speed.',
      'Use deep pressure waves, clean Doppler bends, sub impacts, polished sci-fi air movement, and short separated pass-by events.',
      'No beat, no melody, no vocals, no lyrics, no retro arcade, no siren, no alarm, no harsh piercing treble, no clipping.',
      'This is source material for extracting short playable gravity whoosh sound effects, not a song.',
      'Instrumental only, no vocals.',
    ].join(' '),
  },
  {
    id: 'sfx-speed-gate-source-lyria',
    targetPath: 'sfx/source/speed-gate-source-lyria.mp3',
    runtimePath: 'sfx/source/speed-gate-source-lyria.ogg',
    model: 'lyria-3-clip-preview',
    prompt: [
      'Create a 30-second instrumental-only non-melodic game sound design source track.',
      'Subject: clean futuristic racing confirmations, speed-pad accelerations, line-gate hits, and missed-gate negative cues.',
      'Use crisp polished transients, short bright confirmations, controlled low acceleration shoves, and dry negative bends.',
      'Leave silence between events so short SFX can be cut out.',
      'No melody, no vocals, no lyrics, no retro arcade beeps, no chiptune, no harsh piercing treble, no clipping, no comedy.',
      'Instrumental only, no vocals.',
    ].join(' '),
  },
];

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function extractParts(response) {
  const parts = [];
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) parts.push(part);
  }
  return parts;
}

function writeAudio(candidate, part) {
  const data = part.inlineData?.data ?? part.inline_data?.data;
  const mime = part.inlineData?.mimeType ?? part.inline_data?.mime_type ?? 'audio/mp3';
  if (!data) return null;
  const ext = mime.includes('wav') ? 'wav' : 'mp3';
  const sourcePath = join(sourceRoot, `${candidate.id}.${ext}`);
  ensureDir(dirname(sourcePath));
  writeFileSync(sourcePath, Buffer.from(data, 'base64'));
  return { sourcePath, mime };
}

function convertToOgg(sourcePath, runtimePath) {
  const absoluteRuntimePath = join(runtimeRoot, runtimePath);
  ensureDir(dirname(absoluteRuntimePath));
  const result = spawnSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    sourcePath,
    '-ac',
    '2',
    '-c:a',
    'vorbis',
    '-strict',
    '-2',
    '-q:a',
    '7',
    absoluteRuntimePath,
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `ffmpeg failed for ${sourcePath}`);
  }
  return absoluteRuntimePath;
}

function probe(path) {
  const result = spawnSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'stream=channels:format=duration',
    '-of',
    'json',
    path,
  ], { encoding: 'utf8' });
  if (result.status !== 0) return { ok: false, error: result.stderr.trim() };
  const parsed = JSON.parse(result.stdout);
  return {
    ok: true,
    durationSeconds: Number(parsed.format?.duration ?? 0),
    channels: Number(parsed.streams?.[0]?.channels ?? 0),
  };
}

async function generate(candidate) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: candidate.prompt }],
        }],
      }),
    },
  );
  const json = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(json));
  }

  const text = [];
  let audio = null;
  for (const part of extractParts(json)) {
    if (part.text) text.push(part.text);
    if (!audio) audio = writeAudio(candidate, part);
  }
  if (!audio) throw new Error(`No audio returned for ${candidate.id}`);

  const runtimePath = convertToOgg(audio.sourcePath, candidate.runtimePath);
  const runtimeProbe = probe(runtimePath);
  const meta = {
    schema: 'photon-audio-candidate.v1',
    batch,
    id: candidate.id,
    targetPath: candidate.targetPath,
    runtimePath: relative(root, runtimePath),
    sourcePath: relative(root, audio.sourcePath),
    model: candidate.model,
    source: 'google-gemini-lyria',
    licenseTag: 'gemini-api-generated-candidate-review-required',
    reviewStatus: 'candidate-only',
    prompt: candidate.prompt,
    generatedText: text,
    probe: runtimeProbe,
  };
  writeFileSync(join(dirname(runtimePath), `${basename(runtimePath, '.ogg')}.meta.json`), JSON.stringify(meta, null, 2));
  return meta;
}

function writeListenHtml(items) {
  const rows = items.map((item) => {
    const rel = relative(outRoot, join(root, item.runtimePath)).replaceAll('\\', '/');
    return `<tr><td><code>${item.id}</code></td><td><code>${item.targetPath}</code></td><td>${item.probe.durationSeconds.toFixed(2)}s</td><td><audio controls preload="none" src="${rel}"></audio></td></tr>`;
  }).join('\n');
  writeFileSync(join(outRoot, 'listen.html'), [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><title>Photon Gemini Audio Candidates</title>',
    '<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:24px;background:#08090d;color:#f3f4f6}td,th{border-bottom:1px solid #293042;padding:10px;text-align:left}audio{width:360px}code{color:#a7f3d0}</style></head>',
    '<body><h1>Photon Gemini Audio Candidates</h1>',
    '<p>Candidate-only. Generated with Gemini/Lyria; review license and listening quality before runtime promotion.</p>',
    '<table><thead><tr><th>ID</th><th>Target</th><th>Duration</th><th>Listen</th></tr></thead><tbody>',
    rows,
    '</tbody></table></body></html>',
  ].join('\n'));
}

function cleanOldLocalPacks() {
  for (const name of ['local-forge-001', 'hf-forge-001']) {
    const path = join(root, 'photon', 'output', 'audio-candidate-forge', name);
    rmSync(path, { recursive: true, force: true });
  }
}

ensureDir(runtimeRoot);
ensureDir(sourceRoot);
ensureDir(docsRoot);
if (process.argv.includes('--clean-old')) cleanOldLocalPacks();

const results = [];
for (const candidate of candidates) {
  console.log(`Generating ${candidate.id}...`);
  results.push(await generate(candidate));
}

writeListenHtml(results);
writeFileSync(join(outRoot, 'summary.json'), JSON.stringify({ batch, count: results.length, results }, null, 2));
writeFileSync(join(docsRoot, 'gemini-candidate-summary.json'), JSON.stringify({ batch, count: results.length, results }, null, 2));
writeFileSync(join(docsRoot, 'gemini-candidate-summary.md'), [
  '# Photon Gemini Audio Candidate Summary',
  '',
  `Batch: \`${batch}\``,
  '',
  `Listening board: \`${relative(root, join(outRoot, 'listen.html'))}\``,
  '',
  '| ID | Target | Duration | Status |',
  '|---|---|---:|---|',
  ...results.map((item) => `| ${item.id} | \`${item.targetPath}\` | ${item.probe.durationSeconds.toFixed(2)}s | ${item.reviewStatus} |`),
  '',
].join('\n'));

console.log(JSON.stringify({ batch, count: results.length, listen: relative(root, join(outRoot, 'listen.html')) }, null, 2));
