import { game } from './state';
import { canvas } from './scene';
import { photon } from './photon';
import { settings, applySettings, saveSettings } from './settings';
import { meta, saveMeta } from './meta';
import { checkMemoryTriggers } from './memories';
import { showToast } from './utils';
import { startRun, pause, resume } from './game';
import { endWitness } from './witness';
import { refreshSettingsUI } from './ui';
import { isWavelengthTouchY, wavelengthIndexAt } from './hudLayout';

export const input = { left: false, right: false, up: false, down: false, boost: false };

const keyMap: Record<string, keyof typeof input> = {
  KeyA: 'left',  ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up',    ArrowUp: 'up',
  KeyS: 'down',  ArrowDown: 'down',
  Space: 'boost', ShiftLeft: 'boost', ShiftRight: 'boost',
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    return;
  }
  const target = document.getElementById('stage') || canvas;
  target.requestFullscreen().catch(() => {});
}

function applyTouchInput(touches: TouchList) {
  input.left = input.right = input.up = input.down = input.boost = false;
  if (game.state !== 'run') return;
  let activeGameplayTouches = 0;
  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    const x = t.clientX / window.innerWidth;
    const y = t.clientY / window.innerHeight;
    if (isWavelengthTouch(t)) continue;
    activeGameplayTouches++;
    if (x < 0.33) input.left = true;
    else if (x > 0.66) input.right = true;
    if (y < 0.4) input.up = true;
    else if (y > 0.7) input.down = true;
  }
  if (activeGameplayTouches >= 2) input.boost = true;
}

function isWavelengthTouch(touch: Pick<Touch, 'clientX' | 'clientY'>) {
  return isWavelengthTouchY(touch.clientY, window.innerHeight);
}

function handleWavelengthTouch(touches: TouchList) {
  if (game.state !== 'run') return false;
  let did = false;
  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    if (!isWavelengthTouch(t)) continue;
    const idx = wavelengthIndexAt(t.clientX, window.innerWidth);
    if (idx != null && photon.shift(idx)) {
      game._shiftedThisRun = true;
      did = true;
    }
  }
  return did;
}

export function bindInput() {
  window.addEventListener('keydown', e => {
    if (isEditableTarget(e.target)) return;
    const k = keyMap[e.code];
    if (k) { input[k] = true; e.preventDefault(); }
    if (e.code === 'KeyF') {
      toggleFullscreen();
      e.preventDefault();
    }
    if (game.state === 'run') {
      let did = false;
      if (e.code === 'Digit1') did = photon.shift(0);
      if (e.code === 'Digit2') did = photon.shift(1);
      if (e.code === 'Digit3') did = photon.shift(2);
      if (did) game._shiftedThisRun = true;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (game.state === 'run')   { pause(); e.preventDefault(); }
      else if (game.state === 'pause') { resume(); e.preventDefault(); }
    }
    if (e.code === 'KeyM') {
      settings.muted = !settings.muted;
      applySettings(); saveSettings(settings);
      if (game.state === 'pause') refreshSettingsUI();
      showToast(settings.muted ? '◇ Muted' : '◇ Unmuted');
      if (settings.muted && !meta.mutedOnce) { meta.mutedOnce = true; saveMeta(meta); checkMemoryTriggers(); }
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (game.state === 'title') startRun();
      else if (game.state === 'death') startRun();
    }
    if (game.witnessing && document.getElementById('witness-hint')!.classList.contains('show')) {
      endWitness();
    }
  });
  window.addEventListener('keyup', e => {
    if (isEditableTarget(e.target)) return;
    const k = keyMap[e.code];
    if (k) { input[k] = false; e.preventDefault(); }
  });

  canvas.addEventListener('touchstart', (e: TouchEvent) => {
    e.preventDefault();
    handleWavelengthTouch(e.changedTouches);
    applyTouchInput(e.touches);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e: TouchEvent) => {
    e.preventDefault();
    applyTouchInput(e.touches);
  }, { passive: false });
  canvas.addEventListener('touchend', (e: TouchEvent) => {
    e.preventDefault();
    applyTouchInput(e.touches);
  }, { passive: false });
  canvas.addEventListener('touchcancel', (e: TouchEvent) => {
    e.preventDefault();
    applyTouchInput(e.touches);
  }, { passive: false });
}
