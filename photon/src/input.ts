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
import { wavelengthIndexAt } from './hudLayout';
import { isBoostTouchPoint, isJoystickTouchPoint, isWavelengthTouchPoint, joystickTargetForClientPoint } from './touchControls';
import { requestLandscapeLock } from './orientation';

export const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  boost: false,
  touchTracking: false,
  touchTargetLateral: 0,
  touchTargetVertical: 0,
};

type DigitalInputKey = 'left' | 'right' | 'up' | 'down' | 'boost';
let steeringTouchId: number | null = null;

function updateJoystickVisual(target?: { normalizedX: number; normalizedY: number }) {
  const base = document.getElementById('mobile-joystick');
  const stick = base?.querySelector<HTMLElement>('.stick');
  if (!base || !stick) return;
  const active = !!target;
  base.classList.toggle('active', active);
  const x = active ? target!.normalizedX * 34 : 0;
  const y = active ? target!.normalizedY * 34 : 0;
  stick.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px)';
}

const keyMap: Record<string, DigitalInputKey> = {
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
  input.touchTracking = false;
  input.touchTargetLateral = 0;
  input.touchTargetVertical = 0;
  if (game.state !== 'run') {
    steeringTouchId = null;
    updateJoystickVisual();
    return;
  }
  let activeGameplayTouches = 0;
  let boostTouch = false;
  let trackingTouch: Touch | null = null;
  for (let i = 0; i < touches.length; i++) {
    const touch = touches[i];
    if (isWavelengthTouch(touch)) continue;
    activeGameplayTouches++;
    if (isBoostTouch(touch)) boostTouch = true;
    if (!isJoystickTouch(touch)) continue;
    if (touch.identifier === steeringTouchId) trackingTouch = touch;
    trackingTouch ??= touch;
  }
  if (trackingTouch) {
    steeringTouchId = trackingTouch.identifier;
    const target = joystickTargetForClientPoint(trackingTouch.clientX, trackingTouch.clientY, window.innerWidth, window.innerHeight);
    input.touchTracking = true;
    input.touchTargetLateral = target.lateral;
    input.touchTargetVertical = target.vertical;
    updateJoystickVisual(target);
  } else {
    steeringTouchId = null;
    updateJoystickVisual();
  }
  if (activeGameplayTouches >= 2 || boostTouch) input.boost = true;
}

function isWavelengthTouch(touch: Pick<Touch, 'clientX' | 'clientY'>) {
  return isWavelengthTouchPoint(touch.clientX, touch.clientY, window.innerWidth, window.innerHeight);
}

function isJoystickTouch(touch: Pick<Touch, 'clientX' | 'clientY'>) {
  return isJoystickTouchPoint(touch.clientX, touch.clientY, window.innerWidth, window.innerHeight);
}

function isBoostTouch(touch: Pick<Touch, 'clientX' | 'clientY'>) {
  return isBoostTouchPoint(touch.clientX, touch.clientY, window.innerWidth, window.innerHeight);
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
    requestLandscapeLock();
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
