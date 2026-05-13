#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const photonDir = join(root, 'photon');
const outDir = join(root, '.playtest');
const vitePort = Number(process.env.PHOTON_PLAYTEST_PORT || 5178);
const chromePort = Number(process.env.PHOTON_CHROME_PORT || 9337);
const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function waitFor(url, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // keep polling
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result || {});
    } else if (msg.method) {
      events.push(msg);
    }
  });

  const send = (method, params = {}) => {
    const msgId = ++id;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
  };

  return { ws, send, events };
}

async function evaluate(send, expression, awaitPromise = true) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function capture(send, filename) {
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const path = join(outDir, filename);
  await writeFile(path, Buffer.from(shot.data, 'base64'));
  return path;
}

async function click(send, x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function key(send, type, key, code = key) {
  await send('Input.dispatchKeyEvent', {
    type,
    key,
    code,
    windowsVirtualKeyCode: key === ' ' ? 32 : key.toUpperCase().charCodeAt(0),
  });
}

async function drive(send, ms) {
  const end = Date.now() + ms;
  await key(send, 'keyDown', ' ', 'Space');
  let flip = false;
  while (Date.now() < end) {
    const down = flip ? 'KeyA' : 'KeyD';
    const up = flip ? 'KeyD' : 'KeyA';
    await key(send, 'keyUp', flip ? 'd' : 'a', up);
    await key(send, 'keyDown', flip ? 'a' : 'd', down);
    await delay(550);
    flip = !flip;
  }
  await key(send, 'keyUp', 'a', 'KeyA');
  await key(send, 'keyUp', 'd', 'KeyD');
  await key(send, 'keyUp', ' ', 'Space');
}

function summarizeTrace(trace) {
  const byCue = {};
  const bySource = {};
  for (const entry of trace) {
    byCue[entry.cue] = (byCue[entry.cue] || 0) + 1;
    bySource[entry.source] = (bySource[entry.source] || 0) + 1;
  }
  return { total: trace.length, byCue, bySource, first: trace.slice(0, 8), last: trace.slice(-8) };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const profile = await mkdtemp(join(tmpdir(), 'photon-chrome-'));
  const vite = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(vitePort)], {
    cwd: photonDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const chrome = spawn(chromeBin, [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${chromePort}`,
    '--window-size=1280,720',
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  try {
    await waitFor(`http://127.0.0.1:${vitePort}/`);
    await waitFor(`http://127.0.0.1:${chromePort}/json/version`);
    const tab = await getJson(`http://127.0.0.1:${chromePort}/json/new?http://127.0.0.1:${vitePort}/`, { method: 'PUT' });
    const { send, ws, events } = await connectCdp(tab.webSocketDebuggerUrl);

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Input.setIgnoreInputEvents', { ignore: false });
    await delay(1600);
    const titleShot = await capture(send, 'audio-title.png');

    const btn = await evaluate(send, `(() => {
      const r = document.getElementById('btn-start').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await click(send, btn.x, btn.y);
    await delay(1200);
    const stateAfterClick = await evaluate(send, `import('/src/state.ts').then(({ game }) => game.state)`);
    if (stateAfterClick !== 'run') {
      await evaluate(send, `import('/src/game.ts').then(m => { m.startRun(); return true; })`);
      await delay(800);
    }
    await drive(send, 9000);
    const runShot = await capture(send, 'audio-run.png');

    await evaluate(send, `window.__PHOTON_AUDIO_TRACE = window.__PHOTON_AUDIO_TRACE || []`);
    await evaluate(send, `import('/src/game.ts').then(m => { m.setEpoch(5); return true; })`);
    await delay(1200);
    const directCueResult = await evaluate(send, `import('/src/audio.ts').then(({ audio }) => {
      audio.stopEngine();
      audio.startEngine();
      audio.uiClick();
      audio.uiSwoosh();
      audio.pickup();
      audio.speedPad();
      audio.lineGate(1);
      audio.lineGate(6);
      audio.gateMiss();
      audio.railScrape();
      audio.shift(0);
      audio.shift(1);
      audio.shift(2);
      audio.hit();
      audio.death();
      audio.witnessChime();
      audio.epochRiser();
      audio.whoosh({ x: 0, y: 0, z: -20 }, 0.75, 'generic');
      audio.whoosh({ x: 4, y: 0, z: -18 }, 0.75, 'well');
      return {
        hasContext: !!audio.ctx,
        sfxBuffers: audio.sfxBuffers ? audio.sfxBuffers.size : -1,
        musicBuffers: audio.musicBuffers ? audio.musicBuffers.size : -1,
        traceLength: (window.__PHOTON_AUDIO_TRACE || []).length,
      };
    })`);
    await delay(2200);

    const data = await evaluate(send, `Promise.all([
      import('/src/state.ts').then(({ game }) => game.state).catch(() => 'unknown'),
      import('/src/audio.ts').then(({ audio }) => ({
        hasContext: !!audio.ctx,
        contextState: audio.ctx ? audio.ctx.state : 'none',
        sfxBuffers: audio.sfxBuffers ? audio.sfxBuffers.size : -1,
        musicBuffers: audio.musicBuffers ? audio.musicBuffers.size : -1,
      })).catch((err) => ({ error: String(err) })),
    ]).then(([gameState, audioState]) => ({
      gameState,
      visibleLayer: document.querySelector('#ui .layer.on')?.id || 'run-or-none',
      trace: window.__PHOTON_AUDIO_TRACE || [],
      audioState: window.AudioContext ? 'AudioContext present' : 'no AudioContext',
      audioModule: audioState,
      title: document.title,
      errors: [],
    }))`);
    const report = {
      url: `http://127.0.0.1:${vitePort}/`,
      screenshots: { title: titleShot, run: runShot },
      traceSummary: summarizeTrace(data.trace),
      pageState: data.visibleLayer,
      gameState: data.gameState,
      audioState: data.audioState,
      audioModule: data.audioModule,
      directCueResult,
      cdpEvents: events.filter((e) => e.method === 'Log.entryAdded' || e.method === 'Runtime.exceptionThrown').slice(-20),
    };
    const reportPath = join(outDir, 'audio-playtest-report.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    ws.close();
  } finally {
    vite.kill('SIGTERM');
    chrome.kill('SIGTERM');
    await delay(500);
    await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 }).catch(() => {});
  }
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
