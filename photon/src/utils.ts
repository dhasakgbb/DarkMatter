import { EPOCHS } from './cosmology';
import { game } from './state';

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export function superscript(n: number | string): string {
  return String(n).split('').map(c => SUP[c] || c).join('');
}

// Phase-streak combo multiplier — energy collected scales by this value.
export function comboMultiplier(streak: number): number {
  if (streak >= 12) return 5;
  if (streak >= 8)  return 4;
  if (streak >= 5)  return 3;
  if (streak >= 3)  return 2.5;
  if (streak >= 2)  return 2;
  if (streak >= 1)  return 1.5;
  return 1;
}

// Non-linear mapping of (epoch, epochTimer) to a cosmological timestamp string.
export function cosmicTimeLabel(): string {
  const e = EPOCHS[game.epochIndex];
  if (!e) return 'T + ?';
  const t = Math.max(0, game.epochTimer || 0);
  const total = Math.max(1, e.duration);
  const f = t / total;
  if (e.isHeatDeath) return `T + 10${superscript(Math.round(14 + f * 86))} years`;
  switch (e.name) {
    case 'Inflationary': return `T + 10${superscript(Math.round(-32 + f * 26))} sec`;
    case 'Quark Plasma': {
      const exp = -6 + f * 6;
      return exp >= 0 ? `T + ${(10 ** exp).toFixed(2)} sec` : `T + 10${superscript(Math.round(exp))} sec`;
    }
    case 'Recombination': return `T + 380,000 years`;
    case 'First Stars':   return `T + ${Math.round(150 + f * 850)} million years`;
    case 'Galactic':      return `T + ${(1 + f * 4).toFixed(1)} billion years`;
    case 'Stellar':       return `T + ${(5 + f * 95).toFixed(1)} billion years`;
    case 'Degenerate':    return `T + 10${superscript(Math.round(12 + f * 4))} years`;
    case 'Black Hole':    return `T + 10${superscript(Math.round(30 + f * 10))} years`;
  }
  return 'T + ?';
}

// Lightweight transient toast at the bottom of the screen.
export function showToast(msg: string) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:rgba(8,10,22,0.85);border:1px solid rgba(180,200,255,0.3);padding:10px 18px;font-size:11px;letter-spacing:0.25em;color:#88e0ff;z-index:50;text-transform:uppercase;border-radius:2px;backdrop-filter:blur(10px);transition:opacity 0.4s;pointer-events:none';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 2400);
}
