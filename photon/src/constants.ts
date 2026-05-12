// Hardware/render constants
export const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 900);
export const PIXEL_RATIO = Math.min(IS_MOBILE ? 1.5 : 2.0, window.devicePixelRatio || 1);

// Track geometry
export const TUBE_RADIUS = 22;
export const GUIDE_ARC_RADIUS = 31;
export const PLAYFIELD_HALF_WIDTH = 36;
export const PLAYFIELD_HALF_HEIGHT = 24;
export const EDGE_STRAIN_START = 0.82;
export const SEGMENT_LEN = 6;
export const SEGMENTS_AHEAD = 80;
export const SEGMENTS_BEHIND = 8;
export const RING_SPACING = 22;

// Photon physics
export const BASE_SPEED = 60;
export const BOOST_MUL = 2.1;
export const BOOST_DRAIN = 28;
export const BOOST_RECHARGE = 14;
export const BOOST_MAX = 100;
export const ENERGY_MAX = 100;

// Storage keys
export const META_KEY = 'photon-meta-v1';
export const RUN_KEY = 'photon-run-v1';
export const SETTINGS_KEY = 'photon-settings-v1';
