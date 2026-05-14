import { PLAYFIELD_HALF_HEIGHT, PLAYFIELD_HALF_WIDTH } from './constants';
import { isWavelengthTouchY, wavelengthIndexAt, WAVELENGTH_TOUCH_BAND_HEIGHT } from './hudLayout';

const TOUCH_CONTROL_HORIZONTAL_INSET = 18;
const TOUCH_CONTROL_TOP_INSET = 8;
const TOUCH_CONTROL_BOTTOM_INSET = WAVELENGTH_TOUCH_BAND_HEIGHT + 8;
const TOUCH_TARGET_LATERAL_RANGE = PLAYFIELD_HALF_WIDTH * 0.92;
const TOUCH_TARGET_VERTICAL_RANGE = PLAYFIELD_HALF_HEIGHT * 0.88;
const JOYSTICK_RADIUS = 56;
const JOYSTICK_HIT_RADIUS = 92;
const JOYSTICK_LEFT_INSET = 20;
const JOYSTICK_BOTTOM_INSET = 18;
const JOYSTICK_LATERAL_RANGE = PLAYFIELD_HALF_WIDTH * 0.78;
const JOYSTICK_VERTICAL_RANGE = PLAYFIELD_HALF_HEIGHT * 0.72;
const BOOST_ZONE_LEFT_RATIO = 0.58;
const BOOST_ZONE_TOP_INSET = 14;

export interface TouchTarget {
  lateral: number;
  vertical: number;
}

export interface JoystickTarget extends TouchTarget {
  normalizedX: number;
  normalizedY: number;
}

export interface JoystickGeometry {
  centerX: number;
  centerY: number;
  radius: number;
  hitRadius: number;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function clampVectorToUnit(x: number, y: number) {
  const length = Math.hypot(x, y);
  if (length <= 1 || length === 0) return { x, y };
  return { x: x / length, y: y / length };
}

export function joystickGeometry(viewportWidth: number, viewportHeight: number): JoystickGeometry {
  return {
    centerX: Math.min(viewportWidth - JOYSTICK_RADIUS - 12, JOYSTICK_LEFT_INSET + JOYSTICK_RADIUS),
    centerY: Math.max(JOYSTICK_RADIUS + 12, viewportHeight - JOYSTICK_BOTTOM_INSET - JOYSTICK_RADIUS),
    radius: JOYSTICK_RADIUS,
    hitRadius: JOYSTICK_HIT_RADIUS,
  };
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

export function isJoystickTouchPoint(clientX: number, clientY: number, viewportWidth: number, viewportHeight: number) {
  const joystick = joystickGeometry(viewportWidth, viewportHeight);
  return Math.hypot(clientX - joystick.centerX, clientY - joystick.centerY) <= joystick.hitRadius;
}

export function isBoostTouchPoint(clientX: number, clientY: number, viewportWidth: number, viewportHeight: number) {
  if (isWavelengthTouchPoint(clientX, clientY, viewportWidth, viewportHeight)) return false;
  if (isJoystickTouchPoint(clientX, clientY, viewportWidth, viewportHeight)) return false;
  if (clientY < BOOST_ZONE_TOP_INSET || clientY > viewportHeight - TOUCH_CONTROL_BOTTOM_INSET) return false;
  return clientX >= viewportWidth * BOOST_ZONE_LEFT_RATIO;
}

export function joystickTargetForClientPoint(clientX: number, clientY: number, viewportWidth: number, viewportHeight: number): JoystickTarget {
  const joystick = joystickGeometry(viewportWidth, viewportHeight);
  const rawX = clampUnit((clientX - joystick.centerX) / joystick.radius);
  const rawY = clampUnit((clientY - joystick.centerY) / joystick.radius);
  const normalized = clampVectorToUnit(rawX, rawY);
  return {
    normalizedX: normalized.x,
    normalizedY: normalized.y,
    lateral: normalized.x * JOYSTICK_LATERAL_RANGE,
    vertical: -normalized.y * JOYSTICK_VERTICAL_RANGE,
  };
}
