export const WAVELENGTH_SEGMENT_WIDTH = 110;
export const WAVELENGTH_SEGMENT_HEIGHT = 22;
export const WAVELENGTH_SEGMENT_GAP = 6;
export const WAVELENGTH_TOUCH_BAND_HEIGHT = 58;

export function wavelengthTotalWidth() {
  return WAVELENGTH_SEGMENT_WIDTH * 3 + WAVELENGTH_SEGMENT_GAP * 2;
}

export function wavelengthStartX(viewportWidth: number) {
  return (viewportWidth - wavelengthTotalWidth()) / 2;
}

export function isWavelengthTouchY(clientY: number, viewportHeight: number) {
  return clientY >= viewportHeight - WAVELENGTH_TOUCH_BAND_HEIGHT;
}

export function wavelengthIndexAt(clientX: number, viewportWidth: number) {
  const localX = clientX - wavelengthStartX(viewportWidth);
  if (localX < 0 || localX > wavelengthTotalWidth()) return null;
  const slotWidth = WAVELENGTH_SEGMENT_WIDTH + WAVELENGTH_SEGMENT_GAP;
  if (localX % slotWidth > WAVELENGTH_SEGMENT_WIDTH) return null;
  const idx = Math.floor(localX / slotWidth);
  return idx >= 0 && idx <= 2 ? idx : null;
}
