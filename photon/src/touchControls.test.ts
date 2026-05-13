import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadTouchControls() {
  vi.stubGlobal('navigator', { userAgent: 'iPhone' });
  vi.stubGlobal('window', { innerWidth: 812, innerHeight: 375, devicePixelRatio: 2, ontouchstart: null });
  return import('./touchControls');
}

describe('mobile touch controls', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('maps the gameplay thumb area to centered playfield targets', async () => {
    const { touchTargetForClientPoint } = await loadTouchControls();
    const target = touchTargetForClientPoint(406, 158.5, 812, 375);

    expect(target.lateral).toBeCloseTo(0, 5);
    expect(target.vertical).toBeCloseTo(0, 5);
  });

  it('clamps thumb targets inside the playable field', async () => {
    const { touchTargetForClientPoint } = await loadTouchControls();
    const topLeft = touchTargetForClientPoint(-80, -40, 812, 375);
    const bottomRight = touchTargetForClientPoint(900, 420, 812, 375);

    expect(topLeft.lateral).toBeCloseTo(-33.12, 2);
    expect(topLeft.vertical).toBeCloseTo(21.12, 2);
    expect(bottomRight.lateral).toBeCloseTo(33.12, 2);
    expect(bottomRight.vertical).toBeCloseTo(-21.12, 2);
  });

  it('keeps only actual wavelength buttons out of gameplay tracking', async () => {
    const { isWavelengthTouchPoint } = await loadTouchControls();

    expect(isWavelengthTouchPoint(406, 352, 812, 375)).toBe(true);
    expect(isWavelengthTouchPoint(32, 352, 812, 375)).toBe(false);
    expect(isWavelengthTouchPoint(348, 352, 812, 375)).toBe(false);
  });

  it('places the virtual joystick in the lower-left play area', async () => {
    const { isJoystickTouchPoint, joystickGeometry } = await loadTouchControls();
    const joystick = joystickGeometry(812, 375);

    expect(joystick.centerX).toBeCloseTo(76, 2);
    expect(joystick.centerY).toBeCloseTo(301, 2);
    expect(isJoystickTouchPoint(joystick.centerX, joystick.centerY, 812, 375)).toBe(true);
    expect(isJoystickTouchPoint(406, 352, 812, 375)).toBe(false);
  });

  it('maps joystick deflection to clamped analog steering targets', async () => {
    const { joystickGeometry, joystickTargetForClientPoint } = await loadTouchControls();
    const joystick = joystickGeometry(812, 375);
    const centered = joystickTargetForClientPoint(joystick.centerX, joystick.centerY, 812, 375);
    const upRight = joystickTargetForClientPoint(joystick.centerX + joystick.radius, joystick.centerY - joystick.radius, 812, 375);
    const farDownLeft = joystickTargetForClientPoint(joystick.centerX - joystick.radius * 3, joystick.centerY + joystick.radius * 3, 812, 375);

    expect(centered.lateral).toBeCloseTo(0, 5);
    expect(centered.vertical).toBeCloseTo(0, 5);
    expect(upRight.normalizedX).toBeCloseTo(Math.SQRT1_2, 5);
    expect(upRight.normalizedY).toBeCloseTo(-Math.SQRT1_2, 5);
    expect(upRight.lateral).toBeGreaterThan(0);
    expect(upRight.vertical).toBeGreaterThan(0);
    expect(farDownLeft.normalizedX).toBeCloseTo(-Math.SQRT1_2, 5);
    expect(farDownLeft.normalizedY).toBeCloseTo(Math.SQRT1_2, 5);
  });
});
