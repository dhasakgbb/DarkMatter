import { PLAYFIELD_HALF_HEIGHT, PLAYFIELD_HALF_WIDTH } from './constants';
import { isWavelengthTouchY, wavelengthIndexAt, WAVELENGTH_TOUCH_BAND_HEIGHT } from './hudLayout';

const TOUCH_CONTROL_HORIZONTAL_INSET = 18;
const TOUCH_CONTROL_TOP_INSET = 8;
const TOUCH_CONTROL_BOTTOM_INSET = WAVELENGTH_TOUCH_BAND_HEIGHT + 8;
const TOUCH_TARGET_LATERAL_RANGE = PLAYFIELD_HALF_WIDTH * 0.92;
const TOUCH_TARGET_VERTICAL_RANGE = PLAYFIELD_HALF_HEIGHT * 0.88;

export interface TouchTarget {
  lateral: number;
  vertical: number;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function isWavelengthTouchPoint(clientX: number, clientY: number, viewportWidth: number, viewportHeight: number) {
  return isWavelengthTouchY(clientY, viewportHeight) && wavelengthIndexAt(clientX, viewportWidth) != null;
}

export function touchTargetForClientPoint(clientX: number, clientY: number, viewportWidth: number, viewportHeight: number): TouchTarget {
  const usableWidth = Math.max(1, viewportWidth - TOUCH_CONTROL_HORIZONTAL_INSET * 2);
  const usableHeight = Math.max(1, viewportHeight - TOUCH_CONTROL_TOP_INSET - TOUCH_CONTROL_BOTTOM_INSET);
  const normalizedX = clamp01((clientX - TOUCH_CONTROL_HORIZONTAL_INSET) / usableWidth);
  const normalizedY = clamp01((clientY - TOUCH_CONTROL_TOP_INSET) / usableHeight);

  return {
    lateral: (normalizedX * 2 - 1) * TOUCH_TARGET_LATERAL_RANGE,
    vertical: (1 - normalizedY * 2) * TOUCH_TARGET_VERTICAL_RANGE,
  };
}
