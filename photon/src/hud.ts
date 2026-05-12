import { hud, hudCanvas, camera } from './scene';
import { game } from './state';
import { meta } from './meta';
import { EPOCHS, WAVELENGTHS, TUTORIAL_STEPS } from './cosmology';
import { photon } from './photon';
import { BASE_SPEED, BOOST_MAX, PIXEL_RATIO } from './constants';
import { cosmicTimeLabel, comboMultiplier } from './utils';
import { seedToLabel } from './seed';

const HEAT_DEATH_MICRO_LINES = [
  { at: 72, text: 'THE LIGHT THINS' },
  { at: 138, text: 'NO NEW STARS' },
  { at: 204, text: 'BACKGROUND ONLY' },
  { at: 270, text: 'YOU ARE STILL HERE' },
  { at: 318, text: 'ONE LAST DIFFERENCE' },
];

export function showEpochToast(numOrLabel: number | string, name: string, sub: string, chapter?: string) {
  const el = document.getElementById('epoch-toast')!;
  const label = (typeof numOrLabel === 'string') ? numOrLabel : `ERA ${numOrLabel} / ${EPOCHS.length}`;
  document.getElementById('epoch-num')!.textContent = label;
  document.getElementById('epoch-name')!.textContent = name;
  document.getElementById('epoch-sub')!.textContent = sub;
  document.getElementById('epoch-chapter')!.textContent = chapter || '';
  el.classList.add('on');
  const dur = chapter ? 5200 : 2400;
  setTimeout(() => el.classList.remove('on'), dur);
}

export function drawHud() {
  const W = hudCanvas.width, H = hudCanvas.height;
  hud.clearRect(0, 0, W, H);
  if (game.state !== 'run') return;
  const PR = PIXEL_RATIO;
  hud.save();
  hud.scale(PR, PR);
  const w = window.innerWidth, h = window.innerHeight;
  hud.font = '11px ui-monospace, "SF Mono", Menlo, monospace';
  hud.textBaseline = 'top';
  const e = EPOCHS[Math.min(game.epochIndex, EPOCHS.length - 1)];
  hud.fillStyle = 'rgba(255,255,255,0.85)';
  const epochLabel = (game.endlessLoop || 0) > 0
    ? `ENDLESS  Λ${game.endlessLoop}`
    : `ERA ${game.epochIndex + 1} / ${EPOCHS.length}`;
  hud.fillText(epochLabel, 20, 20);
  hud.fillStyle = '#88e0ff';
  hud.font = 'bold 16px ui-monospace, monospace';
  hud.fillText(e.name.toUpperCase(), 20, 36);
  hud.font = '10px ui-monospace, monospace';
  hud.fillStyle = 'rgba(255,255,255,0.55)';
  hud.fillText(e.subtitle, 20, 58);
  if (game.runSeed != null && (meta.witnessedHeatDeath || 0) >= 1) {
    hud.fillStyle = 'rgba(255,122,217,0.55)';
    hud.fillText(`UNIVERSE  ${seedToLabel(game.runSeed)}`, 20, 72);
    // MULTIVERSE: surface the physical constants for this run
    const c = game.cosmicConstants;
    const c1 = c.speedMul.toFixed(2);
    const c2 = c.agilityMul.toFixed(2);
    hud.fillStyle = 'rgba(255,122,217,0.42)';
    hud.fillText(`c=${c1} · a=${c2}`, 20, 86);
  }
  // Bar drops to y=96 if the multiverse constants line is showing; otherwise y=78
  const showsMultiverse = (game.runSeed != null && (meta.witnessedHeatDeath || 0) >= 1);
  const bx = 20, by = showsMultiverse ? 100 : 78, bw = 180, bh = 4;
  hud.fillStyle = 'rgba(255,255,255,0.12)'; hud.fillRect(bx, by, bw, bh);
  const prog = Math.min(1, game.epochTimer / e.duration);
  hud.fillStyle = '#88e0ff'; hud.fillRect(bx, by, bw * prog, bh);
  hud.textAlign = 'right'; hud.textBaseline = 'top';
  hud.font = '11px ui-monospace, monospace';
  hud.fillStyle = 'rgba(255,255,255,0.55)';
  hud.fillText('DISTANCE', w - 20, 20);
  hud.font = 'bold 16px ui-monospace, monospace';
  hud.fillStyle = '#fff';
  hud.fillText(`${Math.floor(game.runDistance).toLocaleString()}`, w - 20, 36);
  hud.font = '10px ui-monospace, monospace';
  hud.fillStyle = 'rgba(255,255,255,0.55)';
  hud.fillText(`× ${game._speed ? game._speed.toFixed(0) : '0'} u/s`, w - 20, 58);
  hud.fillStyle = 'rgba(255,255,255,0.45)';
  hud.fillText('COSMIC TIME', w - 20, 86);
  hud.font = 'bold 12px ui-monospace, monospace';
  hud.fillStyle = '#ff7ad9';
  hud.fillText(cosmicTimeLabel(), w - 20, 100);
  if (e.isHeatDeath) {
    const micro = HEAT_DEATH_MICRO_LINES.find(line => game.epochTimer >= line.at && game.epochTimer < line.at + 8);
    if (micro) {
      const fadeIn = Math.min(1, (game.epochTimer - micro.at) / 1.2);
      const fadeOut = Math.min(1, (micro.at + 8 - game.epochTimer) / 1.8);
      const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
      hud.font = '10px ui-monospace, monospace';
      hud.fillStyle = `rgba(255,255,255,${0.52 * alpha})`;
      hud.fillText(micro.text, w - 20, 124);
    }
  }
  hud.textAlign = 'left';
  // Energy bar
  hud.font = '10px ui-monospace, monospace';
  hud.fillStyle = 'rgba(255,255,255,0.6)';
  hud.fillText('ENERGY', 20, h - 56);
  const ex = 20, ey = h - 40, ew = 180, eh = 8;
  hud.fillStyle = 'rgba(255,255,255,0.12)'; hud.fillRect(ex, ey, ew, eh);
  const energyFrac = photon.energy / photon.maxEnergy();
  const energyColor = energyFrac > 0.5 ? '#88e0ff' : energyFrac > 0.25 ? '#ffc850' : '#ff5566';
  hud.fillStyle = energyColor; hud.fillRect(ex, ey, ew * energyFrac, eh);
  hud.fillStyle = 'rgba(255,255,255,0.5)';
  hud.fillText(`${Math.floor(photon.energy)} / ${photon.maxEnergy()}`, ex, ey + 12);
  // Boost bar
  hud.textAlign = 'right';
  hud.fillStyle = 'rgba(255,255,255,0.6)';
  hud.fillText('BOOST  [SPACE]', w - 20, h - 56);
  const bxr = w - 200, byr = h - 40, bwr = 180, bhr = 8;
  hud.fillStyle = 'rgba(255,255,255,0.12)'; hud.fillRect(bxr, byr, bwr, bhr);
  const boostFrac = photon.boost / BOOST_MAX;
  hud.fillStyle = photon.boosting ? '#ff7ad9' : '#88e0ff'; hud.fillRect(bxr, byr, bwr * boostFrac, bhr);
  hud.textAlign = 'left';
  // Wavelength selector
  hud.textAlign = 'center';
  hud.font = '10px ui-monospace, monospace';
  hud.fillStyle = 'rgba(255,255,255,0.6)';
  hud.fillText('WAVELENGTH', w / 2, h - 56);
  const segW = 110, segH = 22, segGap = 6;
  const totalW = segW * 3 + segGap * 2;
  const sx = (w - totalW) / 2;
  for (let i = 0; i < WAVELENGTHS.length; i++) {
    const x = sx + i * (segW + segGap);
    const y = h - 36;
    const active = i === photon.wavelength;
    const wl = WAVELENGTHS[i];
    const css = `rgb(${Math.floor(wl.color.r * 255)},${Math.floor(wl.color.g * 255)},${Math.floor(wl.color.b * 255)})`;
    hud.strokeStyle = active ? css : 'rgba(255,255,255,0.18)';
    hud.lineWidth = active ? 2 : 1;
    hud.strokeRect(x, y, segW, segH);
    if (active) { hud.fillStyle = css.replace('rgb', 'rgba').replace(')', ',0.18)'); hud.fillRect(x, y, segW, segH); }
    hud.fillStyle = active ? css : 'rgba(255,255,255,0.5)';
    hud.fillText(`${i + 1}  ${wl.name}`, x + segW / 2, y + 7);
  }
  hud.textAlign = 'left';
  // Racing line feedback
  const lineY = h - 86;
  const lineActive = (game.lineStreak || 0) > 0 || game.padBoostTime > 0 || game.lineEventTime > 0 || game.railScrapeTime > 0;
  if (lineActive) {
    hud.font = '10px ui-monospace, monospace';
    hud.fillStyle = 'rgba(255,255,255,0.56)';
    hud.fillText('RACING LINE', 20, lineY);
    hud.font = 'bold 13px ui-monospace, monospace';
    const lineColor = game.railScrapeTime > 0 ? '#ff5566' : (game.lineStreak || 0) >= 5 ? '#ff7ad9' : '#88e0ff';
    hud.fillStyle = lineColor;
    const label = game.lineStreak > 0 ? `LINE ×${game.lineStreak}` : game.railScrapeTime > 0 ? 'STRAIN' : 'READY';
    hud.fillText(label, 20, lineY + 14);
    if (game.padBoostTime > 0) {
      const pbx = 84, pby = lineY + 20, pbw = 112, pbh = 4;
      const frac = Math.min(1, game.padBoostTime / Math.max(0.1, game.padBoostTotal || 1.45));
      hud.fillStyle = 'rgba(255,255,255,0.12)';
      hud.fillRect(pbx, pby, pbw, pbh);
      hud.fillStyle = '#ff7ad9';
      hud.fillRect(pbx, pby, pbw * frac, pbh);
    }
  }
  // Phase invuln flash
  if (photon.phaseTimer > 0) {
    hud.fillStyle = `rgba(136,224,255,${photon.phaseTimer / Math.max(0.18, photon.phaseWindowSec) * 0.15})`;
    hud.fillRect(0, 0, w, h);
  }
  // Redshift fatigue red pulse
  const coherenceThreshold = game.cosmicConstants.coherenceThreshold || 14;
  if ((game.coherenceTime || 0) > coherenceThreshold) {
    const intensity = Math.min(1, (game.coherenceTime - coherenceThreshold) / 16);
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() * 0.003));
    const grad = hud.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.min(w, h) * 0.7);
    grad.addColorStop(0, `rgba(255,80,80,0)`);
    grad.addColorStop(1, `rgba(255,40,60,${intensity * pulse * 0.18})`);
    hud.fillStyle = grad;
    hud.fillRect(0, 0, w, h);
  }
  if ((game.fieldStrain || 0) > 0.01 || game.railScrapeTime > 0) {
    const a = Math.max(Math.min(0.24, (game.fieldStrain || 0) * 0.2), Math.min(0.18, game.railScrapeTime * 0.58));
    const edgeX = Math.abs(game.fieldStrainX || 0);
    const edgeY = Math.abs(game.fieldStrainY || 0);
    hud.save();
    if (edgeX >= edgeY && edgeX > 0.72) {
      const left = (game.fieldStrainX || 0) < 0;
      const grad = hud.createLinearGradient(left ? 0 : w, 0, left ? 64 : w - 64, 0);
      grad.addColorStop(0, `rgba(255,85,102,${a})`);
      grad.addColorStop(1, 'rgba(255,85,102,0)');
      hud.fillStyle = grad;
      hud.fillRect(left ? 0 : w - 72, 0, 72, h);
    }
    if (edgeY > edgeX && edgeY > 0.72) {
      const top = (game.fieldStrainY || 0) > 0;
      const grad = hud.createLinearGradient(0, top ? 0 : h, 0, top ? 64 : h - 64);
      grad.addColorStop(0, `rgba(255,85,102,${a})`);
      grad.addColorStop(1, 'rgba(255,85,102,0)');
      hud.fillStyle = grad;
      hud.fillRect(0, top ? 0 : h - 72, w, 72);
    }
    if (game.railScrapeTime > 0) {
      hud.strokeStyle = `rgba(255,85,102,${Math.min(0.24, a + 0.08)})`;
      hud.lineWidth = 4;
      hud.strokeRect(7, 7, w - 14, h - 14);
    }
    hud.restore();
  }
  if (game.lineEventTime > 0 && game.lineEventText) {
    const alpha = Math.min(1, game.lineEventTime / 0.25);
    hud.save();
    hud.textAlign = 'center';
    hud.textBaseline = 'middle';
    hud.font = 'bold 18px ui-monospace, monospace';
    hud.fillStyle = game.lineEventText.includes('LOST') || game.lineEventText.includes('STRAIN')
      ? `rgba(255,85,102,${0.78 * alpha})`
      : game.lineEventText.includes('SPEED')
        ? `rgba(255,122,217,${0.86 * alpha})`
        : `rgba(136,224,255,${0.86 * alpha})`;
    hud.fillText(game.lineEventText, w / 2, h * 0.62);
    hud.restore();
    hud.textAlign = 'left'; hud.textBaseline = 'top';
  }
  // Speed lines
  if (game._speed) {
    const speedFactor = Math.max(0, (game._speed - BASE_SPEED) / BASE_SPEED);
    if (speedFactor > 0.04) {
      const cx = w / 2, cy = h / 2;
      const numLines = Math.floor(18 + speedFactor * 50);
      const baseAlpha = Math.min(0.45, speedFactor * 0.7);
      hud.save();
      hud.translate(cx, cy);
      hud.rotate((performance.now() * 0.00018) % (Math.PI * 2));
      const minDim = Math.min(w, h);
      for (let i = 0; i < numLines; i++) {
        const a = (i / numLines) * Math.PI * 2 + (i * 0.13);
        const r1 = minDim * (0.34 + (i % 3) * 0.045);
        const r2 = minDim * (0.55 + speedFactor * 0.12);
        const fade = baseAlpha * (0.35 + Math.sin(i * 1.7 + performance.now() * 0.005) * 0.6);
        hud.strokeStyle = `rgba(255,255,255,${Math.max(0, fade)})`;
        hud.lineWidth = 1;
        hud.beginPath();
        hud.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        hud.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        hud.stroke();
      }
      hud.restore();
    }
  }
  // Combo badge
  const streak = game.phaseStreak || 0;
  if (streak >= 1) {
    const mult = comboMultiplier(streak);
    const v = photon.group.position.clone().project(camera);
    if (v.z < 1) {
      const sx2 = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h - 60;
      const pulse = 1 + Math.sin(performance.now() * 0.012) * 0.06;
      hud.save();
      hud.translate(sx2, sy);
      hud.scale(pulse, pulse);
      hud.textAlign = 'center'; hud.textBaseline = 'middle';
      hud.font = 'bold 22px ui-monospace, monospace';
      const color = streak >= 8 ? '#ff7ad9' : streak >= 5 ? '#ffc850' : '#88e0ff';
      hud.fillStyle = color;
      hud.fillText(`×${mult.toFixed(mult % 1 ? 1 : 0)}`, 0, 0);
      hud.font = '9px ui-monospace, monospace';
      hud.fillStyle = `rgba(255,255,255,0.7)`;
      hud.fillText(`RESONANCE`, 0, 16);
      hud.restore();
      hud.textAlign = 'left'; hud.textBaseline = 'top';
    }
  }
  // Tutorial overlay
  if (game.tutorialActive && game.tutorialStep < TUTORIAL_STEPS.length) {
    const step = TUTORIAL_STEPS[game.tutorialStep];
    const fadeIn = Math.min(1, game.tutorialTime / 0.35);
    const lifeLeft = step.max - game.tutorialTime;
    const fadeOut = Math.min(1, lifeLeft / 0.4);
    const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
    if (alpha > 0.01) {
      const ty = h - 110;
      const padX = 24, padY = 14;
      hud.font = 'bold 14px ui-monospace, monospace';
      hud.textAlign = 'center'; hud.textBaseline = 'middle';
      const textW = hud.measureText(step.text).width;
      hud.font = '11px ui-monospace, monospace';
      const hintW = hud.measureText(step.hint).width;
      const boxW = Math.max(textW, hintW) + padX * 2;
      const boxH = padY * 2 + 36;
      const bx2 = w / 2 - boxW / 2;
      hud.fillStyle = `rgba(8, 10, 22, ${alpha * 0.78})`;
      hud.fillRect(bx2, ty - boxH / 2, boxW, boxH);
      hud.strokeStyle = `rgba(136, 224, 255, ${alpha * 0.55})`;
      hud.lineWidth = 1;
      hud.strokeRect(bx2, ty - boxH / 2, boxW, boxH);
      hud.fillStyle = `rgba(136, 224, 255, ${alpha})`;
      hud.font = 'bold 13px ui-monospace, monospace';
      hud.fillText(step.text, w / 2, ty - 8);
      hud.fillStyle = `rgba(255, 255, 255, ${alpha * 0.65})`;
      hud.font = '11px ui-monospace, monospace';
      hud.fillText(step.hint, w / 2, ty + 12);
      const pipY = ty + boxH / 2 - 4;
      const pipSpacing = 10;
      const pipsTotal = TUTORIAL_STEPS.length;
      const pipsX = w / 2 - (pipsTotal - 1) * pipSpacing / 2;
      for (let i = 0; i < pipsTotal; i++) {
        hud.fillStyle = i <= game.tutorialStep ? `rgba(136,224,255,${alpha})` : `rgba(255,255,255,${alpha * 0.18})`;
        hud.fillRect(pipsX + i * pipSpacing - 2, pipY, 4, 2);
      }
      hud.textAlign = 'left'; hud.textBaseline = 'top';
    }
  }
  hud.restore();
}
