import { clearFunHistory, exportFunHistoryJSON, loadFunHistory } from './storage';
import type { FunRunRecord, VibeRating } from './types';

const AXES: Array<{ key: keyof Omit<VibeRating, 'at' | 'note' | 'skipped'>; label: string; low: string; high: string }> = [
  { key: 'fun', label: 'Fun', low: 'flat', high: 'alive' },
  { key: 'flow', label: 'Flow', low: 'messy', high: 'locked in' },
  { key: 'frustration', label: 'Frustration', low: 'calm', high: 'cheap' },
  { key: 'oneMoreRun', label: 'One more run', low: 'done', high: 'again' },
];

function pct(n: number) {
  return `${Math.round(n)}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function byId<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T | null;
}

function axisBar(label: string, value: number, className = '') {
  return `<div class="funlab-axis ${escapeHtml(className)}"><span>${escapeHtml(label)}</span><div><i style="width:${pct(value)}%"></i></div><b>${pct(value)}</b></div>`;
}

function recommendationCard(record: FunRunRecord) {
  return record.recommendations.map((rec) => `
    <div class="funlab-rec risk-${escapeHtml(rec.risk)}">
      <div class="funlab-rec-head"><span>${escapeHtml(rec.finding)}</span><b>${escapeHtml(rec.confidence)} confidence</b></div>
      <p>${escapeHtml(rec.suggestion)}</p>
      <ul>${rec.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </div>
  `).join('');
}

function dopamineEngineCard(record: FunRunRecord) {
  const engine = record.dopamineEngine;
  if (!engine) return '';
  const missing = engine.missingBeats.length ? engine.missingBeats.map((beat) =>
    '<li><b>' + escapeHtml(beat.beat) + '</b><span>' + escapeHtml(beat.principle) + '</span><em>' + escapeHtml(beat.suggestion) + '</em></li>'
  ).join('') : '<li><b>No major missing beat</b><span>flow-channel</span><em>Preserve this seed profile as a reference.</em></li>';
  const plan = engine.plan.map((step) =>
    '<div class="funlab-plan-step priority-' + escapeHtml(step.priority) + ' risk-' + escapeHtml(step.risk) + '">' +
      '<div><b>' + escapeHtml(step.priority) + '</b><span>' + escapeHtml(step.principle) + '</span></div>' +
      '<h4>' + escapeHtml(step.title) + '</h4>' +
      '<p>' + escapeHtml(step.diagnosis) + '</p>' +
      '<p>' + escapeHtml(step.action) + '</p>' +
      '<em>' + escapeHtml(step.expectedEffect) + '</em>' +
      '<ul>' + step.evidence.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>' +
    '</div>'
  ).join('');
  return '<h3>Dopamine Engine</h3>' +
    '<div class="funlab-engine">' +
      '<div class="funlab-engine-head"><b>' + escapeHtml(engine.state) + '</b><span>' + escapeHtml(engine.score) + '/100</span><em>' + escapeHtml(engine.theoryTags.join(' · ')) + '</em></div>' +
      '<div class="funlab-engine-grid">' +
        axisBar('Pressure', engine.pressure) +
        axisBar('Mastery', engine.mastery) +
        axisBar('Safety', engine.safety) +
        axisBar('Novelty', engine.novelty) +
      '</div>' +
      '<p>Cadence ' + escapeHtml(engine.rewardCadenceSec) + 's · ' + escapeHtml(engine.rewardEventsPerMin) + ' reward events/min</p>' +
      '<h4>Missing beats</h4>' +
      '<ul class="funlab-missing">' + missing + '</ul>' +
      '<h4>Plan</h4>' +
      '<div class="funlab-plan">' + plan + '</div>' +
    '</div>';
}
function renderTimeline(record: FunRunRecord) {
  return record.events
    .filter((event) => ['epoch-enter', 'gate-hit', 'gate-miss', 'speed-pad-hit', 'gravity-sling', 'hazard-near-miss', 'hazard-hit', 'damage', 'phase-through', 'field-strain-peak', 'death', 'run-end', 'quit'].includes(event.type))
    .slice(-12)
    .map((event) => {
      const t = typeof event.t === 'number' ? `${event.t.toFixed(1)}s` : '';
      const detail = event.cause || event.epochName || (event.streak ? `x${event.streak}` : '');
      return `<div><span>${escapeHtml(t)}</span><b>${escapeHtml(event.type.replace(/-/g, ' '))}</b><em>${escapeHtml(detail)}</em></div>`;
    }).join('');
}

export function renderVibePrompt(runId: string, returnState: 'death' | 'title' = 'death') {
  const record = loadFunHistory().find((r) => r.id === runId);
  const panel = byId<HTMLElement>('vibe-panel');
  if (panel) {
    panel.dataset.runId = runId;
    panel.dataset.returnState = returnState;
  }
  const summary = byId<HTMLElement>('vibe-summary');
  if (summary && record) {
    summary.innerHTML = `
      <span>${escapeHtml(record.summary.epochName)}</span>
      <span>${Math.round(record.summary.distance).toLocaleString()} drift</span>
      <span>${escapeHtml(record.fingerprint.funIndex)}/100 Fun Index</span>
      <span>${escapeHtml(record.fingerprint.trust)}/100 trust</span>
    `;
  }
  for (const axis of AXES) setVibeRating(axis.key, axis.key === 'frustration' ? 2 : 4);
  const note = byId<HTMLTextAreaElement>('vibe-note');
  if (note) note.value = '';
}

export function setVibeRating(axis: string, value: number) {
  const wrap = byId<HTMLElement>(`vibe-${axis}`);
  if (!wrap) return;
  wrap.dataset.value = String(value);
  for (const btn of Array.from(wrap.querySelectorAll('button'))) {
    btn.classList.toggle('selected', Number((btn as HTMLButtonElement).dataset.value) === value);
  }
}

export function buildVibeControls() {
  const wrap = byId<HTMLElement>('vibe-controls');
  if (!wrap) return;
  wrap.innerHTML = AXES.map((axis) => `
    <div class="vibe-axis">
      <div class="vibe-axis-head"><span>${axis.label}</span><em>${axis.low} / ${axis.high}</em></div>
      <div class="vibe-buttons" id="vibe-${axis.key}" data-value="3">
        ${[1, 2, 3, 4, 5].map((value) => `<button type="button" data-axis="${axis.key}" data-value="${value}">${value}</button>`).join('')}
      </div>
    </div>
  `).join('');
  for (const btn of Array.from(wrap.querySelectorAll('button'))) {
    btn.addEventListener('click', () => setVibeRating((btn as HTMLButtonElement).dataset.axis || 'fun', Number((btn as HTMLButtonElement).dataset.value || '3')));
  }
}

export function readVibeRating(): Omit<VibeRating, 'at'> {
  const valueFor = (axis: string) => Number(byId<HTMLElement>(`vibe-${axis}`)?.dataset.value || '3');
  return {
    fun: valueFor('fun'),
    flow: valueFor('flow'),
    frustration: valueFor('frustration'),
    oneMoreRun: valueFor('oneMoreRun'),
    note: byId<HTMLTextAreaElement>('vibe-note')?.value.trim() || undefined,
  };
}

export function renderFunLabDashboard(selectedId?: string) {
  const records = loadFunHistory();
  const list = byId<HTMLElement>('funlab-run-list');
  const detail = byId<HTMLElement>('funlab-detail');
  const selected = records.find((r) => r.id === selectedId) || records[0];
  if (list) {
    list.innerHTML = records.length ? records.map((record) => `
      <button class="funlab-run ${record.id === selected?.id ? 'selected' : ''}" type="button" data-run-id="${escapeHtml(record.id)}">
        <span>${escapeHtml(record.summary.epochName)}</span>
        <b>${escapeHtml(record.fingerprint.funIndex)}</b>
        <em>${escapeHtml(new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</em>
      </button>
    `).join('') : '<p class="funlab-empty">No runs recorded yet. Start a run and let the lab watch.</p>';
    for (const btn of Array.from(list.querySelectorAll('button'))) {
      btn.addEventListener('click', () => renderFunLabDashboard((btn as HTMLButtonElement).dataset.runId));
    }
  }
  if (!detail) return;
  if (!selected) {
    detail.innerHTML = '<p class="funlab-empty">Fun Lab is armed. Finish a run to generate the first fingerprint.</p>';
    return;
  }
  const vibe = selected.vibe && !selected.vibe.skipped
    ? `<p class="funlab-vibe">Vibe: fun ${escapeHtml(selected.vibe.fun)}/5, flow ${escapeHtml(selected.vibe.flow)}/5, frustration ${escapeHtml(selected.vibe.frustration)}/5, again ${escapeHtml(selected.vibe.oneMoreRun)}/5${selected.vibe.note ? ` · "${escapeHtml(selected.vibe.note)}"` : ''}</p>`
    : '<p class="funlab-vibe">No vibe rating attached yet.</p>';
  detail.innerHTML = `
    <div class="funlab-fingerprint">
      ${axisBar('Dopamine', selected.fingerprint.dopamine)}
      ${axisBar('Flow', selected.fingerprint.flow)}
      ${axisBar('One more run', selected.fingerprint.oneMoreRun)}
      ${axisBar('Frustration', selected.fingerprint.frustration, 'danger')}
      ${axisBar('Readability', selected.fingerprint.readability)}
      ${axisBar('Trust', selected.fingerprint.trust)}
    </div>
    ${vibe}
    ${selected.fingerprint.uncertainty.length ? `<div class="funlab-uncertain">${selected.fingerprint.uncertainty.map(escapeHtml).join(' ')}</div>` : ''}
    ${dopamineEngineCard(selected)}
    <h3>Tuning queue</h3>
    ${recommendationCard(selected)}
    <h3>Evidence timeline</h3>
    <div class="funlab-timeline">${renderTimeline(selected)}</div>
  `;
}

export function exportFunLab() {
  const blob = new Blob([exportFunHistoryJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `photon-funlab-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function clearFunLabAndRender() {
  clearFunHistory();
  renderFunLabDashboard();
}
