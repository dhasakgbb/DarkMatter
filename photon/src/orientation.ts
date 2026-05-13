import { IS_MOBILE } from './constants';

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
};

function isPortraitViewport() {
  return window.innerHeight > window.innerWidth;
}

function refreshOrientationOverlay() {
  document.documentElement.classList.toggle('needs-landscape', IS_MOBILE && isPortraitViewport());
}

export function requestLandscapeLock() {
  if (!IS_MOBILE || !screen.orientation) return;
  const orientation = screen.orientation as LockableScreenOrientation;
  void orientation.lock?.('landscape').catch(() => {});
}

export function bindOrientationPreference() {
  refreshOrientationOverlay();
  window.addEventListener('resize', refreshOrientationOverlay);
  screen.orientation?.addEventListener('change', refreshOrientationOverlay);

  const options: AddEventListenerOptions = { capture: true, passive: true };
  document.addEventListener('pointerdown', requestLandscapeLock, options);
  document.addEventListener('touchstart', requestLandscapeLock, options);
}
