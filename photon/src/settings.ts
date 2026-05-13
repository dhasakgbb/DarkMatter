import { SETTINGS_KEY } from './constants';
import { WAVELENGTHS } from './cosmology';
import { audio } from './audio';
import { game } from './state';
import * as scene from './scene';
import { readJsonStorage, writeStorage } from './storage';
import { defaultVisualQuality, normalizeVisualQuality, type VisualQuality } from './renderProfile';

export interface SettingsState {
  masterVol: number;
  muted: boolean;
  fov: number;
  sensitivity: number;
  highContrast: boolean;
  reducedMotion: boolean;
  visualQuality: VisualQuality;
}

export const defaultSettings = (): SettingsState => ({
  masterVol: 0.7,
  muted: false,
  fov: 78,
  sensitivity: 1.0,
  highContrast: false,
  reducedMotion: false,
  visualQuality: defaultVisualQuality(),
});

export function loadSettings(): SettingsState {
  const stored = readJsonStorage<Partial<SettingsState> & { scienceMode?: unknown }>(SETTINGS_KEY, {});
  delete stored.scienceMode;
  const loaded = Object.assign(defaultSettings(), stored);
  loaded.visualQuality = normalizeVisualQuality(loaded.visualQuality);
  return loaded;
}
export function saveSettings(s: SettingsState) {
  writeStorage(SETTINGS_KEY, JSON.stringify(s));
}

export const settings: SettingsState = loadSettings();

// Apply current settings to the engine + visuals. Called on boot, settings change, and each startRun.
export function applySettings() {
  if (audio.master) audio.master.gain.value = settings.muted ? 0 : settings.masterVol;
  scene.applyVisualQuality(settings.visualQuality);
  if (scene.camera) {
    scene.camera.fov = settings.fov;
    scene.camera.updateProjectionMatrix();
  }
  if (settings.highContrast) {
    WAVELENGTHS[0].color.setRGB(1.0, 0.0, 1.0); WAVELENGTHS[0].hex = 0xff00ff;
    WAVELENGTHS[1].color.setRGB(0.0, 1.0, 1.0); WAVELENGTHS[1].hex = 0x00ffff;
    WAVELENGTHS[2].color.setRGB(1.0, 0.7, 0.0); WAVELENGTHS[2].hex = 0xffb300;
  } else {
    WAVELENGTHS[0].color.setHex(0xb888ff); WAVELENGTHS[0].hex = 0xb888ff;
    WAVELENGTHS[1].color.setHex(0xffffff); WAVELENGTHS[1].hex = 0xffffff;
    WAVELENGTHS[2].color.setHex(0xff5566); WAVELENGTHS[2].hex = 0xff5566;
  }
  game.reducedMotion = settings.reducedMotion;
  game.scienceMode = true;
}
